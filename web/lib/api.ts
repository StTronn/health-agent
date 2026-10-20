/** Client for the HTTP channel (src/channels/http.ts). */
export type Step = { name: string; arg: string };
export type Reply = { reply: string; conversation: number; steps: Step[] };
export type Checkin = { seq: number; at: string; text: string; conversation: number };
export type Session = { household: string; token: string };

export async function call<T>(session: Session, path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/households/${encodeURIComponent(session.household)}/${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
    body: body && JSON.stringify(body),
  }).catch(() => { throw new Error("Couldn't reach Family Health. Check your connection and try again.") });
  if (response.status === 401) throw new Error("That access key didn't work. Check it and try again.");
  if (!response.ok) throw new Error(`The server had a problem (${response.status}). Please try again in a moment.`);
  return response.json() as Promise<T>;
}

export type Event =
  | { type: "conversation"; conversation: number } | { type: "tool"; name: string; arg: string } | { type: "reset" }
  | { type: "text"; delta: string } | ({ type: "done" } & Reply) | { type: "error"; message: string };

/** Sends a message and calls `on` for each event as the agent works. If the connection drops or the server
 * restarts, it re-sends the same request (same requestId, so the server resumes rather than re-runs). */
export async function stream(session: Session, body: { text: string; conversation: number | "new"; requestId: string }, on: (e: Event) => void): Promise<Reply> {
  const waits = [2000, 5000, 10000];
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`/api/households/${encodeURIComponent(session.household)}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
        body: JSON.stringify({ ...body, stream: true }),
      });
      if (response.status === 401) throw Object.assign(new Error("That access key didn't work. Check it and try again."), { fatal: true });
      if (!response.ok || !response.body) throw new Error(`The server had a problem (${response.status}). Please try again in a moment.`);
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (let buffer = ""; ;) {
        const { value, done } = await reader.read();
        if (done) throw new Error("The connection dropped before the reply finished. Please try again.");
        const lines = (buffer += value).split("\n");
        buffer = lines.pop()!;
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as Event;
          if (event.type === "error") throw new Error("Something went wrong while answering. Please try again.");
          if (event.type === "conversation") body = { ...body, conversation: event.conversation }; // a retry continues this conversation
          on(event);
          if (event.type === "done") return event;
        }
      }
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal || attempt === waits.length) throw e instanceof TypeError ? new Error("Couldn't reach Family Health. Check your connection and try again.") : e;
      await new Promise((r) => setTimeout(r, waits[attempt]));
    }
  }
}
