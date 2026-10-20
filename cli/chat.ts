/** Chat with a household from the terminal, against local dev or the deployed Worker.
 *   AGENT_URL=https://family-health.<you>.workers.dev AGENT_TOKEN=... node cli/chat.ts [household] [--new]
 * Proactive messages (scheduled check-ins) are printed as they arrive. */
import { createInterface } from "node:readline/promises";

const url = process.env.AGENT_URL ?? "http://127.0.0.1:8788";
const household = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "demo";
const api = async (path: string, body?: object) => {
  const response = await fetch(`${url}/api/households/${household}/${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${process.env.AGENT_TOKEN}`, "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json() as Promise<any>;
};

let conversation: "new" | number | undefined = process.argv.includes("--new") ? "new" : undefined;
let seen = (await api("outbox")).messages.at(-1)?.seq ?? 0;
setInterval(async () => {
  for (const m of (await api(`outbox?after=${seen}`).catch(() => ({ messages: [] }))).messages) {
    seen = m.seq;
    console.log(`\n\nagent (check-in)> ${m.text}\n\nyou> `);
  }
}, 15_000).unref();

const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(`household "${household}" at ${url}. Empty line or "exit" quits.`);
for (let text; (text = (await rl.question("\nyou> ").catch(() => "")).trim()) && text !== "exit"; ) {
  const result = await api("messages", { text, conversation });
  conversation = result.conversation;
  console.log(`\n  · ${result.steps.map((s: any) => `${s.name}(${s.arg})`).join(" · ") || "no steps"}\n\nagent> ${result.reply}`);
}
rl.close();
