import { mapTaskHistory } from "./task-service";

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
