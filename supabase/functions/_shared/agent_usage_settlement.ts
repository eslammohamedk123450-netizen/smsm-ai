export type AgentSettlementClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

export type TerminalAgentTaskStatus = "completed" | "failed" | "cancelled";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * Settle wallet credits only after the queue row is terminal and every provider
 * attempt has trustworthy usage. Unknown usage intentionally leaves both
 * wallet and Brain reservations pending for later reconciliation.
 */
export async function settleTerminalAgentTaskUsage(
  admin: AgentSettlementClient,
  input: { jobId: string; taskId: string; userId: string; status: TerminalAgentTaskStatus },
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("finalize_agent_task_usage", {
    p_job_id: input.jobId,
    p_task_id: input.taskId,
    p_user_id: input.userId,
  });
  if (error) throw new Error(`Agent usage settlement failed: ${error.message}`);

  const settlement = asRecord(data);
  if (settlement.finalized !== true) return settlement;

  // The database wrapper settles both the wallet hold and Brain token
  // reservation atomically and is safe to retry after a worker response loss.

  return settlement;
}
