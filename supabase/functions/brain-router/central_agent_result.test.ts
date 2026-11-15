import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseCentralAgentResult, toBrainTaskStepRows } from "./central_agent_result.ts";

Deno.test("central Agent result parses response, usage, and completed steps", () => {
  const result = parseCentralAgentResult({
    response: { choices: [{ message: { content: "  تم إنجاز المهمة  " } }] },
    usage: { input_tokens: "120", output_tokens: 45 },
    agent_steps: [
      { index: 0, kind: "planning", status: "completed" },
      { index: 1, kind: "tool", tool: "web.search", status: "completed" },
      { index: 2, kind: "final", status: "completed" },
    ],
  });
  assertNotEquals(result, null);
  assertEquals(result?.response, "تم إنجاز المهمة");
  assertEquals(result?.inputTokens, 120);
  assertEquals(result?.outputTokens, 45);
  assertEquals(result?.completedSteps, 3);
  assertEquals(result?.estimatedSteps, 3);
  assertEquals(result?.complexity, "complex");
  assertEquals(result?.capabilities, ["text", "web_search"]);
});

Deno.test("central Agent result rejects empty or malformed assistant output", () => {
  assertEquals(parseCentralAgentResult({ response: { choices: [] } }), null);
  assertEquals(parseCentralAgentResult({ response: { choices: [{ message: { content: " " } }] } }), null);
  assertEquals(parseCentralAgentResult(null), null);
});

Deno.test("invalid usage values safely become zero", () => {
  const result = parseCentralAgentResult({
    response: { choices: [{ message: { content: "ok" } }] },
    usage: { input_tokens: -10, output_tokens: "not-a-number" },
  });
  assertEquals(result?.inputTokens, 0);
  assertEquals(result?.outputTokens, 0);
});

Deno.test("central Agent steps map to the Brain progress table contract", () => {
  const rows = toBrainTaskStepRows("task-1", [
    { index: 0, kind: "planning", status: "completed" },
    { index: 1, kind: "tool", tool: "web.search", status: "completed" },
    { index: 2, kind: "final", status: "completed" },
  ]);
  assertEquals(rows.length, 3);
  assertEquals(rows[0].step_index, 1);
  assertEquals(rows[0].capability_key, "reasoning");
  assertEquals(rows[1].capability_key, "web_search");
  assertEquals(rows[1].status, "completed");
  assertEquals(rows[2].description, "صياغة النتيجة النهائية");
});

Deno.test("central Agent progress always contains at least one safe display step", () => {
  const rows = toBrainTaskStepRows("task-2", []);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].capability_key, "text");
  assertEquals(rows[0].status, "completed");
});

Deno.test("empty failed Agent output maps to a failed progress step", () => {
  const rows = toBrainTaskStepRows("task-3", [], "failed");
  assertEquals(rows.length, 1);
  assertEquals(rows[0].status, "failed");
});

Deno.test("failed central Agent responses retain provider usage without a final answer", () => {
  const result = parseCentralAgentResult({
    error: "No worker result",
    usage: { input_tokens: 250, output_tokens: 0 },
  });
  assertNotEquals(result, null);
  assertEquals(result?.response, "");
  assertEquals(result?.inputTokens, 250);
  assertEquals(result?.outputTokens, 0);
});

Deno.test("delegated worker steps receive clear progress descriptions", () => {
  const rows = toBrainTaskStepRows("task-4", [{ kind: "worker", status: "completed" }]);
  assertEquals(rows[0].description, "تنفيذ الجزء 1 بواسطة Worker");
  assertEquals(rows[0].capability_key, "text");
});


Deno.test("central Agent cancellation retains status and usage even without a final answer envelope", () => {
  const result = parseCentralAgentResult({
    agent_status: "cancelled",
    response: "تم إيقاف المهمة.",
    usage: { input_tokens: 90, output_tokens: 20 },
  });
  assertNotEquals(result, null);
  assertEquals(result?.status, "cancelled");
  assertEquals(result?.inputTokens, 90);
  assertEquals(result?.outputTokens, 20);
});

Deno.test("cancelled Agent steps remain cancelled in durable Brain progress", () => {
  const rows = toBrainTaskStepRows("task-cancelled", [
    { index: 0, kind: "planning", status: "completed" },
    { index: 1, kind: "tool", tool: "web.search", status: "cancelled" },
  ], "cancelled");
  assertEquals(rows[0].status, "completed");
  assertEquals(rows[1].status, "cancelled");
});
