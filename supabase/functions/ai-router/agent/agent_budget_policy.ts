export type AgentExecutionMode = "chat" | "agent";

export interface AgentReservationInput {
  executionMode: AgentExecutionMode;
  splitPartCount: number;
  maxPlannerSteps?: number;
  maxPlannerAttemptsPerStep?: number;
  maxWorkerAttemptsPerPart?: number;
}

/**
 * Upper-bound provider calls before execution so the credit hold covers the
 * bounded Agent loop or the delegated worker pool. Final settlement still
 * charges measured usage and releases any unused reservation.
 */
export function getAgentReservationCallCount(input: AgentReservationInput): number {
  const splitPartCount = Number.isSafeInteger(input.splitPartCount)
    ? Math.max(1, Math.min(5, input.splitPartCount))
    : 1;

  if (input.executionMode !== "agent") return 1;

  if (splitPartCount > 1) {
    const attempts = Number.isSafeInteger(input.maxWorkerAttemptsPerPart)
      ? Math.max(1, Math.min(3, input.maxWorkerAttemptsPerPart!))
      : 2;
    return splitPartCount * attempts;
  }

  const steps = Number.isSafeInteger(input.maxPlannerSteps)
    ? Math.max(1, Math.min(5, input.maxPlannerSteps!))
    : 5;
  const attempts = Number.isSafeInteger(input.maxPlannerAttemptsPerStep)
    ? Math.max(1, Math.min(3, input.maxPlannerAttemptsPerStep!))
    : 3;
  return steps * attempts;
}
