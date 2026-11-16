import { supabase } from "../../lib/supabase/client";

export type TaskStep = {
  key: string;
  description: string;
  status: string;
  attemptNo: number;
  error: string | null;
};

export type TaskSnapshot = {
  taskId: string;
  status: string;
  complexity: string | null;
  estimatedSteps: number;
  updatedAt: string | null;
  steps: TaskStep[];
  review: { verdict: string; feedback: string | null } | null;
  jobId?: string;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

/** Durable progress for a brain-router task, scoped to the signed-in user by RLS. */
export async function getTaskProgress(taskId: string, jobId?: string): Promise<TaskSnapshot | null> {
  let job: Record<string, unknown> | null = null;
  if (jobId) {
    const { data } = await supabase.rpc("get_agent_task_job_status", { p_job_id: jobId });
    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row === "object") job = row as Record<string, unknown>;
  }
  const { data: context, error } = await supabase.from("brain_task_contexts")
    .select("task_id,status,complexity,estimated_steps,updated_at")
    .eq("task_id", taskId)
    .maybeSingle();
  if (error || !context) {
    if (!job) return null;
    return {
      taskId: String(job.task_id ?? taskId),
      status: String(job.status ?? "queued"),
      complexity: null,
      estimatedSteps: 0,
      updatedAt: job.updated_at == null ? null : String(job.updated_at),
      steps: [],
      review: null,
      jobId,
      result: job.result && typeof job.result === "object" ? job.result as Record<string, unknown> : null,
      errorMessage: job.error_message == null ? null : String(job.error_message),
    };
  }
  const { data: steps } = await supabase.from("brain_task_steps")
    .select("step_index,description,status,result")
    .eq("task_id", taskId)
    .order("step_index", { ascending: true })
    .limit(50);
  return {
    taskId: String(context.task_id),
    status: String(job?.status ?? context.status ?? "unknown"),
    complexity: context.complexity == null ? null : String(context.complexity),
    estimatedSteps: Number(context.estimated_steps ?? 0),
    updatedAt: context.updated_at == null ? null : String(context.updated_at),
    steps: (steps ?? []).map((step, index) => ({
      key: String(step.step_index ?? index),
      description: String(step.description ?? "خطوة"),
      status: String(step.status ?? "pending"),
      attemptNo: 0,
      error: null,
    })),
    review: null,
    jobId,
    result: job?.result && typeof job.result === "object" ? job.result as Record<string, unknown> : null,
    errorMessage: job?.error_message == null ? null : String(job.error_message),
  };
}


export type TaskHistoryItem = {
  jobId: string;
  taskId: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  objective: string;
  resultText: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  complexity: string | null;
  estimatedSteps: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Pure, bounded projection for the signed-in user's task-history view. */
export function mapTaskHistory(jobs: unknown[], contexts: unknown[]): TaskHistoryItem[] {
  const contextByTask = new Map<string, Record<string, unknown>>();
  for (const value of contexts) {
    const row = asRecord(value);
    if (typeof row?.task_id === "string") contextByTask.set(row.task_id, row);
  }
  const allowedStatuses = new Set(["queued", "running", "completed", "failed", "cancelled"]);
  return jobs.flatMap((value) => {
    const job = asRecord(value);
    if (typeof job?.id !== "string" || typeof job.status !== "string" || !allowedStatuses.has(job.status)) return [];
    const taskId = typeof job.task_id === "string" ? job.task_id : null;
    const context = taskId ? contextByTask.get(taskId) : undefined;
    const result = asRecord(job.result);
    const resultText = typeof job.result === "string" ? job.result
      : typeof result?.response === "string" ? result.response
      : typeof result?.summary === "string" ? result.summary
      : null;
    return [{
      jobId: job.id,
      taskId,
      status: job.status as TaskHistoryItem["status"],
      objective: typeof context?.objective === "string" ? context.objective : "مهمة محفوظة",
      resultText,
      updatedAt: typeof job.updated_at === "string" ? job.updated_at : null,
      completedAt: typeof job.completed_at === "string" ? job.completed_at : null,
      complexity: typeof context?.complexity === "string" ? context.complexity : null,
      estimatedSteps: typeof context?.estimated_steps === "number" ? context.estimated_steps : null,
    }];
  });
}

/**
 * Lists only rows visible under the authenticated user's RLS policy. The
 * selected agent_task_jobs columns are intentionally limited to the explicit
 * authenticated column grants; worker payloads and lease fields are excluded.
 */
export async function listTaskHistory(limit = 100): Promise<TaskHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number.isFinite(limit) ? limit : 100)));
  const { data: jobs, error: jobsError } = await supabase.from("agent_task_jobs")
    .select("id,task_id,status,result,error_code,error_message,updated_at,completed_at")
    .order("updated_at", { ascending: false })
    .limit(safeLimit);
  if (jobsError) throw new Error("تعذر تحميل سجل المهام.");

  const taskIds = [...new Set((jobs ?? []).map((job) => job.task_id).filter((id): id is string => typeof id === "string"))];
  let contexts: unknown[] = [];
  if (taskIds.length) {
    const { data, error } = await supabase.from("brain_task_contexts")
      .select("task_id,objective,complexity,estimated_steps")
      .in("task_id", taskIds);
    if (error) throw new Error("تعذر تحميل تفاصيل سجل المهام.");
    contexts = data ?? [];
  }
  return mapTaskHistory(jobs ?? [], contexts);
}
