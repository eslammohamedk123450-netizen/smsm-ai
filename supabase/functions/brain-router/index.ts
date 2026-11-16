import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { parseCentralAgentResult, toBrainTaskStepRows } from "./central_agent_result.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function cleanText(value: unknown, max = 50000): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

async function taskMessageRequestId(taskId: string, role: "user" | "assistant"): Promise<string> {
  const bytes = new TextEncoder().encode(`suly-task-chat:${taskId}:${role}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hex = Array.from(digest).map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function main(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration is incomplete" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try { body = asRecord(await req.json()); } catch { return json({ error: "Request body must be valid JSON" }, 400); }
  const userJwt = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const internalWorker = req.headers.get("x-suly-internal-brain-key") === serviceRoleKey && body.internal_worker === true;
  let userId = "";
  if (internalWorker) {
    userId = cleanText(body.user_id, 64);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return json({ error: "Invalid internal user context" }, 400);
  } else {
    if (!userJwt) return json({ error: "A signed-in user's Bearer access token is required" }, 401);
    const { data: authData, error: authError } = await admin.auth.getUser(userJwt);
    if (authError || !authData.user) return json({ error: "Invalid or expired user access token" }, 401);
    userId = authData.user.id;
  }
  const objective = cleanText(body.objective ?? body.message);
  if (!objective || objective.length > 50000) return json({ error: "objective is required and must be <= 50000 characters" }, 400);
  const taskId = cleanText(body.task_id) || crypto.randomUUID();
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) return json({ error: "task_id must be a UUID" }, 400);

  // All Brain tasks must use the queued central Agent path. The legacy
  // synchronous Brain catalog/router is intentionally disabled in this rollout.
  if (!internalWorker && body.mode !== "enqueue") {
    return json({ error: "legacy_brain_route_disabled", message: "أرسل المهمة عبر مسار الوكيل المركزي." }, 410);
  }
  const { data: profile, error: profileError } = await admin
    .from("suly_profiles")
    .select("is_banned")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) return json({ error: "Application profile is missing" }, 403);
  if (profile.is_banned) return json({ error: "This account is suspended" }, 403);

  // Persist a completed durable Agent task into its owner's ordinary chat.
  // This server-side path is required because authenticated clients may only
  // insert user messages; assistant rows are intentionally service-role only.
  if (!internalWorker && body.mode === "sync_chat") {
    const conversationId = cleanText(body.conversation_id, 64);
    const expectedResponse = cleanText(body.response);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)
      || !expectedResponse) return json({ error: "Invalid chat sync payload" }, 400);

    const { data: task, error: taskError } = await admin.from("brain_task_contexts")
      .select("objective,final_response,status")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .maybeSingle();
    if (taskError) return json({ error: "Could not verify the completed task" }, 503);
    if (!task || task.status !== "completed" || !task.final_response) {
      return json({ error: "Task is not completed or does not belong to this account" }, 409);
    }
    if (task.objective !== objective || task.final_response !== expectedResponse) {
      return json({ error: "Task chat sync payload does not match the saved task" }, 409);
    }
    const { data: conversation, error: conversationLookupError } = await admin.from("suly_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (conversationLookupError) return json({ error: "Could not verify conversation ownership" }, 503);
    if (!conversation) return json({ error: "Conversation not found for this account" }, 404);

    const assistantContent = `${task.final_response}\n\nمعرّف المهمة: ${taskId}\n[SULY_TASK_ID:${taskId}]`;
    const persistOnce = async (role: "user" | "assistant", content: string): Promise<boolean> => {
      const requestId = await taskMessageRequestId(taskId, role);
      const { error: writeError } = await admin.from("suly_messages").upsert({
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        request_id: requestId,
        tokens_used: Math.ceil(content.length / 4),
      }, { onConflict: "request_id", ignoreDuplicates: true });
      if (writeError) return false;
      const { data: saved, error: verifyError } = await admin.from("suly_messages")
        .select("id,conversation_id,user_id,role,content")
        .eq("request_id", requestId)
        .maybeSingle();
      return !verifyError && Boolean(saved)
        && saved.user_id === userId
        && saved.conversation_id === conversationId
        && saved.role === role
        && saved.content === content;
    };
    if (!await persistOnce("user", objective)) return json({ error: "Could not safely persist the task request in chat" }, 503);
    if (!await persistOnce("assistant", assistantContent)) return json({ error: "Task request is saved, but its result could not yet be persisted in chat" }, 503);
    const { error: updateError } = await admin.from("suly_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", userId);
    if (updateError) return json({ error: "Chat messages are saved, but conversation ordering could not be refreshed" }, 503);
    return json({ success: true, conversation_id: conversationId, task_id: taskId });
  }

  if (internalWorker) {
    const workerId = cleanText(body.worker_id, 120);
    const workerAttempt = Number(body.worker_attempt);
    if (!workerId || !Number.isInteger(workerAttempt) || workerAttempt < 1 || workerAttempt > 10) {
      return json({ error: "Invalid worker lease identity" }, 400);
    }
    const { data: leaseStateData, error: leaseStateError } = await admin.rpc("agent_task_execution_state", {
      p_job_id: cleanText(body.job_id, 64),
      p_task_id: taskId,
      p_user_id: userId,
      p_worker_id: workerId,
      p_worker_attempt: workerAttempt,
    });
    const leaseState = asRecord(leaseStateData);
    if (leaseStateError) return json({ error: "Could not validate the active worker lease" }, 503);
    if (leaseState.lease_valid !== true) return json({ error: "Worker lease is no longer valid" }, 409);
    if (leaseState.cancel_requested === true) {
      return json({ task_id: taskId, status: "cancelled", response: "تم إيقاف المهمة بناءً على طلبك.", route: "central-agent" });
    }

    // A worker may be reclaimed after the result was persisted but before the
    // queue row was finalized. Return the durable result without rerunning or
    // charging the same task a second time.
    const { data: savedTask } = await admin.from("brain_task_contexts")
      .select("task_id,context,final_response,complexity,capabilities,estimated_steps,status")
      .eq("task_id", taskId).eq("user_id", userId).maybeSingle();
    const savedContext = asRecord(savedTask?.context);
    const savedResponse = cleanText(savedTask?.final_response ?? savedContext.final_response);
    if (savedTask?.status === "completed" && savedResponse) {
      const { data: savedSteps } = await admin.from("brain_task_steps")
        .select("status").eq("task_id", taskId).limit(100);
      return json({
        task_id: taskId,
        complexity: savedTask.complexity ?? "easy",
        capabilities: savedTask.capabilities ?? ["text"],
        estimated_steps: savedTask.estimated_steps ?? 1,
        steps_completed: (savedSteps ?? []).filter((step) => step.status === "completed").length,
        response: savedResponse,
        route: "central-agent",
      });
    }
    if (savedTask?.status === "cancelled") {
      return json({
        task_id: taskId,
        status: "cancelled",
        response: cleanText(savedTask.final_response ?? savedContext.final_response) || "تم إيقاف المهمة بناءً على طلبك.",
        route: "central-agent",
      });
    }
    if (savedTask?.status === "failed") {
      return json({ error: "Central Agent task already failed", task_id: taskId }, 409);
    }

    // Brain is an intake/billing adapter only. The central ai-router Agent owns
    // planning, model eligibility, tool policy, execution, and final response.
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-suly-internal-brain-key": serviceRoleKey,
      },
      body: JSON.stringify({
        message: objective,
        user_id: userId,
        feature_key: "brain_system",
        request_id: taskId,
        agent_job_id: cleanText(body.job_id, 64),
        agent_worker_id: workerId,
        agent_worker_attempt: workerAttempt,
        execution_mode: "agent",
        routing_mode: "auto",
        stream: false,
        max_tokens: 4096,
      }),
      signal: req.signal,
    });
    const centralResult = parseCentralAgentResult(await response.json().catch(() => ({})));
    const finalResponse = centralResult?.response ?? "";
    const agentSteps = centralResult?.agentSteps ?? [];
    const completedSteps = centralResult?.completedSteps ?? 0;
    const estimatedSteps = centralResult?.estimatedSteps ?? 1;
    const complexity = centralResult?.complexity ?? "easy";
    const capabilities = centralResult?.capabilities ?? ["text"];

    if (response.ok && centralResult?.status === "cancelled") {
      const cancelledResponse = finalResponse || "تم إيقاف المهمة بناءً على طلبك.";
      const cancelledContext = {
        objective,
        complexity,
        capabilities,
        estimated_steps: estimatedSteps,
        steps: agentSteps,
        results: [],
        final_response: cancelledResponse,
        route: "central-agent",
        cancellation: "user_requested",
      };
      const { error: cancelledContextError } = await admin.from("brain_task_contexts").upsert({
        task_id: taskId,
        user_id: userId,
        objective,
        complexity,
        capabilities,
        estimated_steps: estimatedSteps,
        context: cancelledContext,
        final_response: cancelledResponse,
        status: "cancelled",
        updated_at: new Date().toISOString(),
      }, { onConflict: "task_id" });
      if (cancelledContextError) return json({ error: "Could not persist cancelled Agent progress", task_id: taskId }, 500);
      const { error: cancelledStepsError } = await admin.from("brain_task_steps")
        .upsert(toBrainTaskStepRows(taskId, agentSteps, "cancelled"), { onConflict: "task_id,step_index" });
      if (cancelledStepsError) return json({ error: "Could not persist cancelled Agent steps", task_id: taskId }, 500);
      return json({
        task_id: taskId,
        status: "cancelled",
        complexity,
        capabilities,
        estimated_steps: estimatedSteps,
        steps_completed: completedSteps,
        response: cancelledResponse,
        route: "central-agent",
        usage: { input_tokens: centralResult.inputTokens, output_tokens: centralResult.outputTokens },
      });
    }

    if (!response.ok || !centralResult) {
      await admin.from("brain_task_contexts").upsert({
        task_id: taskId,
        user_id: userId,
        objective,
        complexity,
        capabilities,
        estimated_steps: estimatedSteps,
        context: { objective, complexity, capabilities, estimated_steps: estimatedSteps, steps: agentSteps },
        status: "failed",
        updated_at: new Date().toISOString(),
      }, { onConflict: "task_id" });
      await admin.from("brain_task_steps").upsert(toBrainTaskStepRows(taskId, agentSteps, "failed"), { onConflict: "task_id,step_index" });
      return json({ error: "Central Agent could not complete this task", task_id: taskId }, response.status >= 400 ? response.status : 502);
    }

    const context = {
      objective,
      complexity,
      capabilities,
      estimated_steps: estimatedSteps,
      steps: agentSteps,
      results: [],
      final_response: finalResponse,
      route: "central-agent",
    };
    const { error: contextError } = await admin.from("brain_task_contexts").upsert({
      task_id: taskId,
      user_id: userId,
      objective,
      complexity,
      capabilities,
      estimated_steps: estimatedSteps,
      context,
      final_response: finalResponse,
      status: "completed",
      updated_at: new Date().toISOString(),
    }, { onConflict: "task_id" });
    if (contextError) {
      return json({ error: "Could not persist the central Agent result", task_id: taskId }, 500);
    }
    const { error: stepPersistenceError } = await admin.from("brain_task_steps")
      .upsert(toBrainTaskStepRows(taskId, agentSteps), { onConflict: "task_id,step_index" });
    if (stepPersistenceError) {
      await admin.from("brain_task_contexts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("task_id", taskId).eq("user_id", userId);
      return json({ error: "Could not persist central Agent progress", task_id: taskId }, 500);
    }

    return json({
      task_id: taskId,
      complexity,
      capabilities,
      estimated_steps: estimatedSteps,
      steps_completed: completedSteps,
      response: finalResponse,
      route: "central-agent",
    });
  }
  // Fixed bounded reservation; the central Agent enforces its own runtime budget.
  const reserveEstimate = 11_264;
  const { data: reservationData, error: reservationRpcError } = await admin.rpc("brain_reserve_usage", {
    p_user_id: userId,
    p_task_id: taskId,
    p_tokens: reserveEstimate,
  });
  const reservationError = reservationRpcError ? { message: reservationRpcError.message } : null;
  const reservation = Array.isArray(reservationData) ? asRecord(reservationData[0]) : asRecord(reservationData);
  if (reservationError) {
    const message = reservationError.message.toLowerCase();
    if (message.includes("task_in_progress") || message.includes("task_id_conflict")) return json({ error: message.includes("task_id_conflict") ? "task_id_conflict" : "task_in_progress" }, 409);
    if (message.includes("daily_")) return json({ error: "daily_limit_reached" }, 429);
    return json({ error: "Daily brain limit could not be checked" }, 500);
  }
  if (reservation.already_completed === true) {
    let stored: Record<string, unknown> = {};
    let readError: unknown = null;
    const firstRead = await admin.from("brain_task_contexts").select("task_id,context,final_response,complexity,capabilities,estimated_steps,status").eq("task_id", taskId).eq("user_id", userId).maybeSingle();
    if (!firstRead.error) stored = asRecord(firstRead.data);
    else {
      readError = firstRead.error;
      const fallbackRead = await admin.from("brain_task_contexts").select("task_id,context,complexity,capabilities,estimated_steps,status").eq("task_id", taskId).eq("user_id", userId).maybeSingle();
      if (!fallbackRead.error) stored = asRecord(fallbackRead.data);
      else readError = fallbackRead.error;
    }
    const storedContext = asRecord(stored.context);
    const finalResponse = cleanText(stored.final_response ?? storedContext.final_response);
    if (readError || !stored.task_id || !finalResponse) return json({ error: "Completed task result is unavailable" }, 500);
    const storedResults = Array.isArray(storedContext.results) ? storedContext.results : [];
    return json({
      task_id: taskId,
      complexity: stored.complexity ?? storedContext.complexity ?? "easy",
      capabilities: stored.capabilities ?? storedContext.capabilities ?? ["text"],
      estimated_steps: stored.estimated_steps ?? storedContext.estimated_steps ?? 1,
      steps_completed: storedResults.length,
      response: finalResponse,
      route: "central-agent",
    });
  }
  if (reservation.allowed !== true) {
    const reservationReason = cleanText(reservation.error, 100);
    if (reservationReason === "task_in_progress" || reservationReason === "task_id_conflict") return json({ error: reservationReason }, 409);
    return json({ error: reservationReason || "daily_limit_reached" }, 429);
  }

  if (!internalWorker && body.mode === "enqueue") {
    const objective = cleanText(body.objective ?? body.message);
    // Reserve the maximum credit exposure before the queue can execute any provider call.
    // Final settlement later uses provider-reported tokens from agent_step_usage.
    const { data: creditPricing, error: creditPricingError } = await admin
      .from("suly_credit_pricing")
      .select("enabled,minimum_request_credits,input_credits_per_1k_tokens,output_credits_per_1k_tokens")
      .eq("id", 1)
      .maybeSingle();
    if (creditPricingError || !creditPricing || creditPricing.enabled !== true) {
      await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: 0, p_status: "failed" });
      return json({ error: "Agent credit pricing is unavailable" }, 503);
    }
    const inputRate = Math.max(0, Math.floor(Number(creditPricing.input_credits_per_1k_tokens) || 0));
    const outputRate = Math.max(0, Math.floor(Number(creditPricing.output_credits_per_1k_tokens) || 0));
    const minimumCredits = Math.max(1, Math.floor(Number(creditPricing.minimum_request_credits) || 0));
    const walletReservation = Math.max(minimumCredits, Math.ceil(reserveEstimate * Math.max(inputRate, outputRate) / 1000));
    if (!Number.isSafeInteger(walletReservation) || walletReservation <= 0 || walletReservation > 1000000000) {
      await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: 0, p_status: "failed" });
      return json({ error: "Agent credit reservation exceeds the safe limit" }, 422);
    }
    const { data: creditReservationData, error: creditReservationError } = await admin.rpc("reserve_credits", {
      p_user_id: userId,
      p_task_id: taskId,
      p_amount: walletReservation,
      p_conversation_id: null,
    });
    let creditReservation = asRecord(creditReservationData);
    if (creditReservationError) {
      // Resolve an ambiguous RPC response by checking the idempotent hold;
      // never release the Brain reservation if the wallet outcome is unknown.
      const { data: existingHold, error: holdLookupError } = await admin
        .from("suly_credit_holds")
        .select("reserved_amount,status")
        .eq("task_id", taskId)
        .eq("user_id", userId)
        .maybeSingle();
      if (holdLookupError) return json({ error: "Agent credit reservation outcome is unknown; retry safely" }, 503);
      if (existingHold?.status === "held") {
        creditReservation = { success: true, already_reserved: true, reserved_amount: existingHold.reserved_amount };
      } else {
        await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: 0, p_status: "failed" });
        return json({ error: "Agent credit reservation failed" }, 503);
      }
    }
    if (creditReservation.success !== true) {
      await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: 0, p_status: "failed" });
      const insufficient = creditReservation.error === "insufficient_credits";
      return json({
        error: insufficient ? "insufficient_credits" : "Agent credit reservation failed",
        required: creditReservation.required ?? walletReservation,
        balance: creditReservation.balance ?? null,
      }, insufficient ? 402 : 503);
    }

    const releaseEnqueueReservations = async () => {
      await admin.rpc("finalize_credits", {
        p_user_id: userId,
        p_task_id: taskId,
        p_actual_cost: 0,
        p_input_tokens: 0,
        p_output_tokens: 0,
        p_model_id: null,
        p_source: "brain_enqueue_rollback",
      });
      await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: 0, p_status: "failed" });
    };

    const idempotencyKey = `brain:${taskId}`;
    const { data: queued, error: queueError } = await admin.from("agent_task_jobs").insert({
      user_id: userId, task_id: taskId, job_type: "brain_task", idempotency_key: idempotencyKey,
      payload: { user_id: userId, task_id: taskId, objective }, priority: 10, max_attempts: 3,
    }).select("id,status").single();
    if (queueError?.code === "23505") {
      const { data: existing, error: existingError } = await admin.from("agent_task_jobs")
        .select("id,status,payload").eq("user_id", userId).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (!existingError && existing) {
        const existingPayload = asRecord(existing.payload);
        if (cleanText(existingPayload.objective) !== objective) {
          return json({ error: "task_id_conflict" }, 409);
        }
        return json({ task_id: taskId, job_id: existing.id, status: existing.status, queued: true, route: "brain-router" }, 202);
      }
      if (existingError) {
        // Keep the original usage reservation intact if the idempotent job
        // lookup is temporarily unavailable; a retry can recover it.
        return json({ error: "Could not recover the existing Brain task" }, 503);
      }
      // A different active job already occupies this user's queue slot.
      await releaseEnqueueReservations();
      return json({ error: "task_in_progress" }, 409);
    }
    if (queueError || !queued) {
      await releaseEnqueueReservations();
      return json({ error: "Could not enqueue Brain task" }, 503);
    }
    return json({ task_id: taskId, job_id: queued.id, status: queued.status, queued: true, route: "brain-router" }, 202);
  }

  return json({ error: "legacy_brain_route_disabled" }, 410);
}
Deno.serve(async (req) => {
  const configuredOrigins = Deno.env.get("WEB_CORS_ORIGIN") ?? "";
  const preflight = handleCorsPreflight(req, configuredOrigins);
  if (preflight) return preflight;
  let response: Response;
  try {
    response = await main(req);
  } catch {
    response = json({ error: "Internal brain-router error" }, 500);
  }
  return withCors(req, response, configuredOrigins);
});
