jest.mock("../../lib/supabase/client", () => ({ supabase: {} }));

import { mapChatAgentProgress, mapTaskHistory } from "./task-service";

describe("mapTaskHistory", () => {
  it("joins owner-visible jobs to task objectives without exposing queue payloads", () => {
    const items = mapTaskHistory([
      {
        id: "job-1",
        task_id: "task-1",
        status: "completed",
        result: { response: "تحليل مكتمل" },
        updated_at: "2026-11-16T20:00:00Z",
        completed_at: "2026-11-16T20:00:00Z",
        payload: { secret: "must-not-be-exposed" },
      },
    ], [
      { task_id: "task-1", objective: "حلل خطة المشروع", complexity: "complex", estimated_steps: 4 },
    ]);
    expect(items).toEqual([{
      jobId: "job-1",
      taskId: "task-1",
      status: "completed",
      objective: "حلل خطة المشروع",
      resultText: "تحليل مكتمل",
      updatedAt: "2026-11-16T20:00:00Z",
      completedAt: "2026-11-16T20:00:00Z",
      complexity: "complex",
      estimatedSteps: 4,
    }]);
    expect(JSON.stringify(items)).not.toContain("must-not-be-exposed");
  });

  it("ignores malformed jobs and unknown statuses", () => {
    const items = mapTaskHistory([
      null,
      { id: "job-bad", status: "worker_internal", task_id: "task-2" },
      { id: 7, status: "queued" },
    ], []);
    expect(items).toEqual([]);
  });

  it("keeps a safe fallback when a job has no task context", () => {
    const items = mapTaskHistory([
      { id: "job-3", task_id: null, status: "queued", result: null, updated_at: null },
    ], []);
    expect(items[0].objective).toBe("مهمة محفوظة");
    expect(items[0].resultText).toBeNull();
  });
});


describe("mapChatAgentProgress", () => {
  const requestId = "6a4e6c9e-1b42-4c5d-8e21-7a5b4d3c2f10";

  it("maps only safe owner-visible plan, step, and tool status fields", () => {
    const progress = mapChatAgentProgress({
      id: "workspace-1",
      request_id: requestId,
      status: "executing",
      current_step_key: "research",
      attempt_count: 1,
      max_attempts: 3,
      updated_at: "2026-11-18T10:00:00Z",
      metadata: { user_message_id: "user-message-1", private_prompt: "must-not-be-exposed" },
      plan: [{ step_id: "research", description: "جمع المعلومات المطلوبة", depends_on: [] }],
      final_result: { hidden: "must-not-be-exposed" },
    }, [{
      workspace_id: "workspace-1",
      step_key: "research",
      sequence_order: 1,
      description: "جمع المعلومات المطلوبة",
      status: "running",
      attempt_no: 1,
      started_at: "2026-11-18T10:00:00Z",
      completed_at: null,
      result: { raw: "must-not-be-exposed" },
      error_message: "must-not-be-exposed",
    }], [{
      request_id: requestId,
      tool_name: "web.search",
      effect: "read",
      status: "running",
      started_at: "2026-11-18T10:00:01Z",
      completed_at: null,
      result_summary: { raw: "must-not-be-exposed" },
      input_hash: "must-not-be-exposed",
    }]);

    expect(progress).toMatchObject({
      workspaceId: "workspace-1",
      requestId,
      userMessageId: "user-message-1",
      status: "executing",
      currentStepKey: "research",
      attemptCount: 1,
      maxAttempts: 3,
      plan: [{ key: "research", description: "جمع المعلومات المطلوبة", dependsOn: [] }],
      steps: [{ key: "research", description: "جمع المعلومات المطلوبة", status: "running", sequenceOrder: 1, attemptNo: 1 }],
      tools: [{ tool: "web.search", effect: "read", status: "running" }],
    });
    expect(JSON.stringify(progress)).not.toContain("must-not-be-exposed");
    expect(JSON.stringify(progress)).not.toContain("final_result");
  });

  it("preserves server-confirmed cancellation and falls back to the stable request ID for older rows", () => {
    const progress = mapChatAgentProgress({
      id: "workspace-4",
      request_id: requestId,
      status: "cancelled",
      cancelled_at: "2026-11-18T10:05:00Z",
      metadata: {},
      plan: [],
    }, []);
    expect(progress).toMatchObject({
      requestId,
      userMessageId: requestId,
      status: "cancelled",
      cancelledAt: "2026-11-18T10:05:00Z",
    });
  });

  it("rejects unknown workspace statuses and unregistered tool names", () => {
    expect(mapChatAgentProgress({
      id: "workspace-2", request_id: requestId, status: "worker_internal", plan: [], metadata: {},
    }, [])).toBeNull();

    const progress = mapChatAgentProgress({
      id: "workspace-3", request_id: requestId, status: "completed", plan: [], metadata: {},
    }, [], [{ request_id: requestId, tool_name: "invented.write", effect: "write", status: "completed" }]);
    expect(progress?.tools).toEqual([]);
  });
});
