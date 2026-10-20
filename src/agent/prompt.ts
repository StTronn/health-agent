/** The system prompt: who it is (SOUL.md), how it works (prompt.md), the clock, the skills it can open,
 * and the household index (family/MEMORY.md), re-read before every model request. */
import type { Workspace } from "@cloudflare/computer";
import { section } from "@earendil-works/pi-durable";
import soul from "../../SOUL.md?raw";
import howItWorks from "../../prompt.md?raw";

const frontmatter = (text: string, key: string) => new RegExp(`^${key}:\\s*(.+)$`, "m").exec(text)?.[1]?.trim();

export const sections = (ws: Workspace) => {
  // Skills only change on deploy, which restarts the object, so list them once.
  let skills: Promise<string> | undefined;
  const listSkills = async () => {
    const lines = [];
    for (const path of (await ws.fs.ls("/skills/")).filter((p) => p.endsWith("/SKILL.md"))) {
      const skill = await ws.fs.readFile(path, "utf8");
      lines.push(`- ${frontmatter(skill, "name")} (${path}): ${frontmatter(skill, "description")}`);
    }
    return `Skills: open a skill's SKILL.md with \`read\` when its description fits, then follow it.\n${lines.join("\n")}`;
  };
  return [
  section("soul", () => soul, { tag: false }),
  section("how-you-work", () => howItWorks, { tag: false }),
  // Minute precision keeps the prompt cache warm.
  section("clock", () => `Now: ${new Date().toISOString().slice(0, 16)}Z. Use the household's timezone for times you give or schedule.`, { tag: false }),
  section("skills", () => (skills ??= listSkills())),
  section("memory", async () => `Files: /family is your memory (read and write), /skills is read-only.\n\n/family/MEMORY.md:\n${await ws.fs.readFile("/family/MEMORY.md", "utf8").catch(() => "(empty)")}`),
  ];
};
