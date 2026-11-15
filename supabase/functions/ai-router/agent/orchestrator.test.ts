import { parseAgentDecision, runAgentLoop, type AgentTool } from "./orchestrator.ts";
import { getAgentToolsFromDatabase, getRegisteredTool, validateToolInput } from "./tool_registry.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("parseAgentDecision accepts bounded decisions and rejects malformed tool input", () => {
  const response = parseAgentDecision('{"action":"respond","answer":"Done"}');
  assert(response?.action === "respond", "valid response decision should parse");

  const tool = parseAgentDecision('{"action":"tool","tool":"web.search","input":{"query":"latest docs"}}');
  assert(tool?.action === "tool", "valid tool decision should parse");

  assertEqual(parseAgentDecision('{"action":"tool","tool":"web.search","input":[]}'), null, "array input must be rejected");
  assertEqual(parseAgentDecision("not json"), null, "invalid JSON must be rejected");
});

Deno.test("write tools require explicit confirmation before execution", async () => {
  const tool: AgentTool = {
    name: "external.write",
    description: "Write to an external service",
    effect: "write",
    requiresApproval: true,
    available: true,
    inputSchema: { type: "object", additionalProperties: false },
  };
  let executions = 0;
  let rejection = "";

  const result = await runAgentLoop({
    messages: [{ role: "user", content: "send this message" }],
    tools: [tool],
    plan: async () => ({ action: "tool", tool: "external.write", input: {} }),
    execute: async () => { executions += 1; return { status: "sent" }; },
    onToolRejected: async (_name, _input, reason) => { rejection = reason; },
  });

  assertEqual(result.status, "needs_confirmation", "write should pause for confirmation");
  assertEqual(executions, 0, "write executor must not run before confirmation");
  assertEqual(rejection, "approval_required", "rejection reason should be explicit");
});

Deno.test("read tool results are added as untrusted evidence before the next plan", async () => {
  const tool: AgentTool = {
    name: "web.search",
    description: "Search public web pages",
    effect: "read",
    available: true,
  };
  let planningCalls = 0;
  let observedEvidence = false;
  let executions = 0;

  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Find official docs" }],
    tools: [tool],
    plan: async (history) => {
      planningCalls += 1;
      if (planningCalls === 1) return { action: "tool", tool: "web.search", input: { query: "official docs" } };
      observedEvidence = history.some((message) => message.content.includes("untrusted reference data"));
      return { action: "respond", answer: "The verified result is ready." };
    },
    execute: async () => {
      executions += 1;
      return { title: "Official documentation" };
    },
  });

  assertEqual(result.status, "completed", "loop should finish after the follow-up response");
  assertEqual(executions, 1, "read tool should execute once");
  assert(observedEvidence, "the second planning turn must receive explicitly untrusted tool evidence");
});

Deno.test("repeating the same tool call is stopped", async () => {
  const tool: AgentTool = {
    name: "web.search",
    description: "Search public web pages",
    effect: "read",
    available: true,
  };
  let executions = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Search twice" }],
    tools: [tool],
    maxSteps: 3,
    plan: async () => ({ action: "tool", tool: "web.search", input: { query: "same query" } }),
    execute: async () => { executions += 1; return { ok: true }; },
  });

  assertEqual(result.status, "failed", "repeated execution should fail closed");
  assert(result.status === "failed" && result.reason === "repeated_tool", "failure reason should identify repeated tool call");
  assertEqual(executions, 1, "the repeated tool call must not execute twice");
});

Deno.test("database tool flags cannot introduce adapters or weaken write approval", async () => {
  const supabase = {
    from: (_table: string) => ({
      select: async (_columns: string) => ({
        data: [{ name: "connected_app.write", enabled: true, effect: "read", requires_approval: false }],
        error: null,
      }),
    }),
  };

  const tools = await getAgentToolsFromDatabase(supabase);
  const writeTool = tools.find((tool) => tool.name === "connected_app.write");
  assert(writeTool, "known write adapter should remain registered");
  assertEqual(writeTool.effect, "write", "database data must not downgrade write effects");
  assertEqual(writeTool.requiresApproval, true, "database data must not disable approval");

  const unknownTool = getRegisteredTool("admin.delete_everything");
  assertEqual(unknownTool, null, "database flags must not create executable adapters");

  const readTool = getRegisteredTool("connected_app.read");
  assert(readTool, "read adapter should be present");
  assert(validateToolInput(readTool, { toolkit: "gmail" }), "valid read input should pass");
  assert(!validateToolInput(readTool, {}), "required toolkit must be enforced");
  assert(!validateToolInput(readTool, { toolkit: "gmail", extra: true }), "unknown object properties must be rejected");

  const webTool = getRegisteredTool("web.search");
  assert(webTool, "web search adapter should be present");
  assert(validateToolInput(webTool, { query: "official documentation" }), "valid search query should pass");
  assert(!validateToolInput(webTool, { query: "" }), "empty search query must be rejected");
  assert(!validateToolInput(webTool, { query: "docs", extra: "value" }), "additional search fields must be rejected");
});

Deno.test("tool registry database failure is fail-closed", async () => {
  const supabase = {
    from: (_table: string) => ({
      select: async (_columns: string) => ({
        data: null,
        error: { message: "temporary database failure" },
      }),
    }),
  };

  let thrown = false;
  try {
    await getAgentToolsFromDatabase(supabase);
  } catch (error) {
    thrown = error instanceof Error && error.message === "agent_tool_registry_unavailable";
  }
  assert(thrown, "registry read failure must prevent Agent execution");
});


Deno.test("Agent cancellation before planning starts no model or tool work", async () => {
  let planCalls = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "do work" }],
    tools: [],
    isCancelled: async () => true,
    plan: async () => { planCalls += 1; return { action: "respond", answer: "should not run" }; },
    execute: async () => null,
  });
  assertEqual(result.status, "cancelled", "cancelled task status");
  assertEqual(planCalls, 0, "no planner call after cancellation");
});

Deno.test("Agent cancellation during planning waits for the provider result and starts no tool", async () => {
  let checks = 0;
  let executions = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "do work" }],
    tools: [{ name: "web.search", description: "search", effect: "read", available: true }],
    isCancelled: async () => { checks += 1; return checks >= 2; },
    plan: async () => ({ action: "tool", tool: "web.search", input: { query: "x" } }),
    execute: async () => { executions += 1; return {}; },
  });
  assertEqual(result.status, "cancelled", "cancelled task status");
  assertEqual(executions, 0, "tool must not start after planner finishes under cancellation");
});

Deno.test("Agent cancellation during a tool finishes that tool then starts no next step", async () => {
  let checks = 0;
  let executions = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "do work" }],
    tools: [{ name: "web.search", description: "search", effect: "read", available: true }],
    isCancelled: async () => { checks += 1; return checks >= 3; },
    plan: async (_history, _tools, index) => index === 0
      ? { action: "tool", tool: "web.search", input: { query: "x" } }
      : { action: "respond", answer: "done" },
    execute: async () => { executions += 1; return { ok: true }; },
  });
  assertEqual(result.status, "cancelled", "cancelled task status");
  assertEqual(executions, 1, "in-flight tool is allowed to finish exactly once");
  assertEqual(result.steps.filter((step) => step.status === "completed").length, 1, "completed tool step is retained");
});


Deno.test("Agent loop resumes a completed tool checkpoint without replaying the tool", async () => {
  const tool: AgentTool = {
    name: "web.search",
    description: "Search public web pages",
    effect: "read",
    available: true,
  };
  let executions = 0;
  let planningCalls = 0;
  let replayedEvidence = false;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Find official docs" }],
    tools: [tool],
    resumeSteps: new Map([[0, {
      decision: { action: "tool", tool: "web.search", input: { query: "official docs" } },
      toolResultStatus: "completed" as const,
      toolResult: { title: "Persisted official docs" },
    }]]),
    plan: async (history, _tools, step) => {
      planningCalls += 1;
      if (step !== 1) throw new Error("The completed step should not be replanned.");
      replayedEvidence = history.some((message) => message.content.includes("Persisted official docs"));
      return { action: "respond", answer: "Resumed successfully." };
    },
    execute: async () => { executions += 1; return { title: "should not execute" }; },
  });
  assertEqual(result.status, "completed", "resumed loop should finish");
  assertEqual(executions, 0, "completed tool must not be replayed");
  assertEqual(planningCalls, 1, "only the next planner step should run");
  assert(replayedEvidence, "saved tool output must be restored as untrusted evidence");
});

Deno.test("Agent loop reuses a saved decision when interruption happened before tool completion", async () => {
  const tool: AgentTool = {
    name: "web.search",
    description: "Search public web pages",
    effect: "read",
    available: true,
  };
  let executions = 0;
  let planningCalls = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Find official docs" }],
    tools: [tool],
    resumeSteps: new Map([[0, {
      decision: { action: "tool", tool: "web.search", input: { query: "official docs" } },
    }]]),
    plan: async (_history, _tools, step) => {
      planningCalls += 1;
      return step === 1
        ? { action: "respond", answer: "Recovered." }
        : { action: "respond", answer: "Unexpected replan." };
    },
    execute: async () => { executions += 1; return { title: "Recovered result" }; },
  });
  assertEqual(result.status, "completed", "saved decision should resume");
  assertEqual(executions, 1, "unfinished read step should execute once");
  assertEqual(planningCalls, 1, "saved decision must bypass a second planner call");
});


Deno.test("Agent checkpoint persistence errors are not misclassified as tool failures", async () => {
  let toolErrors = 0;
  let rejected = false;
  try {
    await runAgentLoop({
      messages: [{ role: "user", content: "read data" }],
      tools: [{ name: "web.search", description: "search", effect: "read", available: true }],
      plan: async () => ({ action: "tool", tool: "web.search", input: { query: "docs" } }),
      execute: async () => ({ result: "done" }),
      onToolResult: async () => { throw new Error("checkpoint_write_failed"); },
      onToolError: async () => { toolErrors += 1; },
    });
  } catch (error) {
    rejected = error instanceof Error && error.message === "checkpoint_write_failed";
  }
  assert(rejected, "checkpoint persistence failure must escape the loop for safe worker retry");
  assertEqual(toolErrors, 0, "checkpoint failure must not be reported as external tool failure");
});
