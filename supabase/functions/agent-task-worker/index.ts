import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { claimAgentTasks, finishAgentTask } from "../_shared/agent_task_queue.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function processOne(url: string, serviceKey: string, userId: string): Promise<void> {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const workerId = `brain-worker-${crypto.randomUUID()}`;
  const jobs = await claimAgentTasks(admin, workerId, userId, 1, 180);
  if (!jobs.length) return;
  const job = jobs[0];

  if (job.job_type !== "brain_task") {
    await finishAgentTask(admin, job.id, workerId, "failed", {
      errorCode: "unsupported_job_type",
      errorMessage: "No handler is registered for this job type.",
    });
    return;
  }

  const payload = job.payload ?? {};
  const payloadUserId = typeof payload.user_id === "string" ? payload.user_id : "";
  const taskId = typeof payload.task_id === "string" ? payload.task_id : "";
  const objective = typeof payload.objective === "string" ? payload.objective : "";
  if (payloadUserId !== userId || !taskId || !objective) {
    await finishAgentTask(admin, job.id, workerId, "failed", {
      errorCode: "invalid_brain_payload",
      errorMessage: "The queued Brain task payload is incomplete or user-mismatched.",
    });
    return;
  }

  const heartbeat = setInterval(() => {
    void admin.rpc("heartbeat_agent_task_job", {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_lease_seconds: 180,
    });
  }, 45_000);

  try {
    const response = await fetch(`${url}/functions/v1/brain-router`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "x-suly-internal-brain-key": serviceKey,
      },
      body: JSON.stringify({ objective, task_id: taskId, user_id: userId, internal_worker: true }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result?.response !== "string" || !result.response.trim()) {
      // The lease expires and the queue makes the task available for retry.
      return;
    }
    await finishAgentTask(admin, job.id, workerId, "completed", {
      result: {
        task_id: taskId,
        response: result.response,
        complexity: result.complexity,
        steps_completed: result.steps_completed,
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
  EdgeRuntime.waitUntil(processOne(url, serviceKey, userId).catch(() => undefined));
  return json({ accepted: true, status: "processing", scope: "current_user" }, 202);
});
