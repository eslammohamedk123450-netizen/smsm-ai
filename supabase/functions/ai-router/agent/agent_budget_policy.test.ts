import { getAgentReservationCallCount } from "./agent_budget_policy.ts";

Deno.test("Agent reservation covers all bounded planner attempts when no worker split is used", () => {
  const calls = getAgentReservationCallCount({ executionMode: "agent", splitPartCount: 1 });
  if (calls !== 15) throw new Error(`Expected 15 bounded planner calls, got ${calls}.`);
});

Deno.test("Agent reservation covers two attempts for every delegated worker part", () => {
  const calls = getAgentReservationCallCount({ executionMode: "agent", splitPartCount: 5 });
  if (calls !== 10) throw new Error(`Expected 10 bounded worker calls, got ${calls}.`);
});

Deno.test("chat reserves one provider call", () => {
  const calls = getAgentReservationCallCount({ executionMode: "chat", splitPartCount: 5 });
  if (calls !== 1) throw new Error(`Expected one chat call, got ${calls}.`);
});

Deno.test("reservation bounds caller-supplied limits", () => {
  const calls = getAgentReservationCallCount({
    executionMode: "agent",
    splitPartCount: 99,
    maxWorkerAttemptsPerPart: 99,
  });
  if (calls !== 15) throw new Error(`Expected the hard maximum of 15 calls, got ${calls}.`);
});
