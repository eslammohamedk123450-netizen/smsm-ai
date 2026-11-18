import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyProviderAttemptFailure,
  extractOpenAiText,
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

Deno.test("reads SSE content arrays and legacy choice text", async () => {
  const response = new Response([
    'data: {"choices":[{"delta":{"content":[{"type":"text","text":"Array chunk."}]}}]}',
    'data: {"choices":[{"text":"Legacy text chunk."}]}',
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
