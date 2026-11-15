export type BrainTaskPayload = {
  userId: string;
  taskId: string;
  objective: string;
};

export type BrainTaskQueueRecord = {
  user_id: string;
  payload: unknown;
};

export function readBrainTaskPayload(job: BrainTaskQueueRecord): BrainTaskPayload | null {
  const payload = job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
    ? job.payload as Record<string, unknown>
    : {};
  const userId = typeof payload.user_id === "string" ? payload.user_id : "";
  const taskId = typeof payload.task_id === "string" ? payload.task_id : "";
  const objective = typeof payload.objective === "string" ? payload.objective.trim() : "";

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId);
  if (userId !== job.user_id || !isUuid || !objective || objective.length > 50_000) return null;

  return { userId, taskId, objective };
}
