import { supabase } from "../../lib/supabase/client";

export type BrainTaskAccepted = {
  task_id: string;
  job_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
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
 * Brain is the durable task intake/status surface. Queued execution is delegated
 * to the central ai-router Agent; chat keeps its existing streaming entrypoint.
 */
export async function runBrainTask(objective: string, taskId?: string): Promise<BrainTaskAccepted> {
  const { data, error } = await supabase.functions.invoke("brain-router", {
    body: { objective, mode: "enqueue", ...(taskId ? { task_id: taskId } : {}) },
  });
  if (error) throw new Error(error.message || "تعذر إضافة المهمة إلى قائمة التنفيذ.");
  if (!data || data.queued !== true || typeof data.task_id !== "string" || typeof data.job_id !== "string"
    || !["queued", "running", "completed", "failed", "cancelled"].includes(String(data.status))) {
    throw new Error(String(data?.error ?? "تعذر إضافة المهمة إلى قائمة التنفيذ."));
  }
  void wakeBrainWorker();
  return data as BrainTaskAccepted;
}

export function wakeBrainWorker(): void {
  // Wake only the current user's queue; the Edge Function verifies this session.
  void supabase.functions.invoke("agent-task-worker", { body: {} });
}


export type BrainTaskCancellation = { status: "cancelled" | "running"; cancelRequested: boolean };

/** Cancels queued work or requests a safe stop at the next running-step boundary. */
export async function cancelBrainTask(jobId: string): Promise<BrainTaskCancellation> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
    throw new Error("معرّف المهمة غير صالح.");
  }
  const { data, error } = await supabase.rpc("cancel_agent_task_job", { p_job_id: jobId });
  if (error) throw new Error("تعذر إلغاء المهمة الآن.");
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== "object" || (result as Record<string, unknown>).success !== true) {
    const reason = (result as Record<string, unknown> | null)?.reason;
    if (reason === "already_running") throw new Error("بدأ تنفيذ المهمة بالفعل؛ لم يتم إيقافها أو تغيير حجزها.");
    if (reason === "not_found") throw new Error("المهمة غير موجودة أو لا تملك صلاحية إلغائها.");
    throw new Error("المهمة انتهت بالفعل ولا تحتاج إلى إلغاء.");
  }
  const status = (result as Record<string, unknown>).status;
  const cancelRequested = (result as Record<string, unknown>).cancel_requested === true;
  if (status === "cancelled") return { status: "cancelled", cancelRequested: false };
  if (status === "running" && cancelRequested) return { status: "running", cancelRequested: true };
  throw new Error("لم يتم تأكيد طلب إيقاف المهمة.");
}
