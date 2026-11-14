import { supabase } from "../../lib/supabase/client";

export type BrainTaskAccepted = {
  task_id: string;
  job_id: string;
  status: "queued";
  queued: true;
  route: "brain-router";
};

export type BrainTaskResult = {
  task_id: string;
  complexity: "easy" | "complex";
  capabilities: string[];
  estimated_steps: number;
  steps_completed: number;
  response: string;
  route: "brain-router";
};

/**
 * New orchestration entrypoint. The existing chat client intentionally keeps
 * using ai-router so current conversations and billing remain unchanged.
 */
export async function runBrainTask(objective: string, taskId?: string): Promise<BrainTaskAccepted> {
  const { data, error } = await supabase.functions.invoke("brain-router", {
    body: { objective, mode: "enqueue", ...(taskId ? { task_id: taskId } : {}) },
  });
  if (error) throw new Error(error.message || "تعذر إضافة المهمة إلى قائمة التنفيذ.");
  if (!data || data.queued !== true || typeof data.task_id !== "string" || typeof data.job_id !== "string") {
    throw new Error(String(data?.error ?? "تعذر إضافة المهمة إلى قائمة التنفيذ."));
  }
  void wakeBrainWorker();
  return data as BrainTaskAccepted;
}

export function wakeBrainWorker(): void {
  // Wake only the current user's queue; the Edge Function verifies this session.
  void supabase.functions.invoke("agent-task-worker", { body: {} });
}
