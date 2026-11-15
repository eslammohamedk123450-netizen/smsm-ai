import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { finishAgentTask } from "../_shared/agent_task_queue.ts";
import { readBrainTaskPayload } from "../_shared/brain_task_payload.ts";
import { settleTerminalAgentTaskUsage, type AgentSettlementClient, type TerminalAgentTaskStatus } from "../_shared/agent_usage_settlement.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

type QueueJob = { id: string; user_id: string; task_id?: string | null; job_type: string; payload: Record<string, unknown> | null; attempt_count: number };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function finishAndSettle(
  admin: Parameters<typeof finishAgentTask>[0],
  job: QueueJob,
  workerId: string,
  taskId: string | null,
  status: TerminalAgentTaskStatus,
  options: { result?: Record<string, unknown>; errorCode?: string; errorMessage?: string } = {},
): Promise<boolean> {
  const finished = await finishAgentTask(admin, job.id, workerId, status, options);
  if (finished && taskId) {
    const settlement = await settleTerminalAgentTaskUsage(admin as unknown as AgentSettlementClient, {
      jobId: job.id,
      taskId,
      userId: job.user_id,
      status,
    });
    if (settlement.finalized !== true) {
      console.warn("Agent task terminal billing remains pending:", String(settlement.reason ?? settlement.status ?? "unknown"));
    }
  }
  return finished;
}



async function processJob(
  job: QueueJob,
  supabaseUrl: string,
  serviceRoleKey: string,
  admin: any,
  workerId: string,
): Promise<void> {
  if (job.job_type !== "brain_task") {
    await finishAndSettle(admin, job, workerId, job.task_id ?? null, "failed", {
      errorCode: "unsupported_job_type",
      errorMessage: "No scheduled handler is registered for this job type.",
    });
    return;
  }

  const task = readBrainTaskPayload(job);
  if (!task) {
    await finishAndSettle(admin, job, workerId, job.task_id ?? null, "failed", {
      errorCode: "invalid_brain_payload",
      errorMessage: "The queued Brain task payload is incomplete or user-mismatched.",
    });
    return;
  }

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
    const response = await fetch(`${supabaseUrl}/functions/v1/brain-router`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-suly-internal-brain-key": serviceRoleKey,
      },
      body: JSON.stringify({
        objective: task.objective,
        task_id: task.taskId,
        job_id: task.jobId,
        user_id: task.userId,
        worker_id: workerId,
        worker_attempt: job.attempt_count,
        internal_worker: true,
      }),
      signal: controller.signal,
    });

    if (leaseLost) return;
    const result = await response.json().catch(() => ({}));
    if (response.ok && result?.status === "cancelled") {
      await finishAndSettle(admin, job, workerId, task.taskId, "cancelled", {
        result: { task_id: task.taskId, response: typeof result.response === "string" ? result.response : "تم إيقاف المهمة بناءً على طلبك.", status: "cancelled" },
      });
      return;
    }
    if (!response.ok || typeof result?.response !== "string" || !result.response.trim()) {
      // The terminal job transition settles only after all provider usage rows are known.
      // Unknown usage keeps both reservations pending for late reconciliation.
      await finishAndSettle(admin, job, workerId, task.taskId, "failed", {
        errorCode: `brain_execution_http_${response.status}`,
        errorMessage: "Brain could not complete this task. Review the task details and try again.",
      });
      return;
    }

    await finishAndSettle(admin, job, workerId, task.taskId, "completed", {
      result: {
        task_id: task.taskId,
        response: result.response,
        complexity: result.complexity,
        steps_completed: result.steps_completed,
        estimated_steps: result.estimated_steps,
        capabilities: result.capabilities,
      },
    });
  } catch {
    // Leave the lease to expire on transport/runtime interruption. The bounded
    // reclaim policy will retry the task and eventually mark it failed.
  } finally {
    clearInterval(heartbeat);
  }
}

async function processBatch(
  jobs: QueueJob[],
  supabaseUrl: string,
  serviceRoleKey: string,
  admin: any,
  workerId: string,
): Promise<void> {
  await Promise.all(jobs.map((job) => processJob(job, supabaseUrl, serviceRoleKey, admin, workerId)));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Scheduler configuration is incomplete" }, 500);

  const schedulerToken = req.headers.get("x-suly-scheduler-token") ?? "";
  if (schedulerToken.length < 32) return json({ error: "Scheduler authentication required" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: tokenValid, error: tokenError } = await admin.rpc(
    "verify_agent_task_scheduler_token",
    { p_token: schedulerToken },
  );
  if (tokenError || tokenValid !== true) return json({ error: "Invalid scheduler authentication" }, 401);

  const { data: recoveredMediaJobs, error: mediaRecoveryError } = await admin.rpc("suly_service_recover_stale_media_jobs");
  if (mediaRecoveryError) console.error("Media job recovery check failed:", mediaRecoveryError.code ?? "database_error");
  else if (Number(recoveredMediaJobs ?? 0) > 0) console.info("Recovered stale media jobs:", Number(recoveredMediaJobs));

  const workerId = `scheduled-brain-batch-${crypto.randomUUID()}`;
  const { data, error } = await admin.rpc("claim_agent_task_jobs", {
    p_worker_id: workerId,
    p_limit: 5,
    p_lease_seconds: 180,
    p_user_id: null,
  });
  if (error) return json({ error: "Could not claim queued tasks" }, 503);

  const jobs = (data ?? []) as QueueJob[];
  const reconcileTerminalBilling = async () => {
    // Also reconcile terminal jobs created by exhausted leases or a prior
    // worker interruption. Unknown provider usage remains held for late reports.
    const { data: settlementBatch, error: settlementError } = await admin.rpc("settle_terminal_agent_task_usage_batch", {
      p_limit: 100,
    });
    if (settlementError) console.error("Terminal Agent settlement sweep failed:", settlementError.code ?? "database_error");
    else console.info("Terminal Agent settlement sweep:", settlementBatch);
  };

  if (!jobs.length) {
    EdgeRuntime.waitUntil(reconcileTerminalBilling());
    return json({ accepted: true, claimed: 0, status: "idle" }, 200);
  }

  EdgeRuntime.waitUntil((async () => {
    await processBatch(jobs, supabaseUrl, serviceRoleKey, admin, workerId);
    await reconcileTerminalBilling();
  })());
  return json({ accepted: true, claimed: jobs.length, status: "processing" }, 202);
});
