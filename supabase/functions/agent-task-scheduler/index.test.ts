import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type QueueJob = {
  id: string;
  user_id: string;
  job_type: string;
  payload: Record<string, unknown> | null;
};

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readBrainTask(job: QueueJob): { userId: string; taskId: string; objective: string } | null {
  const payload = job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
    ? job.payload
    : {};
  const userId = typeof payload.user_id === "string" ? payload.user_id : "";
  const taskId = typeof payload.task_id === "string" ? payload.task_id : "";
  const objective = typeof payload.objective === "string" ? payload.objective.trim() : "";
  if (userId !== job.user_id || !isUuid(taskId) || !objective || objective.length > 50_000) return null;
  return { userId, taskId, objective };
}

const owner = "123e4567-e89b-42d3-a456-426614174000";
const other = "123e4567-e89b-42d3-a456-426614174001";
const taskId = "123e4567-e89b-42d3-a456-426614174002";

Deno.test("scheduled Brain payload accepts matching owner and UUID task", () => {
  assertEquals(readBrainTask({
    id: "job-1",
    user_id: owner,
    job_type: "brain_task",
    payload: { user_id: owner, task_id: taskId, objective: "  build a feature  " },
  }), { userId: owner, taskId, objective: "build a feature" });
});

Deno.test("scheduled Brain payload rejects cross-user identity", () => {
  assertEquals(readBrainTask({
    id: "job-2",
    user_id: owner,
    job_type: "brain_task",
    payload: { user_id: other, task_id: taskId, objective: "do work" },
  }), null);
});

Deno.test("scheduled Brain payload rejects missing task IDs and empty objectives", () => {
  assertEquals(readBrainTask({
    id: "job-3",
    user_id: owner,
    job_type: "brain_task",
    payload: { user_id: owner, task_id: "not-a-uuid", objective: " " },
  }), null);
});
