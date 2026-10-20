/** One Durable Object per household: its files (Cloudflare Computer on the object's SQLite), the
 * agent's durable harness (pi-durable, same SQLite), and the alarm that wakes it for scheduled
 * check-ins. Channels call it over RPC: `message`, `stream`, `outbox`, `files`, `seed`. */
import { DurableObject } from "cloudflare:workers";
import { Workspace, WorkerBundle } from "@cloudflare/computer";
import { BACKGROUND_CONTEXT as ctx } from "@earendil-works/chord/context";
import { Harness, watchEvents, type ConversationId, type TaskId } from "@earendil-works/pi-durable";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import skills from "computer:bundle/skills";
import { createAgent, Outbox, reply, since, wakeupDeadline, type Reply } from "../agent/index.ts";

/** A new household starts from the repo's family/ folder. */
const SEED = import.meta.glob("/family/**/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
/** How soon to come back and finish work a crash or eviction interrupted. */
const RECOVERY_MS = 60_000;

export type Files = Record<string, string>; // "family/MEMORY.md" -> content

export class Household extends DurableObject<Env> {
  #ws!: Workspace;
  #harness!: Harness;
  #alarmUpdate = Promise.resolve();
  readonly #watching = new Set<TaskId>();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    void state.blockConcurrencyWhile(() => this.#open());
  }

  async #open() {
    this.#ws = new Workspace({ storage: this.ctx.storage, mounts: { "/skills": WorkerBundle(skills) } });
    await this.#ws.ready();
    if (!(await this.#ws.fs.stat("/family/MEMORY.md").catch(() => null))) await this.seed(Object.fromEntries(Object.entries(SEED).map(([p, c]) => [p.slice(1), c])));
    const agent = createAgent({ workspace: this.#ws, secrets: this.env, ensureWakeupAt: (at) => this.#alarmNoLaterThan(at) });
    this.#harness = await Harness.open(await openDurableObjectSqliteStorage(this.ctx.storage), { ...agent, onReport: (e) => console.error("harness", e) }, ctx);
    void this.#harness.closed.then((end) => end.reason === "failed" && this.ctx.abort("Harness failed"));
    await this.#refreshAlarm();
  }

  /** One message from the family; resolves with the reply once the agent's run is done. */
  async message(text: string, conversation?: "new" | number, requestId: string = crypto.randomUUID()): Promise<Reply & { conversation: number }> {
    const id = await this.#conversation(conversation);
    const chat = await this.#harness.conversation(id, ctx);
    if (!chat) throw new Error(`No conversation ${conversation}`);
    await this.#alarmNoLaterThan(Date.now() + RECOVERY_MS);
    const settled = await (await chat.submit({ type: "input", content: text, requestId, whenBusy: "followUp" }, ctx)).wait(ctx);
    await this.#refreshAlarm();
    const result = settled.entry ? await reply(this.#ws, await this.#harness.commit((tx) => since(tx, id, settled.entry!), ctx), text) : { reply: "", steps: [] };
    if (settled.status !== "done") result.reply ||= `Sorry, something went wrong on my side (${settled.reason}). Please try again.`;
    return { ...result, conversation: id as number };
  }

  /** The same as `message`, as newline-delimited JSON events while the agent works:
   * {type:"conversation"} first, then {type:"text", delta} and {type:"tool", name, arg} as they happen
   * ({type:"reset"} when a new model message starts), and finally {type:"done", reply, steps} carrying the
   * backstop-checked reply, which replaces whatever text was streamed. */
  async stream(text: string, conversation?: "new" | number, requestId: string = crypto.randomUUID()): Promise<ReadableStream<Uint8Array>> {
    const id = await this.#conversation(conversation);
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const send = (event: object) => writer.write(new TextEncoder().encode(`${JSON.stringify(event)}\n`)).catch(() => {});
    void (async () => {
      await send({ type: "conversation", conversation: id });
      const events = await watchEvents(this.#harness, id, ctx);
      events.start(async (batch) => {
        for (const e of batch) {
          if (e.type === "message_start" && e.message.role === "assistant") await send({ type: "reset" });
          if (e.type === "message_update") for (const c of e.changes) if (c.type === "text_delta") await send({ type: "text", delta: c.delta });
          if (e.type === "tool_execution_start" && !e.parentToolCallId) await send({ type: "tool", name: e.toolName, arg: String(e.args.path ?? e.args.pattern ?? e.args.task ?? e.args.query ?? "").slice(0, 80) });
        }
      });
      try {
        await send({ type: "done", ...(await this.message(text, id, requestId)) });
      } finally {
        await events.stop();
      }
    })().catch((e) => send({ type: "error", message: String(e) })).finally(() => writer.close().catch(() => {}));
    return readable;
  }

  async #conversation(conversation?: "new" | number): Promise<ConversationId> {
    if (conversation === "new") return (await this.#harness.commit((tx) => tx.createConversation({ ownership: { kind: "ownerless" } }), ctx)).id;
    return conversation ? (conversation as ConversationId) : (await this.#harness.root(ctx)).id;
  }

  /** Proactive messages from scheduled check-ins, after `after` (a seq). */
  async outbox(after = 0) {
    const doc = await this.#harness.snapshot(Outbox, ctx);
    return (doc?.messages ?? []).filter((m) => m.seq > after);
  }

  async files(): Promise<Files> {
    const files: Files = {};
    for (const { path, type } of await this.#ws.fs.find("/family")) {
      if (type === "file") files[path.replace(/^\//, "")] = await this.#ws.fs.readFile(path, "utf8");
    }
    return files;
  }

  async seed(files: Files, reset = false) {
    if (reset) await this.#ws.fs.rm("/family", { recursive: true, force: true });
    for (const [path, content] of Object.entries(files)) {
      const abs = `/${path.replace(/^\/+/, "")}`;
      if (!abs.startsWith("/family/")) throw new Error(`Only family/ files can be seeded: ${path}`);
      await this.#ws.fs.mkdir(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
      await this.#ws.fs.writeFile(abs, content);
    }
  }

  override async alarm() {
    await this.#refreshAlarm();
  }

  /** Set the alarm to the earliest wakeup, or a recovery alarm while work is unfinished; resume what's due. */
  #refreshAlarm() {
    return this.#serialize(async () => {
      const { tasks } = await this.#harness.inspect(ctx);
      const now = Date.now();
      let next: number | undefined;
      for (const task of tasks) {
        if (task.state.kind === "blocked") continue;
        const due = wakeupDeadline(task);
        const waiting = due !== undefined && due > now && !task.record.abortRequested;
        next = Math.min(next ?? Infinity, waiting ? due : now + RECOVERY_MS);
        if (!waiting && !this.#watching.has(task.record.id)) {
          this.#watching.add(task.record.id); // waitForTask starts the scheduler; refresh once it settles
          void this.#harness.waitForTask(task.record.id, ctx).then(() => this.#refreshAlarm(), console.error)
            .finally(() => this.#watching.delete(task.record.id));
        }
      }
      if (next === undefined) await this.ctx.storage.deleteAlarm();
      else await this.ctx.storage.setAlarm(next);
    });
  }

  #alarmNoLaterThan(at: number) {
    return this.#serialize(async () => {
      const current = await this.ctx.storage.getAlarm();
      if (current === null || at < current) await this.ctx.storage.setAlarm(at);
    });
  }

  #serialize(update: () => Promise<void>) {
    return (this.#alarmUpdate = this.#alarmUpdate.then(update, update));
  }
}
