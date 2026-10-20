/** Web search through OpenAI's hosted search: pi-ai doesn't expose provider-hosted tools, so this
 * makes one Responses call with web_search enabled and returns its cited answer. */
import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-durable";

export const webSearchTool = (apiKey: string, model: string) =>
  defineTool({
    name: "web_search",
    description: "Search the web for current guidance (WHO, NHS, CDC, national paediatric bodies) and get a short answer with sources.",
    parameters: Type.Object({ query: Type.String() }),
    replay: "safe",
    execute: async ({ query }) => {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model, tools: [{ type: "web_search" }], input: `${query}\nAnswer briefly and cite sources (URLs).` }),
      });
      const body = (await response.json()) as { output_text?: string; output?: { content?: { text?: string }[] }[]; error?: { message: string } };
      const text = body.output_text ?? body.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("");
      if (!response.ok || !text) return { output: [{ type: "text", text: `Search failed: ${body.error?.message ?? response.status}` }], isError: true };
      return { output: [{ type: "text", text }] };
    },
  });
