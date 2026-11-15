import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parseCentralAgentResult, toBrainTaskStepRows } from "./central_agent_result.ts";

const CAPABILITIES = ["text", "coding", "image", "video", "vision", "audio", "reasoning", "web_search"] as const;
type Capability = typeof CAPABILITIES[number];
type Tier = "router" | "worker" | "planner" | "merger";
type TierRow = { tier_name: Tier; priority: number; model_id: string; max_tokens_per_task: number; model: { id: string; name: string; legacy_ai_model_id: number | null; is_active: boolean; model_capabilities?: Array<{ capability_key: Capability }> } | null };
type Step = { step_index: number; capability: Capability; description: string; expected_inputs: Record<string, unknown> };
type InvocationResult = { text: string; tokens: number; usedEstimate: boolean };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function cleanText(value: unknown, max = 50000): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function estimateTokens(value: unknown): number { return Math.max(1, Math.ceil(cleanText(value).length / 4)); }
function numericTokens(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}
function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { const parsed = JSON.parse(trimmed); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null; } catch { return null; }
}
function normalizeCapability(value: unknown): Capability { return CAPABILITIES.includes(String(value) as Capability) ? String(value) as Capability : "text"; }
function normalizeSteps(value: unknown): Step[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((item, index) => {
    const row = asRecord(item);
    return { step_index: index + 1, capability: normalizeCapability(row.capability ?? row.capability_key), description: cleanText(row.description, 5000) || `تنفيذ الجزء ${index + 1} من المهمة`, expected_inputs: asRecord(row.expected_inputs ?? row.inputs) };
  });
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

  const [{ data: profile, error: profileError }, { data: tierRows, error: tiersError }] = await Promise.all([
    admin.from("suly_profiles").select("subscription_tier,is_banned").eq("id", userId).maybeSingle(),
    internalWorker
      ? Promise.resolve({ data: [], error: null })
      : admin.from("brain_tiers").select("tier_name,priority,model_id,max_tokens_per_task,model:models(id,name,legacy_ai_model_id,is_active,model_capabilities(capability_key))").eq("is_active", true).order("tier_name").order("priority").limit(100),
  ]);
  if (profileError || !profile) return json({ error: "Application profile is missing" }, 403);
  if (profile.is_banned) return json({ error: "This account is suspended" }, 403);
  if (tiersError) return json({ error: "Brain tiers could not be loaded" }, 500);

  if (internalWorker) {
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
        execution_mode: "agent",
        routing_mode: "auto",
        stream: false,
        max_tokens: 4096,
      }),
    });
    const centralResult = parseCentralAgentResult(await response.json().catch(() => ({})));
    const finalResponse = centralResult?.response ?? "";
    const actualTokens = (centralResult?.inputTokens ?? 0) + (centralResult?.outputTokens ?? 0);
    const agentSteps = centralResult?.agentSteps ?? [];
    const completedSteps = centralResult?.completedSteps ?? 0;
    const estimatedSteps = centralResult?.estimatedSteps ?? 1;
    const complexity = centralResult?.complexity ?? "easy";
    const capabilities = centralResult?.capabilities ?? ["text"];

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
      await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: actualTokens, p_status: "failed" });
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
      await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: actualTokens, p_status: "failed" });
      return json({ error: "Could not persist the central Agent result", task_id: taskId }, 500);
    }
    const { error: stepPersistenceError } = await admin.from("brain_task_steps")
      .upsert(toBrainTaskStepRows(taskId, agentSteps), { onConflict: "task_id,step_index" });
    if (stepPersistenceError) {
      await admin.from("brain_task_contexts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("task_id", taskId).eq("user_id", userId);
      await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: actualTokens, p_status: "failed" });
      return json({ error: "Could not persist central Agent progress", task_id: taskId }, 500);
    }
    const { error: finalizationError } = await admin.rpc("brain_finalize_usage", {
      p_task_id: taskId,
      p_actual_tokens: actualTokens,
      p_status: "completed",
    });
    if (finalizationError) return json({ error: "Could not finalize Brain task usage", task_id: taskId }, 500);

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
  const tiers = (tierRows ?? []) as unknown as TierRow[];
  const byTier = (name: Tier, requiredCapability: Capability = "text") => tiers
    .filter((row) => row.tier_name === name && row.model?.is_active && row.model.model_capabilities?.some((item) => item.capability_key === requiredCapability))
    .sort((a, b) => a.priority - b.priority);
  const maxConfigured = Math.max(1024, ...tiers.map((row) => Math.max(128, Number(row.max_tokens_per_task) || 1024)));
  const reserveEstimate = Math.min(100000, Math.max(4096, maxConfigured + maxConfigured + maxConfigured * 8 + maxConfigured));
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
      route: "brain-router",
    });
  }
  if (reservation.allowed !== true) {
    const reservationReason = cleanText(reservation.error, 100);
    if (reservationReason === "task_in_progress" || reservationReason === "task_id_conflict") return json({ error: reservationReason }, 409);
    return json({ error: reservationReason || "daily_limit_reached" }, 429);
  }

  if (!internalWorker && body.mode === "enqueue") {
    const objective = cleanText(body.objective ?? body.message);
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
      // Keep the original usage reservation intact if the idempotent job lookup
      // is temporarily unavailable; a retry with the same task ID can recover it.
      return json({ error: "Could not recover the existing Brain task" }, 503);
    }
    if (queueError || !queued) {
      await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: 0, p_status: "failed" });
      return json({ error: "Could not enqueue Brain task" }, 503);
    }
    return json({ task_id: taskId, job_id: queued.id, status: queued.status, queued: true, route: "brain-router" }, 202);
  }

  let totalTokens = 0;
  let finalizationAttempted = false;
  const finalizeUsage = async (status: "completed" | "failed"): Promise<void> => {
    if (finalizationAttempted) return;
    finalizationAttempted = true;
    const { error } = await admin.rpc("brain_finalize_usage", { p_task_id: taskId, p_actual_tokens: totalTokens, p_status: status });
    if (error) throw new Error("usage_finalization_failed");
  };
  const markFailed = async (): Promise<void> => {
    try { await admin.from("brain_task_contexts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("task_id", taskId).eq("user_id", userId); } catch { /* best effort */ }
    try { await finalizeUsage("failed"); } catch { /* the reservation must not be finalized more than once */ }
  };

  const authHeader = `Bearer ${userJwt}`;
  const attemptLog = async (tier: Tier, row: TierRow, attemptNo: number, status: string, errorCode: string | null, errorReason: string | null, tokens = 0) => {
    try { await admin.from("brain_attempt_logs").insert({ task_id: taskId, tier_name: tier, model_id: row.model_id, attempt_no: attemptNo, status, error_code: errorCode, error_reason: cleanText(errorReason, 1000) || null, tokens_used: Math.max(0, Math.floor(tokens)) }); } catch { /* attempt logging must not alter task execution */ }
  };
  const invokeLegacy = async (tier: Tier, row: TierRow, prompt: string): Promise<InvocationResult | null> => {
    const legacyId = row.model?.legacy_ai_model_id;
    if (!legacyId) { await attemptLog(tier, row, 1, "error", "model_not_linked", "The brain model is not linked to ai_models"); return null; }
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json", "x-suly-internal-brain-key": serviceRoleKey },
        body: JSON.stringify({ message: prompt, model_id: legacyId, routing_mode: "manual", max_tokens: Math.min(4096, Math.max(128, Number(row.max_tokens_per_task) || 1024)), stream: false, request_id: crypto.randomUUID(), feature_key: "brain_system", user_id: userId }),
      });
      const payload = asRecord(await response.json().catch(() => ({})));
      const responseObject = asRecord(payload.response);
      const choices = Array.isArray(responseObject.choices) ? responseObject.choices : [];
      const first = asRecord(choices[0]);
      const message = asRecord(first.message);
      const text = cleanText(message.content);
      if (!response.ok) { await attemptLog(tier, row, 1, response.status === 504 ? "timeout" : "error", `ai_router_http_${response.status}`, "ai-router request failed"); return null; }
      if (!text) { await attemptLog(tier, row, 1, "empty", "empty_response", "The model returned no text"); return null; }

      const usage = asRecord(payload.usage ?? responseObject.usage);
      const inputReported = numericTokens(usage.prompt_tokens ?? usage.input_tokens ?? usage.input_tokens_total);
      const outputReported = numericTokens(usage.completion_tokens ?? usage.output_tokens ?? usage.output_tokens_total);
      const hasReportedUsage = inputReported !== null || outputReported !== null;
      const inputTokens = inputReported ?? estimateTokens(prompt);
      const outputTokens = outputReported ?? estimateTokens(text);
      const tokens = inputTokens + outputTokens;
      const usedEstimate = !hasReportedUsage || inputReported === null || outputReported === null;
      totalTokens += tokens;
      await attemptLog(tier, row, 1, "success", null, usedEstimate ? "token_estimate_fallback_input_plus_output" : null, tokens);
      return { text, tokens, usedEstimate };
    } catch {
      await attemptLog(tier, row, 1, "error", "fetch_error", "ai-router invocation failed");
      return null;
    }
  };
  const invokeTier = async (tier: Tier, prompt: string, requiredCapability: Capability = "text"): Promise<(InvocationResult & { row: TierRow }) | null> => {
    const candidates = byTier(tier, requiredCapability);
    for (const row of candidates) {
      const result = await invokeLegacy(tier, row, prompt);
      if (result) return { ...result, row };
    }
    return null;
  };

  try {
    const routerPrompt = `أنت Router رخيص لمهمة جديدة. لا تنفذ المهمة. أعد JSON فقط بالشكل {"complexity":"easy|complex","capabilities":["text|coding|image|video|vision|audio|reasoning|web_search"],"estimated_steps":number}. قدّر الخطوات حسب حجم المهمة الحقيقي: بحث ويب مباشر خطوة واحدة، ومشروع كامل عدة خطوات مناسبة، ولا ترفع العدد بلا سبب. المهمة:\n${objective}`;
    const routerResult = await invokeTier("router", routerPrompt);
    if (!routerResult) {
      await markFailed();
      return json({ error: "Router models failed", task_id: taskId }, 502);
    }
    const routerJson = parseJsonObject(routerResult.text) ?? {};
    const complexity = routerJson.complexity === "complex" ? "complex" : "easy";
    const capabilities = Array.isArray(routerJson.capabilities) ? routerJson.capabilities.map(normalizeCapability).filter((value, index, list) => list.indexOf(value) === index).slice(0, CAPABILITIES.length) : ["text"] as Capability[];
    const estimatedSteps = Math.max(1, Math.min(100, Number(routerJson.estimated_steps) || 1));

    const context = { objective, complexity, capabilities, estimated_steps: estimatedSteps, router: routerJson, steps: [], results: [] };
    const { error: contextError } = await admin.from("brain_task_contexts").upsert({ task_id: taskId, user_id: userId, objective, complexity, capabilities, estimated_steps: estimatedSteps, context, status: "running", updated_at: new Date().toISOString() });
    if (contextError) throw new Error("task_context_write_failed");

    let steps: Step[] = [];
    if (complexity === "complex") {
      const plannerResult = await invokeTier("planner", `أنت Planner. قسّم المهمة التالية إلى عدد عادل من الخطوات، لا تستخدم عددًا ثابتًا ولا تقسّم الطلب الصغير بلا داع. أعد JSON فقط بالشكل {"steps":[{"capability":"...","description":"...","expected_inputs":{}}]}. يجب أن تكون كل capability من: ${CAPABILITIES.join(", ")}. المهمة: ${objective}\nالقدرات المطلوبة: ${capabilities.join(", ")}`);
      if (plannerResult) steps = normalizeSteps(parseJsonObject(plannerResult.text)?.steps);
    }
    if (steps.length === 0) steps = [{ step_index: 1, capability: capabilities[0] ?? "text", description: objective, expected_inputs: { objective } }];
    const stepRows = steps.map((step) => ({ task_id: taskId, step_index: step.step_index, capability_key: step.capability, description: step.description, expected_inputs: step.expected_inputs }));
    const { error: stepsError } = await admin.from("brain_task_steps").upsert(stepRows, { onConflict: "task_id,step_index" });
    if (stepsError) throw new Error("task_steps_write_failed");

    const results: Array<{ step_index: number; capability: Capability; result: string }> = [];
    for (const step of steps) {
      const workerPrompt = `أنت Worker. نفّذ خطوة واحدة فقط من task_context التالي. إذا كانت الخطوة أكبر من قدرتك، حاول تنظيمها داخليًا أو أعد صياغة نتيجة قابلة للتنفيذ بدل الرفض. أعد النتيجة النصية فقط دون وصف داخلي.\nالمهمة الأصلية: ${objective}\nالخطوة ${step.step_index}: ${step.description}\nالقدرة: ${step.capability}\nالمدخلات المتوقعة: ${JSON.stringify(step.expected_inputs)}\nالسياق المشترك: ${JSON.stringify(results).slice(-12000)}`;
      const workerResult = await invokeTier("worker", workerPrompt, step.capability);
      if (!workerResult) {
        const { error } = await admin.from("brain_task_steps").update({ status: "failed" }).eq("task_id", taskId).eq("step_index", step.step_index);
        if (error) throw new Error("task_step_update_failed");
        continue;
      }
      results.push({ step_index: step.step_index, capability: step.capability, result: workerResult.text });
      const { error } = await admin.from("brain_task_steps").update({ status: "completed", result: { text: workerResult.text } }).eq("task_id", taskId).eq("step_index", step.step_index);
      if (error) throw new Error("task_step_update_failed");
    }
    if (results.length === 0) {
      await admin.from("brain_task_contexts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("task_id", taskId).eq("user_id", userId);
      await markFailed();
      return json({ error: "All worker models failed", task_id: taskId }, 502);
    }

    const mergerResult = await invokeTier("merger", `أنت Merger. اجمع نتائج الخطوات من task_context وأخرج إجابة نهائية واضحة للمستخدم. لا تذكر العقول أو الـfallback أو البنية الداخلية. إذا كانت نتيجة خطوة ناقصة، استخدم أفضل ما توفر ولا تخترع حقائق. المهمة الأصلية: ${objective}\nنتائج الخطوات: ${JSON.stringify(results).slice(-30000)}`);
    const finalText = mergerResult?.text ?? results.map((item) => item.result).join("\n\n");
    const completedContext = { ...context, steps, results, final_response: finalText };
    const { error: completionWriteError } = await admin.from("brain_task_contexts").update({ context: completedContext, final_response: finalText, status: "completed", updated_at: new Date().toISOString() }).eq("task_id", taskId).eq("user_id", userId);
    if (completionWriteError) throw new Error("task_completion_write_failed");
    await finalizeUsage("completed");
    return json({ task_id: taskId, complexity, capabilities, estimated_steps: estimatedSteps, steps_completed: results.length, response: finalText, route: "brain-router" });
  } catch {
    await markFailed();
    return json({ error: "Brain task failed", task_id: taskId }, 500);
  }
}

Deno.serve(async (req) => {
  try { return await main(req); } catch { return json({ error: "Internal brain-router error" }, 500); }
});
