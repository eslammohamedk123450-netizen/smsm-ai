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

  it("parses the actual routed model identifier without treating it as user text", () => {
    const parser = new SseParser();
    expect(parser.push("data: {\"chunk\":\"Hello\",\"model\":\"openai/gpt-oss-120b\",\"model_id\":7,\"route\":\"free_race\"}\n\n")).toEqual([
      { type: "chunk", text: "Hello", modelIdentifier: "openai/gpt-oss-120b" },
    ]);
  });

  it("does not present the Agent router label as a concrete model", () => {
    const parser = new SseParser();
    expect(parser.push("data: {\"chunk\":\"Working\",\"model\":\"agent\"}\n\n")).toEqual([
      { type: "chunk", text: "Working" },
    ]);
  });

  it("converts server error payloads into explicit error events", () => {
    const parser = new SseParser();
    expect(parser.push("data: {\"error\":\"interrupted\"}\n\n")).toEqual([
      { type: "error", message: "interrupted" },
    ]);
  });

  it("ignores SSE keepalive comments without creating chat events", () => {
    const parser = new SseParser();
    expect(parser.push(": suly-keepalive\n\n")).toEqual([]);
    expect(parser.push("data: {\\"chunk\\":\\"still working\\"}\n\n")).toEqual([
      { type: "chunk", text: "still working" },
    ]);
  });

  it("rejects malformed JSON instead of silently dropping it", () => {
    const parser = new SseParser();
    expect(() => parser.push("data: {bad json}\n\n")).toThrow("invalid SSE data event");
  });
});
