import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseCentralAgentResult } from "./central_agent_result.ts";

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
