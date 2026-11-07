// supabase/functions/sync-models/index.ts
//
// Admin-only onboarding for AI providers:
//   1. verifies the caller with their own JWT and `suly_is_admin()`
//   2. stores the provider row in `ai_providers`
//   3. stores the API key in Supabase Vault and links it through `api_key_vault_id`
//   4. discovers the provider's models and inserts the missing ones into `ai_models`
//
// The key never leaves the server: it is never returned to the client, never logged,
// and never written to a column readable by `authenticated`.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Provider types that map to an existing adapter in ai-router/providers. */
const ALLOWED_PROVIDER_TYPES = [
  "openai",
  "anthropic",
  "google_ai",
  "deepseek",
  "openrouter",
  "groq",
  "mistral",
  "together",
  "xai",
  "perplexity",
  "cohere",
  "custom",
] as const;

/** Non-chat model families that must not be inserted into the chat routing catalog. */
const NON_CHAT_PATTERN =
  /(embed|embedding|whisper|tts|speech|audio|dall-e|image|imagen|moderation|rerank|guard|veo|sora|stable-diffusion|flux|bge-|e5-)/i;

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/** Accepts only absolute https URLs; blocks localhost and private ranges to avoid SSRF. */
function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.username || url.password || url.search || url.hash || !host) return null;
    if (host === "localhost" || host === "metadata" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    if (host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host)) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

interface DiscoveryResult {
  identifiers: string[];
  warning: string | null;
}

/** Reads the provider's model list. Failures are reported, never thrown, so the provider is still saved. */
async function discoverModels(providerType: string, baseUrl: string, apiKey: string): Promise<DiscoveryResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    let endpoint: string;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (providerType === "google_ai") {
      endpoint = `${baseUrl}/models?key=${encodeURIComponent(apiKey)}`;
    } else if (providerType === "anthropic") {
      endpoint = `${baseUrl}/models`;
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      endpoint = `${baseUrl}/models`;
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const response = await fetch(endpoint, { method: "GET", headers, signal: controller.signal });
    if (!response.ok) {
      return { identifiers: [], warning: `لم يستجب المزود لقائمة النماذج (HTTP ${response.status}).` };
    }
    const payload = asRecord(await response.json());
    const rows: unknown[] = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.models)
        ? payload.models
        : Array.isArray((payload as { data?: { models?: unknown[] } }).data?.models)
          ? ((payload as { data: { models: unknown[] } }).data.models)
          : [];
    const identifiers: string[] = [];
    for (const row of rows) {
      const item = asRecord(row);
      const raw = cleanText(item.id, 200) || cleanText(item.name, 200);
      if (!raw) continue;
      const identifier = raw.replace(/^models\//, "");
      if (NON_CHAT_PATTERN.test(identifier)) continue;
      if (!identifiers.includes(identifier)) identifiers.push(identifier);
    }
    return { identifiers, warning: identifiers.length === 0 ? "لم يُعثر على نماذج دردشة لدى المزود." : null };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "انتهت مهلة الاتصال بالمزود." : "تعذر الاتصال بالمزود.";
    return { identifiers: [], warning: reason };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Inserts models that do not exist yet for this provider. */
async function insertMissingModels(
  supabase: SupabaseClient,
  providerId: number,
  identifiers: string[],
): Promise<{ created: number; failed: string | null }> {
  if (identifiers.length === 0) return { created: 0, failed: null };
  const { data: existing, error: existingError } = await supabase
    .from("ai_models")
    .select("model_identifier")
    .eq("provider_id", providerId)
    .limit(2000);
  if (existingError) return { created: 0, failed: existingError.message };
  const known = new Set((existing ?? []).map((row) => String((row as { model_identifier: unknown }).model_identifier)));
  const missing = identifiers.filter((identifier) => !known.has(identifier));
  if (missing.length === 0) return { created: 0, failed: null };
  const rows = missing.map((identifier) => ({
    provider_id: providerId,
    name: identifier,
    model_identifier: identifier,
    description: null,
    input_price: 0,
    output_price: 0,
    context_window: 32768,
    capabilities_json: JSON.stringify({ chat: true }),
    enabled: true,
    priority: 50,
    fallback_eligible: true,
    routing_group: "free_race",
    allowed_tiers: ["free", "lite", "pro", "max"],
  }));
  const { error: insertError } = await supabase.from("ai_models").upsert(rows, {
    onConflict: "provider_id,model_identifier",
    ignoreDuplicates: true,
  });
  if (insertError) return { created: 0, failed: insertError.message };
  return { created: rows.length, failed: null };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: "Server configuration is incomplete." }, 500);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const userJwt = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!userJwt) return jsonResponse({ error: "A signed-in user's Bearer access token is required." }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(userJwt);
  if (authError || !authData.user) return jsonResponse({ error: "Invalid or expired user access token." }, 401);

  // Admin check must run as the caller so auth.uid() is populated inside suly_is_admin().
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: adminError } = await userClient.rpc("suly_is_admin");
  if (adminError) {
    console.error("suly_is_admin failed:", adminError.message);
    return jsonResponse({ error: "Could not verify administrator rights." }, 500);
  }
  if (isAdmin !== true) return jsonResponse({ error: "Administrator rights are required." }, 403);

  let body: Record<string, unknown>;
  try {
    body = asRecord(await request.json());
  } catch {
    return jsonResponse({ error: "A JSON body is required." }, 400);
  }

  const action = cleanText(body.action, 40) || "create_provider";

  if (action === "sync_models") {
    const providerId = Number(body.provider_id);
    if (!Number.isSafeInteger(providerId) || providerId <= 0) {
      return jsonResponse({ error: "A valid provider_id is required." }, 422);
    }
    const { data: provider, error: providerError } = await supabase
      .from("ai_providers")
      .select("id,name,provider_type,base_url,api_key_vault_id")
      .eq("id", providerId)
      .maybeSingle();
    if (providerError) return jsonResponse({ error: "Could not read the provider." }, 500);
    if (!provider) return jsonResponse({ error: "Provider not found." }, 404);
    const baseUrl = safeHttpsUrl(String(provider.base_url ?? ""));
    if (!baseUrl) return jsonResponse({ error: "The provider has no valid HTTPS base URL." }, 422);
    const { data: key, error: keyError } = await supabase.rpc("suly_service_get_provider_api_key", {
      p_provider_id: providerId,
    });
    if (keyError || typeof key !== "string" || key.length === 0) {
      return jsonResponse({ error: "The stored API key could not be read for this provider." }, 422);
    }
    const discovery = await discoverModels(String(provider.provider_type), baseUrl, key);
    const insertion = await insertMissingModels(supabase, providerId, discovery.identifiers);
    await supabase.from("ai_providers").update({
      last_test_status: insertion.failed ? "error" : "success",
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", providerId);
    return jsonResponse({
      success: !insertion.failed,
      discovered: discovery.identifiers.length,
      created: insertion.created,
      warning: insertion.failed ?? discovery.warning,
    });
  }

  if (action !== "create_provider") return jsonResponse({ error: "Unknown action." }, 400);

  const provider = asRecord(body.provider);
  const name = cleanText(provider.name, 120);
  const providerType = cleanText(provider.provider_type, 40).toLowerCase();
  const baseUrl = safeHttpsUrl(cleanText(provider.base_url, 300));
  const description = cleanText(provider.description, 300);
  const apiKey = typeof provider.api_key === "string" ? provider.api_key.trim() : "";

  if (!name) return jsonResponse({ error: "The provider name is required." }, 422);
  if (!ALLOWED_PROVIDER_TYPES.includes(providerType as (typeof ALLOWED_PROVIDER_TYPES)[number])) {
    return jsonResponse({ error: "Unsupported provider type." }, 422);
  }
  if (!baseUrl) return jsonResponse({ error: "A valid https base URL is required." }, 422);
  if (apiKey.length < 8 || apiKey.length > 400) return jsonResponse({ error: "A valid API key is required." }, 422);

  // The SECURITY DEFINER RPC verifies the admin again, performs an idempotent
  // upsert by provider name, and stores/replaces the credential in Supabase Vault.
  const { data: providerIdResult, error: providerSaveError } = await supabase.rpc("suly_admin_add_provider", {
    p_user_id: authData.user.id,
    p_name: name,
    p_provider_type: providerType,
    p_base_url: baseUrl,
    p_description: description,
    p_api_key: apiKey,
  });
  if (providerSaveError || !Number.isSafeInteger(Number(providerIdResult)) || Number(providerIdResult) <= 0) {
    console.error("suly_admin_add_provider failed:", providerSaveError?.code ?? "no_provider_id");
    return jsonResponse({ error: "تعذر حفظ المزود بأمان. تحقق من صلاحية المشرف وبيانات المزود." }, 500);
  }
  const providerId = Number(providerIdResult);
  const discovery = await discoverModels(providerType, baseUrl, apiKey);
  const insertion = await insertMissingModels(supabase, providerId, discovery.identifiers);

  await supabase.from("ai_providers").update({
    last_test_status: insertion.failed ? "error" : "success",
    last_tested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", providerId);

  return jsonResponse({
    success: true,
    provider_id: providerId,
    discovered: discovery.identifiers.length,
    created: insertion.created,
    warning: insertion.failed ?? discovery.warning,
  });
});
