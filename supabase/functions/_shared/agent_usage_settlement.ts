import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  admin: SupabaseClient,
  input: { jobId: string; taskId: string; userId: string; status: TerminalAgentTaskStatus },
): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc("finalize_agent_task_step_usage", {
    p_job_id: input.jobId,
    p_task_id: input.taskId,
    p_user_id: input.userId,
    p_status: input.status,
  });
  if (error) throw new Error(`Agent usage settlement failed: ${error.message}`);

  const settlement = asRecord(data);
  if (settlement.finalized !== true) return settlement;

  const usage = asRecord(settlement.usage);
  const inputTokens = Number(usage.input_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? 0);
  if (!Number.isSafeInteger(inputTokens) || inputTokens < 0
    || !Number.isSafeInteger(outputTokens) || outputTokens < 0
    || inputTokens + outputTokens > 2_147_483_647) {
    throw new Error("Agent usage token totals exceed safe limits.");
  }

  const { error: brainUsageError } = await admin.rpc("brain_finalize_usage", {
    p_task_id: input.taskId,
    p_actual_tokens: inputTokens + outputTokens,
    p_status: input.status,
  });
  if (brainUsageError) throw new Error(`Brain usage settlement failed: ${brainUsageError.message}`);

  return settlement;
}
