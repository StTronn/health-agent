/** read, ls, find, grep, write, edit, delete over the household's files: Cloudflare Computer's own
 * agent tools, wrapped as durable pi tools. Reads rerun after a crash; writes report "interrupted". */
import type { Workspace } from "@cloudflare/computer";
import { createPiTools } from "@cloudflare/computer/tools/pi-ai";
import { Type } from "@earendil-works/pi-ai";
import type { ToolRegistration } from "@earendil-works/pi-durable";

const READS = new Set(["read", "ls", "find", "grep"]);

export function fileTools(workspace: Workspace): ToolRegistration[] {
  const { tools, execute } = createPiTools({ workspace, root: "/", read: { maxLines: 400 } });
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: Type.Unsafe(tool.parameters),
    replay: READS.has(tool.name) ? "safe" : "unsafe",
    execute: async (args, api) => {
      const result = await execute({ id: api.callId, name: tool.name, arguments: args });
      return { output: result.content, isError: result.isError };
    },
  }));
}
