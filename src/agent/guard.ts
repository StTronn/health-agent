/** The backstop: code has the last word on every reply. An escalation always ends on its fixed message,
 * and a red flag the agent missed becomes the emergency message. Code tells or stops, never fixes.
 * Further checks (e.g. a Jev judgment) are one more line in `missedEmergency`. */
import type { Workspace } from "@cloudflare/computer";
import type { ConversationId, EntryId, EntryRecord, Tx } from "@earendil-works/pi-durable";
import { handoff } from "./tools/escalate.ts";
import { text, textOf } from "./transcript.ts";

// Phrases that always mean emergency; the full clinical list is in skills/home-care/red-flags.md.
const NOT = ["no", "not", "without", "never", "no signs of", "hasn't had a", "hasn't had any", "didn't have a",
  "didn't have any", "has not had a", "did not have a"].map((w) => `(?<!\\b${w} )`).join("");
const RED_FLAGS = new RegExp(NOT + "\\b(" + [
  "not breathing", "stopped breathing", "can'?t breathe", "gasping", "unconscious", "unresponsive",
  "(won'?t|can'?t|cannot) (wake|be woken)", "chest pain", "seizure", "convulsing", "blue lips", "turning blue",
  "face (is )?drooping", "slurred speech", "severe bleeding", "won'?t stop bleeding", "overdose",
  "swallowed (pills|poison|bleach)", "suicid\\w*", "kill (myself|himself|herself)",
].join("|") + ")\\b", "i");

const missedEmergency = (message: string) => RED_FLAGS.test(message);

export type Step = { name: string; arg: string };
export type Reply = { reply: string; steps: Step[] };

/** Entries a run added after `from`, oldest first. */
export const since = async (tx: Tx, conversationId: ConversationId, from: EntryId) =>
  (await tx.scanEntries({ conversationId, minEntryId: from, order: "ascending" }, 500)).items.filter((e) => e.id !== from);

/** The reply that reaches the family for a run, given the entries it added and what the family said. */
export async function reply(ws: Workspace, entries: EntryRecord[], message: string): Promise<Reply> {
  const messages = entries.flatMap((e) => e.model ?? []);
  const steps = messages.flatMap((m) => (m.role === "assistant" ? m.content : []))
    .flatMap((c) => (c.type === "toolCall" ? [c] : []))
    .map(({ name, arguments: a }) => ({ name, arg: String(a.path ?? a.level ?? a.pattern ?? a.task ?? a.request ?? a.instruction ?? "").slice(0, 80) }));
  const escalation = messages.find((m) => m.role === "toolResult" && m.toolName === "escalate" && !m.isError);
  if (escalation) return { reply: textOf([escalation]), steps };
  if (missedEmergency(message)) return { reply: await handoff(ws, "emergency", "unknown", `backstop: ${message.slice(0, 80)}`), steps };
  const last = entries.findLast((e) => e.model?.some((m) => m.role === "assistant"));
  return { reply: text(last), steps };
}
