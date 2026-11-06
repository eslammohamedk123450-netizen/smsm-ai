export type RouterSseEvent =
  | { type: "chunk"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

function parseBlock(block: string): RouterSseEvent | null {
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    if (field !== "data") continue;
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  const payload = dataLines.join("\n");
  if (payload === "[DONE]") return { type: "done" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("The chat service returned an invalid SSE data event.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The chat service returned an unsupported SSE event.");
  }
  const value = parsed as Record<string, unknown>;
  if (typeof value.error === "string" && value.error.length > 0) {
    return { type: "error", message: value.error };
  }
  if (typeof value.chunk === "string") return { type: "chunk", text: value.chunk };
  if (value.done === true) return { type: "done" };
  throw new Error("The chat service returned an unrecognized SSE event.");
}

export class SseParser {
  private buffer = "";

  push(text: string): RouterSseEvent[] {
    this.buffer += text;
    const events: RouterSseEvent[] = [];
    while (true) {
      const separator = /\r?\n\r?\n/.exec(this.buffer);
      if (!separator || separator.index === undefined) break;
      const block = this.buffer.slice(0, separator.index);
      this.buffer = this.buffer.slice(separator.index + separator[0].length);
      const event = parseBlock(block);
      if (event) events.push(event);
    }
    return events;
  }

  finish(): RouterSseEvent[] {
    const remainder = this.buffer;
    this.buffer = "";
    if (!remainder.trim()) return [];
    const event = parseBlock(remainder);
    return event ? [event] : [];
  }
}
