import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { claimAgentTasks, finishAgentTask } from "../_shared/agent_task_queue.ts";
import { readBrainTaskPayload } from "../_shared/brain_task_payload.ts";
import { settleTerminalAgentTaskUsage, type TerminalAgentTaskStatus } from "../_shared/agent_usage_settlement.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function finishAndSettle(
  admin: SupabaseClient,
  jobId: string,
  workerId: string,
  userId: string,
  taskId: string | null,
  status: TerminalAgentTaskStatus,
  options: { result?: Record<string, unknown>; errorCode?: string; errorMessage?: string } = {},
): Promise<boolean> {
  const finished = await finishAgentTask(admin, jobId, workerId, status, options);
  if (finished && taskId) {
    const settlement = await settleTerminalAgentTaskUsage(admin, { jobId, taskId, userId, status });
    if (settlement.finalized !== true) {
      console.warn("Agent task terminal billing remains pending:", String(settlement.reason ?? settlement.status ?? "unknown"));
    }
  }
  return finished;
}

async function processOne(url: string, serviceKey: string, userId: string, userJwt: string): Promise<void> {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const workerId = `brain-worker-${crypto.randomUUID()}`;
  const jobs = await claimAgentTasks(admin, workerId, userId, 1, 180);
  if (!jobs.length) return;
  const job = jobs[0];

  if (job.job_type !== "brain_task") {
    await finishAndSettle(admin, job.id, workerId, userId, job.task_id ?? null, "failed", {
      errorCode: "unsupported_job_type",
      errorMessage: "No handler is registered for this job type.",
    });
    return;
  }

  const task = readBrainTaskPayload(job);
  if (!task || task.userId !== userId) {
    await finishAndSettle(admin, job.id, workerId, userId, job.task_id ?? null, "failed", {
      errorCode: "invalid_brain_payload",
      errorMessage: "The queued Brain task payload is incomplete or user-mismatched.",
    });
    return;
  }
  const { taskId, objective } = task;

  const controller = new AbortController();
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    void (async () => {
      try {
        const { data, error } = await admin.rpc("heartbeat_agent_task_job", {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_lease_seconds: 180,
        });
        if (error || data !== true) {
          leaseLost = true;
          controller.abort();
        }
      } catch {
        leaseLost = true;
        controller.abort();
      }
    })();
  }, 45_000);

  try {
    const response = await fetch(`${url}/functions/v1/brain-router`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userJwt}`,
        "Content-Type": "application/json",
        "x-suly-internal-brain-key": serviceKey,
      },
      body: JSON.stringify({
        objective,
        task_id: taskId,
        job_id: job.id,
        user_id: userId,
        worker_id: workerId,
        worker_attempt: job.attempt_count,
        internal_worker: true,
      }),
      signal: controller.signal,
    });
    if (leaseLost) return;
    const result = await response.json().catch(() => ({}));
    if (response.ok && result?.status === "cancelled") {
      await finishAndSettle(admin, job.id, workerId, userId, taskId, "cancelled", {
        result: { task_id: taskId, response: typeof result.response === "string" ? result.response : "تم إيقاف المهمة بناءً على طلبك.", status: "cancelled" },
      });
      return;
    }
    if (!response.ok || typeof result?.response !== "string" || !result.response.trim()) {
      await finishAndSettle(admin, job.id, workerId, userId, taskId, "failed", {
        errorCode: "brain_execution_failed",
        errorMessage: "Brain could not complete this task. Review the task details and try again.",
      });
      return;
    }
    await finishAndSettle(admin, job.id, workerId, userId, taskId, "completed", {
      result: {
        task_id: taskId,
        response: result.response,
        complexity: result.complexity,
        steps_completed: result.steps_completed,
        estimated_steps: result.estimated_steps,
        capabilities: result.capabilities,
      },
    });
  } finally {
    clearInterval(heartbeat);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Worker configuration is incomplete" }, 500);

  // A normal authenticated user can wake only their own queued work.
  const userJwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!userJwt) return json({ error: "Authentication required" }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(userJwt);
  if (authError || !authData.user) return json({ error: "Invalid access token" }, 401);
  const userId = authData.user.id;

  // Supabase EdgeRuntime keeps this work alive after the HTTP response. If the
  // runtime stops it, the lease expires and a later app wake can retry safely.
  EdgeRuntime.waitUntil(processOne(url, serviceKey, userId, userJwt).catch(() => undefined));
  return json({ accepted: true, status: "processing", scope: "current_user" }, 202);
});
