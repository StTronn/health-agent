/** browse: one step of an errand in the family's cloud browser (Browser Use Cloud). One profile per
 * household keeps their logins; one session keeps pages open between calls until it expires. Both ids
 * live in a durable doc. Not replay-safe: a rerun could book or order twice. */
import { Type } from "@earendil-works/pi-ai";
import { defineDoc, defineTool, type ToolRegistration } from "@earendil-works/pi-durable";
import { BrowserUse, type SessionResponse } from "browser-use-sdk/v3";

const BrowserDoc = defineDoc<{ profileId?: string; sessionId?: string }>({
  kind: "app.browser", version: 1, scope: "session", initial: () => ({}),
});
const RULES = `You act for a family on health sites (lab tests, medicines). Work in the current tab if it's on the right site.
Stop and report instead of guessing when you need: an OTP or password, a login, any detail the task didn't give,
or a choice between options that matter (test package, slot, product, pack size). Never book, place an order or pay unless the
task says the family has confirmed it. When you stop, report: where you are, what you found (names, prices, slots, totals),
and exactly what you need next. Leave the page open; never close the tab.`;
const TIMEOUT_MS = 15 * 60_000;

const text = (t: string, isError = false) => ({ output: [{ type: "text" as const, text: t }], isError });

export function createBrowseTool(apiKey: string): ToolRegistration {
  const bu = new BrowserUse({ apiKey });
  return defineTool({
    name: "browse",
    description:
      "Do one step of an errand in the family's browser (logged-in sessions and open pages persist between calls). " +
      "Give a self-contained task: the site, what to do, the details to use, and where to stop. It stops and reports " +
      "when it needs an OTP, a login, a choice, or before booking or paying.",
    parameters: Type.Object({ task: Type.String() }),
    replay: "unsafe",
    execute: async ({ task }, api, context) => {
      const save = (ids: { profileId?: string; sessionId?: string }) =>
        api.commit(async (tx) => { Object.assign(await tx.doc(BrowserDoc), ids); }, context);
      try {
        const doc = (await api.snapshot(BrowserDoc, context)) ?? {};
        let profileId = doc.profileId;
        if (!profileId) await save({ profileId: (profileId = (await bu.profiles.create({ name: "household" })).id) });
        // Reuse the open session only while it's idle; a stopped, expired or broken one is replaced.
        const old = doc.sessionId ? await bu.sessions.get(doc.sessionId).catch(() => undefined) : undefined;
        let s: SessionResponse = await bu.sessions.create({
          task: `${RULES}\n\nTask: ${task}`, profileId, keepAlive: true, proxyCountryCode: "in",
          sessionId: old?.status === "idle" ? old.id : undefined,
        });
        await save({ sessionId: s.id });
        const live = s.liveUrl;
        const deadline = Date.now() + TIMEOUT_MS;
        do { // first wait before reading, so a just-dispatched follow-up isn't seen as still idle
          if (Date.now() > deadline) {
            await bu.sessions.stop(s.id, { strategy: "task" }).catch(() => {});
            return text(`The browser task didn't finish in 15 minutes and was stopped. Last step: ${s.lastStepSummary ?? "unknown"}`, true);
          }
          await new Promise((r) => setTimeout(r, 3000));
          s = await bu.sessions.get(s.id);
        } while (s.status === "created" || s.status === "running");
        if (s.status !== "idle") return text(`The browser session ended (${s.status}): ${String(s.output ?? s.lastStepSummary ?? "no details")}`, true);
        return text(`${String(s.output ?? "Finished without a report.")}\n\nLive view for the family (OTP, payment): ${s.liveUrl ?? live}`);
      } catch (e) {
        return text(`The browser failed: ${e instanceof Error ? e.message : String(e)}`, true);
      }
    },
  });
}
