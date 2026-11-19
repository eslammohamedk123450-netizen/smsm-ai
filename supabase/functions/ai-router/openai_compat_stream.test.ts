import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyProviderAttemptFailure,
  extractOpenAiText,
  formatSseDataEvent,
  formatSseKeepAlive,
  providerStreamTimeoutMs,
  readOpenAiResponse,
} from "./openai_compat_stream.ts";

Deno.test("extracts JSON Chat Completions message content", () => {
  assertEquals(
    extractOpenAiText({ choices: [{ message: { role: "assistant", content: "Hello from JSON." } }] }),
    "Hello from JSON.",
  );
});

Deno.test("extracts array-based message content", () => {
  assertEquals(
    extractOpenAiText({
      choices: [{
        message: {
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "from an array." },
          ],
        },
      }],
    }),
    "Hello from an array.",
  );
});

Deno.test("extracts Responses API output_text", () => {
  assertEquals(extractOpenAiText({ output_text: "Hello from output_text." }), "Hello from output_text.");
});

Deno.test("extracts Anthropic-compatible text delta frames", () => {
  assertEquals(
    extractOpenAiText({ type: "content_block_delta", delta: { type: "text_delta", text: "Hello from Anthropic SSE." } }),
    "Hello from Anthropic SSE.",
  );
});

Deno.test("extracts nested gateway response envelopes", () => {
  assertEquals(
    extractOpenAiText({ response: { choices: [{ message: { content: "Wrapped gateway response." } }] } }),
    "Wrapped gateway response.",
  );
});

Deno.test("extracts Gemini candidate text parts", () => {
  assertEquals(
    extractOpenAiText({ candidates: [{ content: { parts: [{ text: "Hello " }, { text: "from Gemini." }] } }] }),
    "Hello from Gemini.",
  );
});

Deno.test("reads a normal application/json completion even when stream was requested", async () => {
  const response = new Response(JSON.stringify({
    choices: [{ message: { role: "assistant", content: "JSON fallback works." } }],
    usage: { prompt_tokens: 11, completion_tokens: 7 },
    x_billing: { cost_egp: 0.02 },
  }), { headers: { "content-type": "application/json" } });
  const usage: Array<[number | null, number | null, number | null]> = [];
  const chunks: string[] = [];
  for await (const chunk of readOpenAiResponse(response, (...values) => usage.push(values))) chunks.push(chunk);
  assertEquals(chunks, ["JSON fallback works."]);
  assertEquals(usage, [[11, 7, 0.02]]);
});

Deno.test("reads SSE delta content and usage", async () => {
  const response = new Response([
    'data: {"choices":[{"delta":{"content":"Hello "}}]}',
    'data: {"choices":[{"delta":{"content":"from SSE."}}]}',
    'data: {"choices":[],"usage":{"prompt_tokens":4,"completion_tokens":3}}',
    "data: [DONE]",
    "",
  ].join("\n"), { headers: { "content-type": "text/event-stream" } });
  const usage: Array<[number | null, number | null, number | null]> = [];
  const chunks: string[] = [];
  for await (const chunk of readOpenAiResponse(response, (...values) => usage.push(values))) chunks.push(chunk);
  assertEquals(chunks, ["Hello ", "from SSE."]);
  assertEquals(usage, [[4, 3, null]]);
});

Deno.test("reports provider finish_reason when an output reaches its token limit", async () => {
  const response = new Response([
    'data: {"choices":[{"delta":{"content":"<html><body>partial"}}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"length"}]}',
    "data: [DONE]",
    "",
  ].join("\n"), { headers: { "content-type": "text/event-stream" } });
  const finishReasons: string[] = [];
  const chunks: string[] = [];
  for await (const chunk of readOpenAiResponse(response, () => undefined, (reason) => finishReasons.push(reason))) chunks.push(chunk);
  assertEquals(chunks, ["<html><body>partial"]);
  assertEquals(finishReasons, ["length"]);
});

Deno.test("reads Anthropic-compatible SSE text deltas", async () => {
  const response = new Response([
    'event: content_block_delta',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello from "}}',
    "",
    'event: content_block_delta',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Anthropic."}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n"), { headers: { "content-type": "text/event-stream" } });
  const chunks: string[] = [];
  for await (const chunk of readOpenAiResponse(response, () => undefined)) chunks.push(chunk);
  assertEquals(chunks, ["Hello from ", "Anthropic."]);
});

Deno.test("structured provider errors are surfaced to the retry layer", async () => {
  const response = new Response(JSON.stringify({ error: { message: "upstream unavailable", code: "overloaded" } }), {
    headers: { "content-type": "application/json" },
  });
  let message = "";
  try {
    for await (const _chunk of readOpenAiResponse(response, () => undefined)) { /* no text expected */ }
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assertEquals(message, "provider_error: upstream unavailable");
});

Deno.test("reads SSE content arrays and legacy choice text", async () => {
  const response = new Response([
    'data: {"choices":[{"delta":{"content":[{"type":"text","text":"Array chunk."}]}}]}',
    'data: {"choices":[{"text":"Legacy text chunk."}]}',
    "data: [DONE]",
    "",
  ].join("\n"), { headers: { "content-type": "text/event-stream" } });
  const chunks: string[] = [];
  for await (const chunk of readOpenAiResponse(response, () => undefined)) chunks.push(chunk);
  assertEquals(chunks, ["Array chunk.", "Legacy text chunk."]);
});

Deno.test("empty provider responses are not mislabeled as timeouts", () => {
  assertEquals(
    classifyProviderAttemptFailure("provider returned no text", {
      cancelledByWinner: false,
      cancelledByRequest: false,
      raceDeadlineExpired: false,
    }),
    "empty",
  );
});

Deno.test("real timeouts and cancellations retain their status", () => {
  assertEquals(
    classifyProviderAttemptFailure("provider timed out after 15000ms", {
      cancelledByWinner: false,
      cancelledByRequest: false,
      raceDeadlineExpired: false,
    }),
    "timeout",
  );
  assertEquals(
    classifyProviderAttemptFailure("The signal has been aborted", {
      cancelledByWinner: true,
      cancelledByRequest: false,
      raceDeadlineExpired: false,
    }),
    "cancelled",
  );
  assertEquals(
    classifyProviderAttemptFailure("provider_http_503", {
      cancelledByWinner: false,
      cancelledByRequest: false,
      raceDeadlineExpired: false,
    }),
    "error",
  );
});


Deno.test("rejects an SSE stream that closes without a completion marker", async () => {
  const response = new Response([
    'data: {"choices":[{"delta":{"content":"partial output"}}]}',
    "",
  ].join("\n"), { headers: { "content-type": "text/event-stream" } });
  const chunks: string[] = [];
  let errorMessage = "";
  try {
    for await (const chunk of readOpenAiResponse(response, () => undefined)) chunks.push(chunk);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  assertEquals(chunks, ["partial output"]);
  assertEquals(errorMessage, "provider_stream_incomplete: stream closed before a completion marker");
});


Deno.test("accepts Anthropic message_stop as a complete stream", async () => {
  const response = new Response([
    'event: content_block_delta',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Complete answer."}}',
    "",
    'event: message_stop',
    'data: {"type":"message_stop"}',
    "",
  ].join("\n"), { headers: { "content-type": "text/event-stream" } });
  const chunks: string[] = [];
  for await (const chunk of readOpenAiResponse(response, () => undefined)) chunks.push(chunk);
  assertEquals(chunks, ["Complete answer."]);
});

Deno.test("recognizes Gemini MAX_TOKENS and preserves its final text", async () => {
  const response = new Response([
    'data: {"candidates":[{"content":{"parts":[{"text":"partial game code"}]},"finishReason":"MAX_TOKENS"}]}',
    "",
  ].join("\n"), { headers: { "content-type": "text/event-stream" } });
  const reasons: string[] = [];
  const chunks: string[] = [];
  for await (const chunk of readOpenAiResponse(response, () => undefined, reason => reasons.push(reason))) chunks.push(chunk);
  assertEquals(chunks, ["partial game code"]);
  assertEquals(reasons, ["length"]);
});



Deno.test("uses a bounded long timeout for code generation while preserving short chat limits", () => {
  assertEquals(providerStreamTimeoutMs(30000, 15000, false), 15000);
  assertEquals(providerStreamTimeoutMs(30000, 15000, true), 120000);
  assertEquals(providerStreamTimeoutMs(180000, 180000, true), 120000);
});

Deno.test("formats SSE keepalive comments without creating data events", () => {
  assertEquals(formatSseKeepAlive(), ": suly-keepalive\n\n");
});

Deno.test("serializes router events with real SSE frame delimiters", () => {
  const frame = formatSseDataEvent({ chunk: "hello", done: false });
  assertEquals(frame, 'data: {"chunk":"hello","done":false}\n\n');
  assertEquals(frame.split("\n").length, 3);
});
