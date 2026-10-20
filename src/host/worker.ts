/** The Worker: routes API requests to a channel, which talks to the household's Durable Object.
 * The web app (web/) is served as static assets.
 * A new channel (Telegram, WhatsApp via Chat SDK) is one more file in src/channels/ and one line here. */
import { http } from "../channels/http.ts";

export { Household } from "./household.ts";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await http(request, env.HOUSEHOLDS, env.API_TOKEN)) ?? Response.json({ error: "not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
