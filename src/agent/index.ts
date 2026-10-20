/** Family health agent: one main agent, a triage fork, and a few tools. Behaviour lives in SOUL.md,
 * prompt.md and skills/; memory lives in the household's family/ files. Platform-free: the host gives it
 * the household's workspace and a way to wake up later. */
import type { Workspace } from "@cloudflare/computer";
import { createModels } from "@earendil-works/pi-ai/models";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { configure, createRegistry, defineExtension, type HarnessOptions } from "@earendil-works/pi-durable";
import { sections } from "./prompt.ts";
import { createBrowseTool } from "./tools/browse.ts";
import { escalateTool } from "./tools/escalate.ts";
import { fileTools } from "./tools/files.ts";
import { scheduleTool, wakeupTask } from "./tools/schedule.ts";
import { triageTool } from "./tools/triage.ts";
import { webSearchTool } from "./tools/web-search.ts";

export const MODEL = "gpt-6.1-sol";

export type AgentDeps = {
  workspace: Workspace;
  secrets: { OPENAI_API_KEY: string; BROWSER_USE_API_KEY?: string };
  /** Make sure the host wakes up no later than this time (ms). */
  ensureWakeupAt: (at: number) => Promise<void>;
};

export function createAgent({ workspace, secrets, ensureWakeupAt }: AgentDeps): HarnessOptions {
  const models = createModels();
  models.setProvider(openaiProvider());
  const files = fileTools(workspace);
  const search = webSearchTool(secrets.OPENAI_API_KEY, MODEL);
  const wakeup = wakeupTask(workspace);
  const tools = [
    ...files,
    search,
    triageTool(() => [...files, search]), // the fork reads, records and searches; it never escalates or talks
    escalateTool(workspace),
    scheduleTool(wakeup, ensureWakeupAt),
    ...(secrets.BROWSER_USE_API_KEY ? [createBrowseTool(secrets.BROWSER_USE_API_KEY, workspace)] : []),
  ];
  const family = defineExtension({ name: "family-health", tools, tasks: [wakeup], sections: sections(workspace) });
  const registry = createRegistry();
  registry.install(family);
  return {
    models,
    registry,
    // Retention timers would keep the Durable Object from hibernating.
    settings: { extensions: [family], documentRetentionMs: 0 },
    conversationCreated: (tx, conversation) =>
      conversation.owner === undefined && conversation.parent === undefined
        ? configure(tx, conversation.id, { model: { provider: "openai", modelId: MODEL }, thinkingLevel: "medium", tools })
        : undefined,
  };
}

export { reply, since, type Reply } from "./guard.ts";
export { NO_REPLY, Outbox, wakeupDeadline } from "./tools/schedule.ts";
