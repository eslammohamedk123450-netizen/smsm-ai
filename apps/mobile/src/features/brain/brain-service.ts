import { supabase } from "../../lib/supabase/client";

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
export async function runBrainTask(objective: string, taskId?: string): Promise<BrainTaskResult> {
  const { data, error } = await supabase.functions.invoke("brain-router", {
    body: { objective, ...(taskId ? { task_id: taskId } : {}) },
  });
  if (error) throw new Error(error.message || "تعذر تشغيل نظام العقول.");
  if (!data || typeof data.response !== "string") throw new Error(String(data?.error ?? "تعذر تشغيل نظام العقول."));
  return data as BrainTaskResult;
}
