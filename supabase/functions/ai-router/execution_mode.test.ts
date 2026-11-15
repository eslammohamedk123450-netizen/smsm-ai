import { resolveExecutionMode } from "./execution_mode.ts";

const base = {
  requestedMode: "auto" as const,
  intent: "chat" as const,
  hasConnectorRequest: false,
  hasAttachments: false,
  requiresLiveSearch: false,
  internalBrainCall: false,
};

Deno.test("auto mode routes conversational and single-reply requests directly", () => {
  if (resolveExecutionMode(base) !== "chat") throw new Error("chat intent should use direct chat");
  if (resolveExecutionMode({ ...base, intent: "simple_task" }) !== "chat") throw new Error("single-reply task should use direct chat");
});

Deno.test("auto mode retains Agent for complex, tool, attachment, and live-search work", () => {
  const cases = [
    { ...base, intent: "complex_task" as const },
    { ...base, hasConnectorRequest: true },
    { ...base, hasAttachments: true },
    { ...base, requiresLiveSearch: true },
    { ...base, internalBrainCall: true },
  ];
  for (const input of cases) {
    if (resolveExecutionMode(input) !== "agent") throw new Error("complex or tool-backed work must use Agent");
  }
});

Deno.test("explicit and legacy modes remain backward compatible", () => {
  if (resolveExecutionMode({ ...base, requestedMode: "chat" }) !== "chat") throw new Error("explicit chat must remain chat");
  if (resolveExecutionMode({ ...base, requestedMode: "agent" }) !== "agent") throw new Error("explicit agent must remain agent");
  if (resolveExecutionMode({ ...base, requestedMode: undefined }) !== "agent") throw new Error("legacy requests must remain Agent-compatible");
});
