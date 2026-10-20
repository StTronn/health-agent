/** The triage worker: a fork of this conversation (it inherits the chat, prompt, memory and skills),
 * owned by this call, that follows the triage skill and returns questions or a level. It never talks
 * to the user. Replay-safe: a rerun after a crash finds the same fork and the same submission. */
import { Type } from "@earendil-works/pi-ai";
import { configure, defineTool, type ToolRegistration } from "@earendil-works/pi-durable";
import { text } from "../transcript.ts";

const BRIEF = `You are now the triage clinician working for the assistant above, not talking to the family.
Follow the triage skill on the episode below: check, gather, analyse, record (keep your working state in
the episode's ## Triage section). Return either the focused questions to ask (each with why it matters)
or a level (home / doctor / emergency) with its reason, evidence and trend.

`;

export const triageTool = (workerTools: () => ToolRegistration[]) =>
  defineTool({
    name: "triage",
    description:
      "Continue this conversation as the triage clinician: follow the triage skill on the current episode " +
      "and return either focused questions or a level with evidence.",
    parameters: Type.Object({ request: Type.String({ description: "The episode and what changed" }) }),
    replay: "safe",
    execute: async ({ request }, api, context) => {
      const child = await api.commit(async (tx) => {
        const existing = (await tx.scanConversations({ ownerTaskId: api.taskId }, 1)).items[0];
        if (existing) return existing.id;
        // Fork just before the assistant entry that holds this call, so the fork ends on a settled turn.
        const recent = (await tx.scanEntries({ conversationId: api.conversationId, order: "descending" }, 20)).items;
        const call = recent.findIndex((e) => e.model?.some((m) => m.role === "assistant" && m.content.some((c) => c.type === "toolCall" && c.id === api.callId)));
        const at = recent[call + 1] ?? recent[0]!;
        const fork = await tx.forkConversation(api.conversationId, at.id, { ownership: { kind: "task", taskId: api.taskId } });
        await configure(tx, fork.id, { tools: workerTools() });
        return fork.id;
      }, context);
      await api.details({ conversationId: child }, context);
      const conversation = (await api.conversation(child, context))!;
      const submission = await conversation.submit({ type: "input", content: BRIEF + request, requestId: `triage:${api.taskId}` }, context);
      const settled = await submission.wait(context);
      if (settled.status !== "done" || !settled.answer) return { output: [{ type: "text", text: `Triage failed: ${settled.reason}` }], isError: true };
      return { output: [{ type: "text", text: text(await api.commit((tx) => tx.entry(settled.answer!), context)) || "(no answer)" }] };
    },
  });
