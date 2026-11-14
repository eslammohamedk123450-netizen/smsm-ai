import { parseAgentDecision, runAgentLoop, type AgentDecision } from "./orchestrator.ts";

Deno.test("parses only bounded provider-neutral JSON decisions", () => {
  const parsed = parseAgentDecision('{"action":"tool","tool":"connected_app.read","input":{"toolkit":"gmail"}}');
  if (parsed?.action !== "tool" || parsed.tool !== "connected_app.read") throw new Error("Expected a validated tool decision");
  if (parseAgentDecision("I will read your Gmail now") !== null) throw new Error("Plain prose must not become an executable tool decision");
  if (parseAgentDecision('{"action":"tool","tool":"../../send","input":{}}') !== null) throw new Error("Invalid tool names must be rejected");
});

Deno.test("loops from a tool result back to the planner before responding", async () => {
  const seen: string[] = [];
  const observedResults: unknown[] = [];
  let plans = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Find my latest email" }],
    tools: [{ name: "connected_app.read", description: "Read a connected app", effect: "read" }],
    async plan(messages): Promise<AgentDecision> {
      plans += 1;
      if (plans === 1) return { action: "tool", tool: "connected_app.read", input: { toolkit: "gmail" } };
      if (!messages.some((message) => message.content.includes("subject"))) throw new Error("Tool observation was not returned to the planner");
      return { action: "respond", answer: "The latest email is about the meeting." };
    },
    async execute(tool, input) {
      seen.push(`${tool}:${String(input.toolkit)}`);
      return { subject: "Meeting" };
    },
    onToolResult(_tool, _input, result) { observedResults.push(result); },
  });
  if (result.status !== "completed" || plans !== 2 || seen.length !== 1 || observedResults.length !== 1) throw new Error("Expected a two-step plan with one tool execution and one captured result");
  if ((observedResults[0] as { subject?: string }).subject !== "Meeting") throw new Error("The captured result did not match the tool output");
});

Deno.test("reports the tool lifecycle for start, completion, rejection and failure", async () => {
  const lifecycle: string[] = [];
  const inputs: unknown[] = [];
  let plans = 0;
  const completed = await runAgentLoop({
    messages: [{ role: "user", content: "Search" }],
    tools: [{ name: "web.search", description: "Search", effect: "read" }],
    async plan(): Promise<AgentDecision> {
      plans += 1;
      return plans === 1
        ? { action: "tool", tool: "web.search", input: { query: "prices" } }
        : { action: "respond", answer: "done" };
    },
    async execute() { return { results: [] }; },
    onToolStart(tool, input) { lifecycle.push(`start:${tool}`); inputs.push(input); },
    onToolResult(tool) { lifecycle.push(`result:${tool}`); },
    onToolError(tool) { lifecycle.push(`error:${tool}`); },
    onToolRejected(tool, _input, reason) { lifecycle.push(`rejected:${tool}:${reason}`); },
  });
  if (completed.status !== "completed") throw new Error("A successful tool step should complete");
  if (lifecycle.join(",") !== "start:web.search,result:web.search") throw new Error(`Unexpected lifecycle: ${lifecycle.join(",")}`);
  if ((inputs[0] as { query?: string }).query !== "prices") throw new Error("Tool input was not forwarded to the lifecycle callback");

  const rejected: string[] = [];
  const unregistered = await runAgentLoop({
    messages: [{ role: "user", content: "Do something unsafe" }],
    tools: [{ name: "web.search", description: "Search", effect: "read" }],
    async plan(): Promise<AgentDecision> { return { action: "tool", tool: "filesystem.delete", input: {} }; },
    async execute() { return null; },
    onToolRejected(tool, _input, reason) { rejected.push(`${tool}:${reason}`); },
  });
  if (unregistered.status !== "failed" || unregistered.reason !== "unknown_tool") throw new Error("An unregistered tool must fail closed");
  if (rejected[0] !== "filesystem.delete:tool_not_registered") throw new Error("The rejection was not reported for logging");
});

Deno.test("never executes a write tool before explicit confirmation", async () => {
  let executions = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Send this email" }],
    tools: [{ name: "gmail.send", description: "Send email", effect: "write" }],
    async plan(): Promise<AgentDecision> { return { action: "tool", tool: "gmail.send", input: { to: "a@example.com" } }; },
    async execute() { executions += 1; return { sent: true }; },
  });
  if (result.status !== "needs_confirmation" || executions !== 0) throw new Error("An unconfirmed write was executed");
});

Deno.test("caps the loop even if the planner repeats tool calls", async () => {
  let executions = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Search twice" }],
    tools: [{ name: "web.search", description: "Search", effect: "read" }],
    maxSteps: 3,
    async plan(): Promise<AgentDecision> { return { action: "tool", tool: "web.search", input: { query: "same" } }; },
    async execute() { executions += 1; return { results: [] }; },
  });
  if (result.status !== "failed" || result.reason !== "repeated_tool" || executions !== 1) throw new Error("Repeated tool calls were not blocked");
});

Deno.test("permits only one write attempt even when planner changes its input", async () => {
  let plans = 0;
  let executions = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Update a file" }],
    tools: [{ name: "connector.write", description: "Write", effect: "write" }],
    confirmedWrite: true,
    async plan(): Promise<AgentDecision> {
      plans += 1;
      if (plans === 1) return { action: "tool", tool: "connector.write", input: { item: "first" } };
      return { action: "tool", tool: "connector.write", input: { item: "different" } };
    },
    async execute() { executions += 1; return { successful: true }; },
  });
  if (result.status !== "failed" || result.reason !== "repeated_tool" || executions !== 1) throw new Error("A second write was not blocked");
});

Deno.test("returns a bounded failure when planning itself fails", async () => {
  let executions = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "hello" }],
    tools: [],
    async plan(): Promise<AgentDecision> { throw new Error("provider unavailable"); },
    async execute() { executions += 1; return null; },
  });
  if (result.status !== "failed" || result.reason !== "invalid_decision" || executions !== 0) throw new Error("Planning failure was not safely bounded");
});
