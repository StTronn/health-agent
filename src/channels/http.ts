/** The HTTP channel: a JSON API for the CLI, evals and simple clients. Bearer-token auth.
 *   POST /api/households/:id/messages  {text, conversation?: "new" | number, requestId?} -> {reply, conversation, steps}
 *        with "stream": true -> newline-delimited JSON events as the agent works (see Household.stream)
 *   GET  /api/households/:id/outbox?after=<seq>                                      -> {messages}
 *   GET  /api/households/:id/files                                                   -> {files}
 *   PUT  /api/households/:id/files     {files, reset?}                               -> {ok} */
import type { Household } from "../host/household.ts";

const ROUTE = /^\/api\/households\/([\w-]{1,64})\/(messages|outbox|files)$/;

export async function http(request: Request, households: DurableObjectNamespace<Household>, token: string): Promise<Response | undefined> {
  const url = new URL(request.url);
  const match = ROUTE.exec(url.pathname);
  if (!match) return undefined;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const household = households.getByName(match[1]!);
  const body = request.method === "GET" ? {} : ((await request.json()) as Record<string, any>);
  switch (`${request.method} ${match[2]}`) {
    case "POST messages":
      if (typeof body.text !== "string" || !body.text.trim()) return Response.json({ error: "text required" }, { status: 400 });
      if (body.stream) return new Response(await household.stream(body.text, body.conversation, body.requestId), { headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache" } });
      return Response.json(await household.message(body.text, body.conversation, body.requestId));
    case "GET outbox":
      return Response.json({ messages: await household.outbox(Number(url.searchParams.get("after") ?? 0)) });
    case "GET files":
      return Response.json({ files: await household.files() });
    case "PUT files":
      await household.seed(body.files ?? {}, body.reset === true);
      return Response.json({ ok: true });
  }
  return Response.json({ error: "method not allowed" }, { status: 405 });
}
