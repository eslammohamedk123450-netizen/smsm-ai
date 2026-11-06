import { SseParser } from "./sse-parser";

describe("SseParser", () => {
  it("parses several events in one chunk and CRLF frames split across chunks", () => {
    const parser = new SseParser();
    expect(parser.push("data: {\"chunk\":\"Hello\"}\r\n\r")).toEqual([]);
    expect(parser.push("\ndata: {\"chunk\":\" world\"}\r\n\r\ndata: {\"done\":true}\r\n\r\n")).toEqual([
      { type: "chunk", text: "Hello" },
      { type: "chunk", text: " world" },
      { type: "done" },
    ]);
    expect(parser.finish()).toEqual([]);
  });

  it("supports LF frames and multiline data fields", () => {
    const parser = new SseParser();
    expect(parser.push("data: {\"chunk\":\ndata: \"text\"}\n\n")).toEqual([
      { type: "chunk", text: "text" },
    ]);
  });

  it("converts server error payloads into explicit error events", () => {
    const parser = new SseParser();
    expect(parser.push("data: {\"error\":\"interrupted\"}\n\n")).toEqual([
      { type: "error", message: "interrupted" },
    ]);
  });

  it("rejects malformed JSON instead of silently dropping it", () => {
    const parser = new SseParser();
    expect(() => parser.push("data: {bad json}\n\n")).toThrow("invalid SSE data event");
  });
});
