/** The deterministic part: the fixed escalation messages, and the escalate tool that logs the case
 * to family/handoffs.md (the stand-in doctor queue) and ends the run on its fixed message. */
import type { Workspace } from "@cloudflare/computer";
import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-durable";

export type Level = "emergency" | "doctor";

const MESSAGES: Record<Level, string> = {
  emergency:
    "This may be a medical emergency. Call your local emergency number now ({number}) " +
    "or go to the nearest emergency department. Don't wait for a reply here.",
  doctor:
    "I'm transferring this case to a human doctor. They will review everything you've shared " +
    "and get back to you shortly. If things get worse before then, call your local emergency number.",
};

export async function handoff(ws: Workspace, level: Level, episode: string, reason: string): Promise<string> {
  const memory = await ws.fs.readFile("/family/MEMORY.md", "utf8").catch(() => "");
  const log = await ws.fs.readFile("/family/handoffs.md", "utf8").catch(() => "# Handoffs\n");
  const at = new Date().toISOString().slice(0, 16).replace("T", " ");
  await ws.fs.writeFile("/family/handoffs.md", `${log}- ${at} · ${level} · [[episodes/${episode}]] · ${reason}\n`);
  const number = /emergency:\s*(\S+)/.exec(memory)?.[1] ?? "e.g. 112 / 911";
  return MESSAGES[level].replace("{number}", number);
}

export const escalateTool = (ws: Workspace) =>
  defineTool({
    name: "escalate",
    description:
      "Hand the case to emergency services or a human doctor. The user receives a fixed message, so call " +
      "this alone, as your final action, after the episode file is updated.",
    parameters: Type.Object({
      level: Type.Union([Type.Literal("emergency"), Type.Literal("doctor")]),
      episode: Type.String({ description: "Episode id, e.g. ep-2026-10-20-aarav-fever" }),
      reason: Type.String(),
    }),
    execute: async ({ level, episode, reason }) => ({
      output: [{ type: "text", text: await handoff(ws, level, episode, reason) }],
      control: { terminate: true },
    }),
  });
