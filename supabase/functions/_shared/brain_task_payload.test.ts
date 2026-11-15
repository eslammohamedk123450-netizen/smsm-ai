import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readBrainTaskPayload } from "./brain_task_payload.ts";

const owner = "123e4567-e89b-42d3-a456-426614174000";
const other = "123e4567-e89b-42d3-a456-426614174001";
const taskId = "123e4567-e89b-42d3-a456-426614174002";

Deno.test("Brain task payload accepts valid owner, UUID and trimmed objective", () => {
  assertEquals(readBrainTaskPayload({
    user_id: owner,
    payload: { user_id: owner, task_id: taskId, objective: "  build a feature  " },
  }), { userId: owner, taskId, objective: "build a feature" });
});

Deno.test("Brain task payload rejects cross-user identity", () => {
  assertEquals(readBrainTaskPayload({
    user_id: owner,
    payload: { user_id: other, task_id: taskId, objective: "do work" },
  }), null);
});

Deno.test("Brain task payload rejects invalid task identifiers", () => {
  assertEquals(readBrainTaskPayload({
    user_id: owner,
    payload: { user_id: owner, task_id: "not-a-uuid", objective: "do work" },
  }), null);
});

Deno.test("Brain task payload rejects empty and oversized objectives", () => {
  assertEquals(readBrainTaskPayload({
    user_id: owner,
    payload: { user_id: owner, task_id: taskId, objective: "   " },
  }), null);
  assertEquals(readBrainTaskPayload({
    user_id: owner,
    payload: { user_id: owner, task_id: taskId, objective: "x".repeat(50_001) },
  }), null);
});

Deno.test("Brain task payload rejects arrays and non-object payloads", () => {
  assertEquals(readBrainTaskPayload({ user_id: owner, payload: [] }), null);
  assertEquals(readBrainTaskPayload({ user_id: owner, payload: null }), null);
});
