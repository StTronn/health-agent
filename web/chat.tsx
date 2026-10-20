import { CalendarClock, CircleAlert, HeartPulse, LogOut, RotateCcw, SquarePen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { call, type Checkin, type Session, type Step, stream } from "@/lib/api";

type Item = { id: string; role: "user" | "assistant"; text: string; steps?: Step[]; checkin?: boolean; error?: boolean; retry?: string; requestId?: string };

const SUGGESTIONS = [
  "My son has had a fever since last night",
  "Can papa take ibuprofen for his knee?",
  "Book an HbA1c test for papa",
  "Order paracetamol syrup for the little one",
];

// Conversations live on the server; this keeps what this browser has seen so a reload shows it.
const load = (key: string): { conversation: number | "new"; items: Item[] } => {
  try { return JSON.parse(localStorage.getItem(key) ?? "") } catch { return { conversation: "new", items: [] } }
};

const toolLabel = (step: Step) => ({ read: "read", write: "wrote", edit: "updated", grep: "searched", ls: "looked", find: "looked",
  triage: "triage", escalate: "escalated", schedule: "scheduled a check-in", browse: "browser", web_search: "web search" })[step.name] ?? step.name;

/** One short line about what the agent is doing right now. */
const activity = ({ name, arg }: Step) => {
  const who = arg.match(/members\/([^/.]+)/)?.[1];
  const file = who ? `${who[0].toUpperCase()}${who.slice(1)}'s file` : arg.includes("home-care") ? "the home-care guide"
    : arg.includes("errands") ? "the errands guide" : arg.includes("MEMORY") ? "family memory" : "the family notes";
  return ({ read: `Reading ${file}`, ls: "Looking through the family notes", find: "Looking through the family notes", grep: "Searching the family notes",
    write: "Updating memory", edit: "Updating memory", delete: "Updating memory", triage: "Running triage", escalate: "Escalating",
    schedule: "Scheduling a check-in", browse: "Working in the browser…", web_search: "Searching the web" } as Record<string, string>)[name] ?? "Working…";
};

const noLinkModal = { enabled: false }; // plain <a target="_blank"> links

/** Replies take seconds; browser errands take minutes. Show that time is passing and why. */
function Waiting({ live }: { live: { activity?: string; text: string } }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const slow = seconds >= 20;
  return (
    <Message from="assistant" data-waiting aria-live="polite">
      <MessageContent>
        <div className="flex items-center gap-2">
          <Shimmer as="span">{slow ? "Still working on it…" : "Thinking…"}</Shimmer>
          <span className="text-muted-foreground text-xs tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
        </div>
        {live.text ? <MessageResponse className="leading-relaxed" linkSafety={noLinkModal}>{live.text}</MessageResponse>
          : live.activity && <p className="text-muted-foreground text-sm">{live.activity}</p>}
        {slow && !live.text && (
          <p className="max-w-md text-muted-foreground text-xs">
            Booking tests and ordering medicines happen in a real browser and can take several minutes. Keep this tab open; the reply will appear here.
          </p>
        )}
      </MessageContent>
    </Message>
  );
}

export function Chat({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const key = `chat:${session.household}`;
  const [state, setState] = useState(() => load(key));
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ activity?: string; text: string }>({ text: "" });
  const seen = useRef<number | null>(null);

  useEffect(() => localStorage.setItem(key, JSON.stringify(state)), [key, state]);
  const add = (item: Item) => setState((s) => ({ ...s, items: [...s.items, item] }));

  // Check-ins the agent scheduled for itself arrive in the outbox.
  useEffect(() => {
    const poll = async () => {
      const { messages } = await call<{ messages: Checkin[] }>(session, `outbox?after=${seen.current ?? 0}`).catch(() => ({ messages: [] }));
      for (const m of messages) if (seen.current !== null) add({ id: `checkin-${m.seq}`, role: "assistant", text: m.text, checkin: true });
      seen.current = messages.at(-1)?.seq ?? seen.current ?? 0;
    };
    void poll();
    const timer = setInterval(poll, 15_000);
    return () => clearInterval(timer);
  }, [session]);

  const ask = async (text: string, requestId: string = crypto.randomUUID()) => {
    setBusy(true);
    setLive({ text: "" });
    try {
      const r = await stream(session, { text, conversation: state.conversation, requestId }, (e) => {
        if (e.type === "conversation") setState((s) => ({ ...s, conversation: e.conversation }));
        if (e.type === "tool") setLive({ activity: activity(e), text: "" });
        if (e.type === "reset") setLive((l) => ({ ...l, text: "" }));
        if (e.type === "text") setLive((l) => ({ ...l, text: l.text + e.delta }));
      });
      setState((s) => ({ conversation: r.conversation, items: [...s.items, { id: crypto.randomUUID(), role: "assistant", text: r.reply, steps: r.steps }] }));
    } catch (e) {
      add({ id: crypto.randomUUID(), role: "assistant", text: (e as Error).message, error: true, retry: text, requestId });
    } finally {
      setBusy(false);
    }
  };
  const send = (text: string) => {
    if (!text.trim() || busy) return;
    add({ id: crypto.randomUUID(), role: "user", text });
    void ask(text);
  };
  const retry = (item: Item) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }));
    void ask(item.retry!, item.requestId);
  };

  return (
    <main className="flex h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><HeartPulse className="size-4" /></div>
            <span className="truncate font-medium">Family Health</span>
            <Badge variant="secondary" className="max-w-32 truncate font-mono">{session.household}</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setState({ conversation: "new", items: [] })}>
              <SquarePen /> New chat
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Sign out" title="Sign out" onClick={onSignOut}><LogOut /></Button>
          </div>
        </div>
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto min-h-full w-full max-w-3xl px-4 py-6">
          {state.items.length === 0 && !busy ? (
            <ConversationEmptyState className="flex-1">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted"><HeartPulse className="size-6" /></div>
              <div className="flex max-w-sm flex-col gap-1">
                <h2 className="font-medium text-lg">How is everyone doing?</h2>
                <p className="text-muted-foreground text-sm">Tell me what's going on with anyone in the family. I can also book lab tests and order medicines.</p>
              </div>
            </ConversationEmptyState>
          ) : (
            state.items.map((item) => (
              <Message from={item.role} key={item.id}>
                {item.error ? (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertTitle>Couldn't get a reply</AlertTitle>
                    <AlertDescription>{item.text}</AlertDescription>
                    {item.retry && (
                      <AlertAction>
                        <Button variant="outline" size="xs" disabled={busy} onClick={() => retry(item)}><RotateCcw /> Retry</Button>
                      </AlertAction>
                    )}
                  </Alert>
                ) : (
                  <MessageContent>
                    {item.checkin && <Badge variant="outline" className="w-fit"><CalendarClock /> Check-in</Badge>}
                    {item.role === "user" ? <p className="whitespace-pre-wrap">{item.text}</p>
                      : <MessageResponse className="leading-relaxed" linkSafety={noLinkModal}>{item.text}</MessageResponse>}
                    {!!item.steps?.length && (
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(item.steps.map(toolLabel))].map((label) => (
                          <Badge key={label} variant="secondary" className="font-normal text-muted-foreground">{label}</Badge>
                        ))}
                      </div>
                    )}
                  </MessageContent>
                )}
              </Message>
            ))
          )}
          {busy && <Waiting live={live} />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-3">
        {state.items.length === 0 && !busy && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <Suggestion key={s} suggestion={s} onClick={send} className="h-auto justify-start whitespace-normal rounded-lg py-2 text-left font-normal" />
            ))}
          </div>
        )}
        <PromptInput onSubmit={({ text }) => send(text)}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask about anyone in the family…" />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit status={busy ? "submitted" : undefined} disabled={busy} />
          </PromptInputFooter>
        </PromptInput>
        <p className="text-center text-muted-foreground text-xs">Not a substitute for a doctor. In an emergency, call your local emergency number.</p>
      </div>
    </main>
  );
}
