import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { finishAgentTask } from "../_shared/agent_task_queue.ts";
import { readBrainTaskPayload } from "../_shared/brain_task_payload.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

type QueueJob = { id: string; user_id: string; job_type: string; payload: Record<string, unknown> | null };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}



async function processJob(
  job: { id: string; user_id: string; job_type: string; payload: Record<string, unknown> | null },
  supabaseUrl: string,
  serviceRoleKey: string,
  admin: any,
  workerId: string,
): Promise<void> {
  if (job.job_type !== "brain_task") {
    await finishAgentTask(admin, job.id, workerId, "failed", {
      errorCode: "unsupported_job_type",
      errorMessage: "No scheduled handler is registered for this job type.",
    });
    return;
  }

  const task = readBrainTaskPayload(job);
  if (!task) {
    await finishAgentTask(admin, job.id, workerId, "failed", {
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
        internal_worker: true,
      }),
      signal: controller.signal,
    });

    if (leaseLost) return;
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result?.response !== "string" || !result.response.trim()) {
      // Release the enqueue-time reservation on a confirmed terminal response.
      // Network errors/timeouts do not reach this branch, so another lease attempt
      // can safely continue the same task without a premature billing finalization.
      await admin.rpc("brain_finalize_usage", {
        p_task_id: task.taskId,
        p_actual_tokens: 0,
        p_status: "failed",
      });
      await finishAgentTask(admin, job.id, workerId, "failed", {
        errorCode: `brain_execution_http_${response.status}`,
        errorMessage: "Brain could not complete this task. Review the task details and try again.",
      });
      return;
    }

    await finishAgentTask(admin, job.id, workerId, "completed", {
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
  if (!jobs.length) return json({ accepted: true, claimed: 0, status: "idle" }, 200);

  EdgeRuntime.waitUntil(processBatch(jobs, supabaseUrl, serviceRoleKey, admin, workerId));
  return json({ accepted: true, claimed: jobs.length, status: "processing" }, 202);
});
