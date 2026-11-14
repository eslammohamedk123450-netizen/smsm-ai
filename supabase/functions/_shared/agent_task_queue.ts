import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AgentTaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface EnqueueAgentTaskInput {
  userId: string;
  jobType: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  priority?: number;
  maxAttempts?: number;
  availableAt?: string;
}

export interface AgentTaskJob {
  id: string;
  user_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: AgentTaskStatus;
  priority: number;
  attempt_count: number;
  max_attempts: number;
  available_at: string;
  locked_by: string | null;
  lease_until: string | null;
  result: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const JOB_TYPE_PATTERN = /^[a-z][a-z0-9_.-]{1,79}$/i;
const WORKER_ID_PATTERN = /^[a-zA-Z0-9_.:-]{1,120}$/;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value)) throw new Error("Expected an integer value.");
  return Math.max(min, Math.min(max, value));
}

/** Queue a task using a service-role Supabase client. A per-user idempotency
 * key makes retries safe; callers should treat unique conflicts as reuse. */
export async function enqueueAgentTask(
  supabase: SupabaseClient,
  input: EnqueueAgentTaskInput,
): Promise<AgentTaskJob> {
  if (!input.userId) throw new Error("userId is required.");
  if (!JOB_TYPE_PATTERN.test(input.jobType)) throw new Error("Invalid agent job type.");
  const payload = input.payload ?? {};
  assertRecord(payload, "payload");
  if (JSON.stringify(payload).length > 64_000) throw new Error("Task payload exceeds 64 KB.");
  if (input.idempotencyKey !== undefined && (input.idempotencyKey.length < 1 || input.idempotencyKey.length > 200)) {
    throw new Error("idempotencyKey must contain 1–200 characters.");
  }

  const row = {
    user_id: input.userId,
    job_type: input.jobType,
    payload,
    idempotency_key: input.idempotencyKey ?? null,
    priority: clampInteger(input.priority, 0, -100, 100),
    max_attempts: clampInteger(input.maxAttempts, 3, 1, 10),
    available_at: input.availableAt ?? new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("agent_task_jobs")
    .insert(row)
    .select("*")
    .single();

  if (!error && data) return data as AgentTaskJob;

  // A duplicate idempotency key returns the original job, never a second job.
  if (input.idempotencyKey && error?.code === "23505") {
    const existing = await supabase
      .from("agent_task_jobs")
      .select("*")
      .eq("user_id", input.userId)
      .eq("idempotency_key", input.idempotencyKey)
      .single();
    if (!existing.error && existing.data) return existing.data as AgentTaskJob;
  }
  throw new Error(`Could not enqueue agent task: ${error?.message ?? "empty database response"}`);
}

/** Atomically claim work. The database function uses row locks and SKIP LOCKED. */
export async function claimAgentTasks(
  supabase: SupabaseClient,
  workerId: string,
  userId: string,
  limit = 1,
  leaseSeconds = 120,
): Promise<AgentTaskJob[]> {
  if (!WORKER_ID_PATTERN.test(workerId)) throw new Error("Invalid worker ID.");
  const { data, error } = await supabase.rpc("claim_agent_task_jobs", {
    p_worker_id: workerId,
    p_limit: clampInteger(limit, 1, 1, 10),
    p_lease_seconds: clampInteger(leaseSeconds, 120, 30, 900),
    p_user_id: userId,
  });
  if (error) throw new Error(`Could not claim agent tasks: ${error.message}`);
  return (data ?? []) as AgentTaskJob[];
}

export async function heartbeatAgentTask(
  supabase: SupabaseClient,
  jobId: string,
  workerId: string,
  leaseSeconds = 120,
): Promise<boolean> {
  if (!WORKER_ID_PATTERN.test(workerId)) throw new Error("Invalid worker ID.");
  const { data, error } = await supabase.rpc("heartbeat_agent_task_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_lease_seconds: clampInteger(leaseSeconds, 120, 30, 900),
  });
  if (error) throw new Error(`Could not renew agent task lease: ${error.message}`);
  return data === true;
}

export async function finishAgentTask(
  supabase: SupabaseClient,
  jobId: string,
  workerId: string,
  status: "completed" | "failed" | "cancelled",
  options: {
    result?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  } = {},
): Promise<boolean> {
  if (!WORKER_ID_PATTERN.test(workerId)) throw new Error("Invalid worker ID.");
  if (options.result !== undefined) assertRecord(options.result, "result");
  const { data, error } = await supabase.rpc("finish_agent_task_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_status: status,
    p_result: options.result ?? null,
    p_error_code: options.errorCode?.slice(0, 120) ?? null,
    p_error_message: options.errorMessage?.slice(0, 2000) ?? null,
  });
  if (error) throw new Error(`Could not finish agent task: ${error.message}`);
  return data === true;
}
