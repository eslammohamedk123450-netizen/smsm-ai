export type AgentUsageAttemptStatus = "success" | "error" | "timeout" | "empty" | "cancelled";
export type AgentUsageStage = "started" | "finished";

export type AgentUsageLedgerRecord = {
  inputTokens: number | null;
  outputTokens: number | null;
  actualCost: number | null;
  usageStatus: "completed" | "partial" | "unknown";
  usageSource: "provider_reported" | "provider_reported_partial" | "unavailable";
};

/** Build a ledger record only from explicit provider usage; estimates never become billable usage. */
export function buildAgentUsageLedgerRecord(input: {
  stage: AgentUsageStage;
  status: AgentUsageAttemptStatus;
  usageReported: boolean;
  inputTokens: number;
  outputTokens: number;
  inputCreditsPer1k: number;
  outputCreditsPer1k: number;
}): AgentUsageLedgerRecord {
  const hasProviderUsage = input.stage === "finished"
    && input.usageReported
    && Number.isSafeInteger(input.inputTokens)
    && input.inputTokens >= 0
    && Number.isSafeInteger(input.outputTokens)
    && input.outputTokens >= 0;
  if (!hasProviderUsage) {
    return {
      inputTokens: null,
      outputTokens: null,
      actualCost: null,
      usageStatus: "unknown",
      usageSource: "unavailable",
    };
  }

  const actualCost = Math.ceil((
    input.inputTokens * Math.max(0, input.inputCreditsPer1k)
    + input.outputTokens * Math.max(0, input.outputCreditsPer1k)
  ) / 1000);

  return {
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    actualCost,
    usageStatus: input.status === "success" ? "completed" : "partial",
    usageSource: input.status === "success" ? "provider_reported" : "provider_reported_partial",
  };
}
