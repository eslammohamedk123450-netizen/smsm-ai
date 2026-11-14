import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { claimAgentTasks, finishAgentTask } from "../_shared/agent_task_queue.ts";
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Worker configuration is incomplete" }, 500);
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer !== serviceKey || req.headers.get("x-suly-worker-key") !== serviceKey) return json({ error: "Unauthorized worker trigger" }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const workerId = `brain-worker-${crypto.randomUUID()}`;
  let jobs;
  try { jobs = await claimAgentTasks(admin, workerId, 1, 180); }
  catch { return json({ error: "Could not claim queued work" }, 503); }
  if (!jobs.length) return json({ claimed: 0, completed: 0, message: "No queued jobs" });
  const job = jobs[0];
  if (job.job_type !== "brain_task") {
    await finishAgentTask(admin, job.id, workerId, "failed", { errorCode: "unsupported_job_type", errorMessage: "No handler is registered for this job type." });
    return json({ claimed: 1, completed: 0, failed: 1, job_id: job.id });
  }
  const payload = job.payload ?? {};
  const userId = typeof payload.user_id === "string" ? payload.user_id : "";
  const taskId = typeof payload.task_id === "string" ? payload.task_id : "";
  const objective = typeof payload.objective === "string" ? payload.objective : "";
  if (!userId || !taskId || !objective) {
    await finishAgentTask(admin, job.id, workerId, "failed", { errorCode: "invalid_brain_payload", errorMessage: "The queued Brain task payload is incomplete." });
    return json({ claimed: 1, completed: 0, failed: 1, job_id: job.id });
  }
  const heartbeat = setInterval(() => {
    void admin.rpc("heartbeat_agent_task_job", { p_job_id: job.id, p_worker_id: workerId, p_lease_seconds: 180 });
  }, 45_000);
  try {
    const response = await fetch(`${url}/functions/v1/brain-router`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", "x-suly-internal-brain-key": serviceKey },
      body: JSON.stringify({ objective, task_id: taskId, user_id: userId, internal_worker: true }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result?.response !== "string" || !result.response.trim()) {
      return json({ claimed: 1, completed: 0, retry_scheduled_by_lease: true, job_id: job.id }, 202);
    }
    const finished = await finishAgentTask(admin, job.id, workerId, "completed", { result: { task_id: taskId, response: result.response, complexity: result.complexity, steps_completed: result.steps_completed } });
    return json({ claimed: 1, completed: finished ? 1 : 0, job_id: job.id, task_id: taskId }, finished ? 200 : 409);
  } catch {
    return json({ claimed: 1, completed: 0, retry_scheduled_by_lease: true, job_id: job.id }, 202);
  } finally { clearInterval(heartbeat); }
});
