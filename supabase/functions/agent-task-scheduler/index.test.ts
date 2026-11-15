import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readBrainTaskPayload } from "../_shared/brain_task_payload.ts";

const owner = "123e4567-e89b-42d3-a456-426614174000";
const other = "123e4567-e89b-42d3-a456-426614174001";
const taskId = "123e4567-e89b-42d3-a456-426614174002";

Deno.test("scheduled Brain payload accepts matching owner and UUID task", () => {
  assertEquals(readBrainTaskPayload({
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
