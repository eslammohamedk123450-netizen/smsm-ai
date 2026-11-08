import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-suly-health-check-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_OUTPUT_TOKENS = 16;
const MAX_PROBE_TIMEOUT_MS = 10_000;
const SCHEDULED_CONCURRENCY = 5;
const PROBE_PROMPT = "Reply with OK.";

type ModelRow = {
  id: number;
  name: string;
  provider_id: number;
  model_identifier: string;
  enabled: boolean;
  routing_group: string;
  response_timeout_ms: number | null;
};
type ProviderRow = {
  id: number;
  name: string;
  provider_type: string;
  base_url: string | null;
  enabled: boolean;
  timeout_seconds: number | null;
};
type ProbeResult = { status: "success" | "error"; duration_ms: number; error_code: string | null };
type CheckSummary = { checked: number; succeeded: number; failed: number; skipped: number };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeChatEndpoint(value: unknown, providerType?: string): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !host) return null;
    if (host === "localhost" || host === "metadata" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    if (host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host)) return null;
    const baseUrl = url.toString().replace(/\/+$/, "");
    const googleOpenAiPath = providerType === "google_ai" && !url.pathname.replace(/\/+$/, "").endsWith("/openai")
      ? "/openai"
      : "";
    return `${baseUrl}${googleOpenAiPath}/chat/completions`;
  } catch {
    return null;
  }
}

function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === "string") return part;
      const item = asRecord(part);
      return typeof item.text === "string" ? item.text : "";
    }).join("");
  }
  return "";
}

function isSafeKeyEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

async function authorizeRequest(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceClient: SupabaseClient,
): Promise<{ mode: "manual" | "scheduled" } | { response: Response }> {
  const scheduledSecret = request.headers.get("x-suly-health-check-secret");
  if (scheduledSecret) {
    const { data: expectedSecret, error } = await serviceClient.rpc("suly_service_get_model_health_check_token");
    if (error || typeof expectedSecret !== "string" || !isSafeKeyEqual(scheduledSecret, expectedSecret)) {
      return { response: jsonResponse({ error: "Unauthorized." }, 401) };
    }
    return { mode: "scheduled" };
  }

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return { response: jsonResponse({ error: "Authentication required." }, 401) };
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult, error: userError } = await userClient.auth.getUser();
  if (userError || !userResult.user) return { response: jsonResponse({ error: "Authentication required." }, 401) };
  const { data: isAdmin, error: adminError } = await userClient.rpc("suly_is_admin");
  if (adminError || isAdmin !== true) return { response: jsonResponse({ error: "Administrator access required." }, 403) };
  return { mode: "manual" };
}

async function probeModel(model: ModelRow, provider: ProviderRow, apiKey: string): Promise<ProbeResult> {
  const startedAt = Date.now();
  const endpoint = safeChatEndpoint(provider.base_url, provider.provider_type);
  if (!endpoint) return { status: "error", duration_ms: 0, error_code: "provider_url_invalid" };

  const configuredTimeout = Number(model.response_timeout_ms) || 10_000;
  const timeoutMs = Math.max(1_000, Math.min(MAX_PROBE_TIMEOUT_MS, configuredTimeout));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify({
        model: model.model_identifier,
        messages: [{ role: "user", content: PROBE_PROMPT }],
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
      }),
      signal: controller.signal,
      redirect: "error",
    });

    if (!response.ok) {
      return { status: "error", duration_ms: Date.now() - startedAt, error_code: `provider_http_${response.status}` };
    }
    if (!response.body) {
      return { status: "error", duration_ms: Date.now() - startedAt, error_code: "empty_response" };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("application/json")) {
      const payload = asRecord(await response.json().catch(() => null));
      const choices = Array.isArray(payload.choices) ? payload.choices : [];
      const firstChoice = asRecord(choices[0]);
      const message = asRecord(firstChoice.message);
      const text = contentText(message.content);
      return text.trim()
        ? { status: "success", duration_ms: Date.now() - startedAt, error_code: null }
        : { status: "error", duration_ms: Date.now() - startedAt, error_code: "empty_response" };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trimEnd();
          buffer = buffer.slice(newline + 1);
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (data && data !== "[DONE]") {
              try {
                const payload = asRecord(JSON.parse(data));
                const choices = Array.isArray(payload.choices) ? payload.choices : [];
                const firstChoice = asRecord(choices[0]);
                const delta = asRecord(firstChoice.delta);
                const text = contentText(delta.content);
                if (text.trim()) {
                  await reader.cancel().catch(() => undefined);
                  return { status: "success", duration_ms: Date.now() - startedAt, error_code: null };
                }
              } catch {
                // Ignore SSE metadata and partial provider frames.
              }
            }
          }
          newline = buffer.indexOf("\n");
        }
        if (done) break;
      }
    } finally {
      try { reader.releaseLock(); } catch { /* already released */ }
    }
    return { status: "error", duration_ms: Date.now() - startedAt, error_code: "empty_response" };
  } catch (error) {
    const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return {
      status: "error",
      duration_ms: Date.now() - startedAt,
      error_code: timedOut ? "model_timeout" : "provider_unreachable",
    };
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}

async function getProviderKey(serviceClient: SupabaseClient, providerId: number): Promise<string | null> {
  const { data, error } = await serviceClient.rpc("suly_service_get_provider_api_key", { p_provider_id: providerId });
  return !error && typeof data === "string" && data.length > 0 ? data : null;
}

async function recordProbe(
  serviceClient: SupabaseClient,
  model: ModelRow,
  provider: ProviderRow,
  runType: "manual" | "scheduled",
  checkKey: string,
  result: ProbeResult,
): Promise<void> {
  const { error } = await serviceClient.rpc("suly_record_model_probe", {
    p_model_id: model.id,
    p_provider_id: provider.id,
    p_model_name: model.name,
    p_provider_name: provider.name,
    p_run_type: runType,
    p_status: result.status,
    p_duration_ms: Math.max(0, Math.floor(result.duration_ms)),
    p_error_code: result.error_code,
    p_check_key: checkKey,
  });
  if (error) throw new Error("Could not persist health-check result.");
}

async function runManualTest(serviceClient: SupabaseClient, modelId: number): Promise<Response> {
  const { data: modelData, error: modelError } = await serviceClient
    .from("ai_models")
    .select("id,name,provider_id,model_identifier,enabled,routing_group,response_timeout_ms")
    .eq("id", modelId)
    .maybeSingle();
  if (modelError || !modelData) return jsonResponse({ error: "Model not found." }, 404);
  const model = modelData as ModelRow;

  const { data: providerData, error: providerError } = await serviceClient
    .from("ai_providers")
    .select("id,name,provider_type,base_url,enabled,timeout_seconds")
    .eq("id", model.provider_id)
    .maybeSingle();
  if (providerError || !providerData) return jsonResponse({ error: "Provider not found." }, 404);
  const provider = providerData as ProviderRow;
  if (!provider.enabled) {
    const skipped: ProbeResult = { status: "error", duration_ms: 0, error_code: "provider_disabled" };
    await recordProbe(serviceClient, model, provider, "manual", `manual:${model.id}:${crypto.randomUUID()}`, skipped);
    return jsonResponse({ model_id: model.id, status: "error", duration_ms: 0, error_code: "provider_disabled" });
  }

  const apiKey = await getProviderKey(serviceClient, provider.id);
  const result = apiKey
    ? await probeModel(model, provider, apiKey)
    : { status: "error", duration_ms: 0, error_code: "credential_unavailable" } satisfies ProbeResult;
  await recordProbe(serviceClient, model, provider, "manual", `manual:${model.id}:${crypto.randomUUID()}`, result);
  return jsonResponse({ model_id: model.id, status: result.status, duration_ms: result.duration_ms, error_code: result.error_code });
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function runScheduledChecks(serviceClient: SupabaseClient): Promise<Response> {
  const { data: modelData, error: modelError } = await serviceClient
    .from("ai_models")
    .select("id,name,provider_id,model_identifier,enabled,routing_group,response_timeout_ms")
    .eq("enabled", true)
    .neq("routing_group", "disabled")
    .order("id", { ascending: true })
    .limit(500);
  if (modelError) return jsonResponse({ error: "Could not load enabled models." }, 500);

  const models = (modelData ?? []) as ModelRow[];
  if (models.length === 0) return jsonResponse({ checked: 0, succeeded: 0, failed: 0, skipped: 0 });
  const providerIds = [...new Set(models.map((model) => model.provider_id))];
  const { data: providerData, error: providerError } = await serviceClient
    .from("ai_providers")
    .select("id,name,provider_type,base_url,enabled,timeout_seconds")
    .in("id", providerIds)
    .eq("enabled", true)
    .limit(500);
  if (providerError) return jsonResponse({ error: "Could not load enabled providers." }, 500);
  const providers = new Map<number, ProviderRow>((providerData ?? []).map((row) => [Number(row.id), row as ProviderRow]));
  const providerKeys = new Map<number, string | null>();
  await Promise.all(providerIds.map(async (providerId) => {
    const provider = providers.get(providerId);
    if (provider) providerKeys.set(providerId, await getProviderKey(serviceClient, providerId));
  }));

  const utcDay = new Date().toISOString().slice(0, 10);
  const results = await mapLimit(models, SCHEDULED_CONCURRENCY, async (model): Promise<"success" | "error" | "skipped"> => {
    const provider = providers.get(model.provider_id);
    if (!provider) return "skipped";
    const checkKey = `scheduled:${model.id}:${utcDay}`;
    const { data: existing, error: existingError } = await serviceClient
      .from("ai_model_probe_logs")
      .select("check_key")
      .eq("check_key", checkKey)
      .maybeSingle();
    if (existingError) return "error";
    if (existing) return "skipped";

    const apiKey = providerKeys.get(provider.id);
    const result: ProbeResult = !apiKey
      ? { status: "error", duration_ms: 0, error_code: "credential_unavailable" }
      : await probeModel(model, provider, apiKey);
    await recordProbe(serviceClient, model, provider, "scheduled", checkKey, result);
    return result.status;
  });

  const summary: CheckSummary = results.reduce((counts, status) => {
    counts.checked += 1;
    if (status === "success") counts.succeeded += 1;
    else if (status === "error") counts.failed += 1;
    else counts.skipped += 1;
    return counts;
  }, { checked: 0, succeeded: 0, failed: 0, skipped: 0 });
  return jsonResponse(summary);
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "Server configuration is incomplete." }, 500);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authorization = await authorizeRequest(request, supabaseUrl, anonKey, serviceClient);
  if ("response" in authorization) return authorization.response;

  let body: Record<string, unknown>;
  try { body = asRecord(await request.json()); }
  catch { return jsonResponse({ error: "Invalid JSON body." }, 400); }

  if (authorization.mode === "scheduled") {
    if (body.action !== "scheduled") return jsonResponse({ error: "Invalid scheduled action." }, 400);
    try { return await runScheduledChecks(serviceClient); }
    catch { return jsonResponse({ error: "Scheduled model checks failed." }, 500); }
  }

  if (body.action !== "test_model" || !Number.isInteger(body.model_id) || Number(body.model_id) < 1) {
    return jsonResponse({ error: "A valid model_id is required." }, 400);
  }
  try { return await runManualTest(serviceClient, Number(body.model_id)); }
  catch { return jsonResponse({ error: "Model test failed." }, 500); }
});
