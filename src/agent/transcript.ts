/** The visible text of a transcript entry. */
import type { Message } from "@earendil-works/pi-ai";
import type { EntryRecord } from "@earendil-works/pi-durable";

export const textOf = (messages: readonly Message[]): string =>
  messages
    .flatMap((m) => (typeof m.content === "string" ? [m.content] : m.content.map((c) => (c.type === "text" ? c.text : ""))))
    .join("")
    .trim();

export const text = (entry: EntryRecord | undefined): string => textOf(entry?.model ?? []);
