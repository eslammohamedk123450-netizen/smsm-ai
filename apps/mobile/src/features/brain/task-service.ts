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
    status: String(context.status ?? "unknown"),
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
