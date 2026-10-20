/** Wakeups: the agent schedules its own check-ins. `schedule` creates a durable task that sleeps until
 * `runAt`, then hands the instruction to the conversation as input. Whatever the agent then says goes to
 * the outbox for the channels to deliver; "NO_REPLY" means it decided there's nothing worth saying.
 * The host keeps an alarm at the earliest deadline (`wakeupDeadline`), so a sleeping object wakes on time. */
import type { Workspace } from "@cloudflare/computer";
import { Type } from "@earendil-works/pi-ai";
import { defineDoc, defineTask, defineTool, type ConversationId, type TaskInspection } from "@earendil-works/pi-durable";
import { reply, since } from "../guard.ts";

type Wakeup = { id: string; conversationId: ConversationId; instruction: string; runAt: number };

export const NO_REPLY = "NO_REPLY";

/** Proactive messages waiting for a channel, oldest first. */
export const Outbox = defineDoc<{ messages: { seq: number; at: string; text: string; conversation: number }[] }>({
  kind: "app.outbox", version: 1, scope: "session", initial: () => ({ messages: [] }),
});

/** The wakeup a schedule call created, so a replay returns it instead of creating another. */
const Intent = defineDoc<{ wakeup?: Wakeup }>({ kind: "app.schedule-intent", version: 1, scope: "task", initial: () => ({}) });

export const wakeupTask = (ws: Workspace) =>
  defineTask<Wakeup, { phase: "wait" } | { phase: "deliver" }, null>({
    name: "app.wakeup",
    version: 1,
    initial: () => ({ phase: "wait" }),
    phases: {
      wait: async (task, runtime, context) => {
        await runtime.sleep(task.input.runAt, context);
        await runtime.commit(() => ({ status: "running", checkpoint: { phase: "deliver" } }), context);
      },
      deliver: async (task, runtime, context) => {
        const conversation = await runtime.conversation(task.input.conversationId, context);
        if (conversation) {
          const content = `[Scheduled check-in you set earlier] ${task.input.instruction}\n` +
            `Check memory first. If there's nothing worth telling the family right now, reply exactly ${NO_REPLY}.`;
          const settled = await (await conversation.submit({ type: "input", content, requestId: task.input.id, whenBusy: "followUp" }, context)).wait(context);
          await runtime.commit(async (tx) => {
            if (!settled.entry) return undefined;
            const { reply: message } = await reply(ws, await since(tx, task.input.conversationId, settled.entry), "");
            if (message && !message.includes(NO_REPLY)) {
              const outbox = await tx.doc(Outbox);
              const seq = (outbox.messages.at(-1)?.seq ?? 0) + 1;
              outbox.messages.push({ seq, at: new Date().toISOString(), text: message, conversation: task.input.conversationId as number });
            }
            return undefined;
          }, context);
        }
        await runtime.commit(() => ({ status: "terminal", outcome: { status: "completed", result: null } }), context);
      },
    },
    abort: (_task, runtime, context) => runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context),
  });

/** When a waiting wakeup is due, or undefined for any other task. */
export function wakeupDeadline(task: TaskInspection): number | undefined {
  const { kind, state, input } = task.record;
  if (kind !== "app.wakeup" || state.status === "terminal" || state.status === "completing") return undefined;
  return (state.checkpoint as { phase: string }).phase === "wait" ? (input as Wakeup).runAt : undefined;
}

export const scheduleTool = (wakeup: ReturnType<typeof wakeupTask>, ensureWakeupAt: (at: number) => Promise<void>) =>
  defineTool({
    name: "schedule",
    description:
      "Schedule a check-in with yourself: at that time this conversation receives the instruction and you act " +
      "on it (look at memory, then message the family only if it helps). Use it for every follow-up you promise.",
    parameters: Type.Object({
      instruction: Type.String({ description: "Self-contained, e.g. 'Check on Aarav's fever (ep-2026-10-20-aarav-fever)'" }),
      at: Type.String({ description: "ISO 8601 date-time with a timezone offset, e.g. 2026-10-21T19:00:00+05:30" }),
    }),
    replay: "safe",
    execute: async ({ instruction, at }, api, context) => {
      const runAt = Date.parse(at);
      if (!/(Z|[+-]\d\d:\d\d)$/i.test(at) || !(runAt > Date.now())) throw new Error("at must be a future ISO date-time with a timezone offset");
      const scheduled = await api.commit(async (tx) => {
        const intent = await tx.doc(Intent, api.taskId);
        if (!intent.wakeup) {
          intent.wakeup = { id: `wakeup:${api.taskId}`, conversationId: api.conversationId, instruction, runAt };
          await tx.createTask(wakeup, intent.wakeup, { ownership: { kind: "conversation" }, conversationId: api.conversationId, background: true });
        }
        return { ...intent.wakeup };
      }, context);
      await ensureWakeupAt(scheduled.runAt);
      return { output: [{ type: "text", text: `Scheduled for ${new Date(scheduled.runAt).toISOString()}: ${JSON.stringify(scheduled.instruction)}.` }] };
    },
  });
