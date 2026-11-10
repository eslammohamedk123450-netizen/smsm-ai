import { randomUUID } from "expo-crypto";
import { supabase } from "../../lib/supabase/client";
import { getMediaDeliveryUrl } from "../media/media-service";

export interface ProviderInput {
  name: string;
  provider_type: string;
  base_url: string;
  description: string;
  api_key: string;
}
export interface PricingPlan {
  id: number;
  name: string;
  price: number;
  max_requests: number;
  daily_credits: number;
  enabled: boolean;
  updated_at?: string;
}
export interface PricingFeature {
  id: number;
  plan_id: number;
  title: string;
  value: string;
  sort_order: number;
  is_active: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: "planner" | "thinker" | "worker" | "reviewer" | "coordinator";
  system_prompt: string;
  model_fallback_chain: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HimsActivationCode {
  id: string;
  feature_key: string;
  label: string | null;
  /** Full code, readable only through the admin-guarded RPC so it can be copied again. */
  code_plain: string | null;
  code_fingerprint: string;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface HimsResource {
  id: string;
  feature_key: string;
  title: string;
  url: string;
  media_asset_id?: string | null;
  kind: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

async function requireAdmin(): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("سجّل الدخول مجددًا.");
  const { data, error } = await supabase.rpc("suly_is_admin");
  if (error || data !== true) throw new Error("يتطلب هذا الإجراء صلاحية مشرف موثقة.");
}

function describeFunctionFailure(error: unknown, functionName: string): string {
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  if (status === 404) return `وظيفة ${functionName} غير منشورة على مشروع Supabase بعد، لذلك لم يُحفظ المزود.`;
  if (status === 401 || status === 403) return `رفضت وظيفة ${functionName} الطلب. تحقق من صلاحية المشرف على السيرفر.`;
  if (status === 400 || status === 422) return `رفضت وظيفة ${functionName} البيانات. تحقق من صحة المفتاح والرابط.`;
  return `تعذر الوصول إلى وظيفة ${functionName}. لم يُحفظ المزود ولم يُخزَّن المفتاح.`;
}

export const adminService = {
  async getHimsActivationCodes(): Promise<HimsActivationCode[]> {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_list_activation_codes", { p_feature_key: "hims" });
    if (error) throw error;
    return (data ?? []) as HimsActivationCode[];
  },
  async createHimsActivationCode(input: { code: string; label: string; maxUses: number | null; expiresAt: string | null }) {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_create_activation_code", {
      p_feature_key: "hims",
      p_code: input.code.trim().toUpperCase(),
      p_label: input.label.trim() || null,
      p_max_uses: input.maxUses,
      p_expires_at: input.expiresAt,
    });
    if (error) throw error;
    return data as { success?: boolean; id?: string; feature_key?: string; code?: string; command?: string };
  },
  async getHimsResources(): Promise<HimsResource[]> {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_list_feature_resources_v2", { p_feature_key: "hims" });
    if (error) throw error;
    return Promise.all(((data ?? []) as HimsResource[]).map(async (resource) => ({
      ...resource,
      url: resource.media_asset_id ? await getMediaDeliveryUrl(resource.media_asset_id) : resource.url ?? "",
    })));
  },
  async createHimsResource(input: { title: string; url: string; kind: string; description: string; mediaAssetId?: string | null }) {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_upsert_feature_resource_v2", {
      p_feature_key: "hims",
      p_title: input.title.trim(),
      p_url: input.mediaAssetId ? null : input.url.trim(),
      p_kind: input.kind.trim() || "lecture",
      p_description: input.description.trim() || null,
      p_is_active: true,
      p_media_asset_id: input.mediaAssetId ?? null,
    });
    if (error) throw error;
    return data as { success?: boolean; id?: string; feature_key?: string };
  },
  async getProviders() {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_list_providers");
    if (error) throw error;
    return data ?? [];
  },

  async createProvider(input: ProviderInput) {
    await requireAdmin();
    const { data, error } = await supabase.functions.invoke("sync-models", {
      body: { action: "create_provider", provider: input },
    });
    if (error) throw new Error(describeFunctionFailure(error, "sync-models"));
    if (!data || typeof data !== "object" || data.success !== true) {
      throw new Error("لم تقبل وظيفة المزامنة المزوّد. تحقق من البيانات ثم أعد المحاولة.");
    }
    return {
      discovered: Number(data.discovered ?? 0),
      created: Number(data.created ?? 0),
      warning: typeof data.warning === "string" && data.warning.length > 0 ? data.warning : null,
    };
  },

  async syncProviderModels(providerId: number) {
    await requireAdmin();
    const { data, error } = await supabase.functions.invoke("sync-models", {
      body: { action: "sync_models", provider_id: providerId },
    });
    if (error) throw new Error(describeFunctionFailure(error, "sync-models"));
    if (!data || typeof data !== "object") throw new Error("لم تُرجع وظيفة المزامنة نتيجة.");
    if (data.success !== true) throw new Error(typeof data.warning === "string" && data.warning ? data.warning : "تعذرت مزامنة نماذج هذا المزوّد.");
    return {
      discovered: Number(data.discovered ?? 0),
      created: Number(data.created ?? 0),
      warning: typeof data.warning === "string" && data.warning.length > 0 ? data.warning : null,
    };
  },

  async setProviderEnabled(providerId: number, enabled: boolean) {
    await requireAdmin();
    const { error } = await supabase.rpc("suly_admin_set_provider_enabled", { p_provider_id: providerId, p_enabled: enabled });
    if (error) throw error;
  },

  async setProviderLifecycle(providerId: number, enabled: boolean, hideModels: boolean) {
    await requireAdmin();
    const { error } = await supabase.rpc("suly_admin_set_provider_lifecycle", { p_provider_id: providerId, p_enabled: enabled, p_hide_models: hideModels });
    if (error) throw error;
  },

  async deleteProvider(providerId: number) {
    await requireAdmin();
    const { error } = await supabase.rpc("suly_admin_delete_provider", { p_provider_id: providerId });
    if (error) throw error;
  },

  async updateProvider(providerId: number, input: { name: string; baseUrl: string; description: string; apiKey?: string }) {
    await requireAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc("suly_admin_update_provider", {
      p_user_id: user?.id,
      p_provider_id: providerId,
      p_name: input.name.trim(),
      p_base_url: input.baseUrl.trim(),
      p_description: input.description.trim(),
      p_api_key: input.apiKey?.trim() || null,
    });
    if (error) throw error;
    if (!data?.success) throw new Error("تعذر حفظ بيانات المفتاح.");
  },

  async getModelsOverview() {
    await requireAdmin();
    const [modelsResult, healthResult, probeResult, settingsResult, providers] = await Promise.all([
      supabase.from("ai_models")
        .select("id,name,provider_id,model_identifier,enabled,priority,context_window,routing_group,allowed_tiers,capabilities_json,response_timeout_ms,restriction_failure_threshold,restriction_window_minutes")
        .order("priority", { ascending: false }).order("name").limit(500),
      supabase.from("ai_model_health")
        .select("model_id,total_attempts,successful_attempts,failed_attempts,consecutive_failures,last_attempt_at,last_success_at,last_failure_at,last_status,last_error_code,last_error_reason,average_latency_ms,auto_restricted,restriction_reason,restricted_at")
        .limit(1000),
      supabase.from("ai_model_probe_state")
        .select("model_id,consecutive_scheduled_failures,consecutive_scheduled_successes,last_scheduled_status,last_scheduled_at,last_error_code")
        .limit(1000),
      supabase.from("ai_router_settings")
        .select("id,free_race_timeout_ms,paid_fallback_enabled,paid_fallback_timeout_ms,max_parallel_free_models,health_auto_restrict_enabled")
        .eq("id", 1).maybeSingle(),
      this.getProviders(),
    ]);
    if (modelsResult.error) throw modelsResult.error;
    if (healthResult.error) throw healthResult.error;
    if (probeResult.error) throw probeResult.error;
    if (settingsResult.error) throw settingsResult.error;
    const providerNames = new Map<number, string>(providers.map((item: { id: number; name?: string | null; provider_type?: string | null }) => [Number(item.id), String(item.name ?? item.provider_type ?? "—")]));
    const providerEnabled = new Map<number, boolean>(providers.map((item: { id: number; enabled?: boolean }) => [Number(item.id), item.enabled === true]));
    const health = new Map<number, Record<string, unknown>>((healthResult.data ?? []).map((row) => [Number(row.model_id), row]));
    const probe = new Map<number, Record<string, unknown>>((probeResult.data ?? []).map((row) => [Number(row.model_id), row]));
    return {
      models: (modelsResult.data ?? []).map((row) => ({ ...row, provider_name: providerNames.get(Number(row.provider_id)) ?? "—", provider_enabled: providerEnabled.get(Number(row.provider_id)) ?? false, health: health.get(Number(row.id)) ?? null, probe: probe.get(Number(row.id)) ?? null })),
      settings: settingsResult.data,
    };
  },

  async updateModel(modelId: number, changes: Record<string, unknown>) {
    await requireAdmin();
    const allowed = ["enabled", "priority", "routing_group", "allowed_tiers", "response_timeout_ms", "restriction_failure_threshold", "restriction_window_minutes"];
    if (Object.keys(changes).some((key) => !allowed.includes(key))) throw new Error("حقل تعديل غير مسموح.");
    const { error } = await supabase.from("ai_models").update(changes).eq("id", modelId);
    if (error) throw error;
  },

  async updateRouterSettings(changes: {
    free_race_timeout_ms: number;
    paid_fallback_enabled: boolean;
    paid_fallback_timeout_ms: number;
    max_parallel_free_models: number;
    health_auto_restrict_enabled: boolean;
  }) {
    await requireAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("ai_router_settings").update({ ...changes, updated_by: user?.id, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw error;
  },

  async resetModelHealth(modelId: number) {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_reset_model_health", { p_model_id: modelId });
    if (error) throw error;
    return data;
  },

  async getModelAttempts(modelId: number) {
    await requireAdmin();
    const { data, error } = await supabase.from("ai_model_attempt_logs")
      .select("attempt_status,duration_ms,error_code,error_reason,created_at")
      .eq("model_id", modelId).order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return data ?? [];
  },

  async getModelProbeLogs(modelId: number) {
    await requireAdmin();
    const { data, error } = await supabase.from("ai_model_probe_logs")
      .select("run_type,status,duration_ms,error_code,checked_at,model_name,provider_name")
      .eq("model_id", modelId).order("checked_at", { ascending: false }).limit(20);
    if (error) throw error;
    return data ?? [];
  },

  async testModel(modelId: number) {
    await requireAdmin();
    const { data, error } = await supabase.functions.invoke("model-health-check", {
      body: { action: "test_model", model_id: modelId },
    });
    if (error) throw new Error(describeFunctionFailure(error, "model-health-check"));
    if (!data || typeof data !== "object" || !["success", "error"].includes(String(data.status))) {
      throw new Error("لم تُرجع وظيفة فحص النموذج نتيجة صالحة.");
    }
    return data as { model_id: number; status: "success" | "error"; duration_ms: number; error_code: string | null };
  },
  async testModelsBatch(modelIds: number[], onResult?: (result: { modelId: number; status: "success" | "error"; durationMs: number; errorCode: string | null }) => void) {
    const results: Array<{ modelId: number; status: "success" | "error"; durationMs: number; errorCode: string | null }> = [];
    const queue = [...new Set(modelIds)].slice(0, 500);
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const modelId = queue[cursor++];
        try {
          const result = await this.testModel(modelId);
          const item = { modelId, status: result.status, durationMs: Number(result.duration_ms ?? 0), errorCode: result.error_code ?? null };
          results.push(item); onResult?.(item);
        } catch (cause) {
          const item = { modelId, status: "error" as const, durationMs: 0, errorCode: cause instanceof Error ? cause.message : "test_failed" };
          results.push(item); onResult?.(item);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, () => worker()));
    return results;
  },

  async getUsers() {
    await requireAdmin();
    const [profiles, accounts] = await Promise.all([
      supabase.from("suly_profiles").select("id,email,full_name,subscription_tier,is_banned,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("suly_credit_accounts").select("user_id,balance,reserved_balance").limit(500),
    ]);
    if (profiles.error) throw profiles.error;
    if (accounts.error) throw accounts.error;
    const accountByUser = new Map<string, { balance: number; reserved_balance: number }>();
    for (const row of accounts.data ?? []) accountByUser.set(String(row.user_id), { balance: Number(row.balance ?? 0), reserved_balance: Number(row.reserved_balance ?? 0) });
    return (profiles.data ?? []).map((profile) => ({
      ...profile,
      balance: accountByUser.get(String(profile.id))?.balance ?? 0,
      reserved_balance: accountByUser.get(String(profile.id))?.reserved_balance ?? 0,
    }));
  },

  async setUserBanned(userId: string, banned: boolean) {
    await requireAdmin();
    const { error } = await supabase.rpc("suly_admin_set_user_banned", { p_user_id: userId, p_banned: banned });
    if (error) throw error;
  },

  async getUserTransactions(userId: string) {
    await requireAdmin();
    const { data, error } = await supabase.from("suly_credit_transactions")
      .select("event_type,amount,balance_delta,balance_after,actual_cost,input_tokens,output_tokens,model_id,source,reason,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  },

  async adjustCredits(userId: string, amount: number, reason: string) {
    await requireAdmin();
    if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000_000 || !reason.trim() || reason.length > 500) {
      throw new Error("أدخل مبلغًا صحيحًا غير صفري وسببًا من 1 إلى 500 حرف.");
    }
    const { data, error } = await supabase.rpc("suly_admin_adjust_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason.trim(),
      p_request_id: randomUUID(),
    });
    if (error) throw error;
    return data as { success?: boolean; balance?: number; error?: string };
  },

  async getCreditOverview() {
    await requireAdmin();
    const [pricing, transactions] = await Promise.all([
      supabase.from("suly_credit_pricing").select("id,enabled,minimum_request_credits,input_credits_per_1k_tokens,output_credits_per_1k_tokens,updated_at").eq("id", 1).maybeSingle(),
      supabase.from("suly_credit_transactions").select("id,user_id,event_type,amount,balance_delta,balance_after,actual_cost,input_tokens,output_tokens,model_id,source,reason,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    if (pricing.error) throw pricing.error;
    if (transactions.error) throw transactions.error;
    return { pricing: pricing.data, transactions: transactions.data ?? [] };
  },

  async updateCreditPricing(input: { enabled: boolean; minimum: number; inputRate: number; outputRate: number }) {
    await requireAdmin();
    for (const value of [input.minimum, input.inputRate, input.outputRate]) {
      if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new Error("قيم التسعير يجب أن تكون أعدادًا صحيحة بين صفر ومليار.");
    }
    const { data, error } = await supabase.rpc("suly_admin_update_credit_pricing", {
      p_enabled: input.enabled,
      p_minimum_request_credits: input.minimum,
      p_input_credits_per_1k_tokens: input.inputRate,
      p_output_credits_per_1k_tokens: input.outputRate,
    });
    if (error) throw error;
    return data as { success?: boolean };
  },
  async getPricingPlans(): Promise<PricingPlan[]> {
    await requireAdmin();
    const { data, error } = await supabase.from("subscription_plans")
      .select("id,name,price,max_requests,daily_credits,is_active,updated_at")
      .order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((plan) => ({
      ...plan,
      price: Number(plan.price ?? 0),
      max_requests: Number(plan.max_requests ?? 0),
      daily_credits: Number(plan.daily_credits ?? 0),
      enabled: plan.is_active !== false,
    })) as PricingPlan[];
  },
  async getPricingFeatures(): Promise<PricingFeature[]> {
    await requireAdmin();
    const { data, error } = await supabase.from("subscription_plan_features")
      .select("id,plan_id,title,value,sort_order,is_active")
      .order("plan_id", { ascending: true }).order("sort_order", { ascending: true }).limit(500);
    if (error) throw error;
    return (data ?? []) as PricingFeature[];
  },
  async createPricingFeature(input: { planId: number; title: string; value: string; sortOrder?: number }) {
    await requireAdmin();
    const title = input.title.trim().slice(0, 300);
    const value = input.value.trim().slice(0, 2000);
    if (!title || !value) throw new Error("اكتب عنوان المزية وقيمتها.");
    const { error } = await supabase.from("subscription_plan_features").insert({ plan_id: input.planId, title, value, sort_order: input.sortOrder ?? 0, is_active: true });
    if (error) throw error;
  },
  async updatePricingFeature(id: number, input: { title: string; value: string }) {
    await requireAdmin();
    const title = input.title.trim().slice(0, 300);
    const value = input.value.trim().slice(0, 2000);
    if (!title || !value) throw new Error("اكتب عنوان المزية وقيمتها.");
    const { error } = await supabase.from("subscription_plan_features").update({ title, value, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  },
  async deletePricingFeature(id: number) {
    await requireAdmin();
    const { error } = await supabase.from("subscription_plan_features").delete().eq("id", id);
    if (error) throw error;
  },
  async updatePricingPlan(planId: number, data: { price: number; max_requests: number; daily_credits: number }) {
    await requireAdmin();
    if (![1, 2, 3, 4, 5].includes(planId)) throw new Error("الباقة غير معروفة.");
    if (!Number.isFinite(data.price) || data.price < 0 || data.price > 1_000_000 || !Number.isInteger(data.max_requests) || data.max_requests < 0 || data.max_requests > 1_000_000_000 || !Number.isInteger(data.daily_credits) || data.daily_credits < 0 || data.daily_credits > 1_000_000_000) {
      throw new Error("أدخل سعرًا وحدودًا صحيحة غير سالبة.");
    }
    const { error } = await supabase.from("subscription_plans").update({
      price: Number(data.price.toFixed(2)),
      max_requests: data.max_requests,
      daily_credits: data.daily_credits,
      updated_at: new Date().toISOString(),
    }).eq("id", planId);
    if (error) throw error;
  },
  async getAdMobSettings(): Promise<{ appId: string; rewardedUnitId: string; bannerUnitId: string }> {
    await requireAdmin();
    const { data, error } = await supabase.from("system_settings").select("key,value").in("key", ["admob_app_id", "admob_rewarded_unit_id", "admob_banner_unit_id"]);
    if (error) throw error;
    const values = new Map((data ?? []).map((row) => [String(row.key), String(row.value ?? "").trim()]));
    return {
      appId: values.get("admob_app_id") || "",
      rewardedUnitId: values.get("admob_rewarded_unit_id") || "",
      bannerUnitId: values.get("admob_banner_unit_id") || "",
    };
  },
  async updateAdMobSettings(settings: { appId: string; rewardedUnitId: string; bannerUnitId: string }) {
    await requireAdmin();
    const toUpdate = [
      { key: "admob_app_id", value: settings.appId.trim() },
      { key: "admob_rewarded_unit_id", value: settings.rewardedUnitId.trim() },
      { key: "admob_banner_unit_id", value: settings.bannerUnitId.trim() },
    ];
    const { error } = await supabase.from("system_settings").upsert(toUpdate, { onConflict: "key" });
    if (error) throw error;
  },
  async getAgents(): Promise<AgentConfig[]> {
    await requireAdmin();
    const { data, error } = await supabase.from("agent_registry")
      .select("id,name,role,system_prompt,model_fallback_chain,is_active,created_at,updated_at")
      .order("updated_at", { ascending: false }).limit(200);
    if (error) throw error;
    return (data ?? []).map((row) => ({ ...row, role: ["planner", "thinker", "worker", "reviewer", "coordinator"].includes(row.role) ? row.role : "worker", model_fallback_chain: Array.isArray(row.model_fallback_chain) ? row.model_fallback_chain.map(String) : [] })) as AgentConfig[];
  },
  async createAgent(input: { name: string; role: "planner" | "thinker" | "worker" | "reviewer" | "coordinator"; systemPrompt: string; modelFallbackChain: string[] }) {
    await requireAdmin();
    const name = input.name.trim().slice(0, 120);
    const systemPrompt = input.systemPrompt.trim().slice(0, 12000);
    if (name.length < 2 || systemPrompt.length < 10) throw new Error("اكتب اسم المساعد وتعليماته بشكل صحيح.");
    const { error } = await supabase.from("agent_registry").insert({ name, role: input.role, system_prompt: systemPrompt, model_fallback_chain: input.modelFallbackChain, is_active: true });
    if (error) throw error;
  },
  async updateAgent(id: string, input: { name: string; systemPrompt: string; modelFallbackChain: string[]; isActive: boolean }) {
    await requireAdmin();
    const { error } = await supabase.from("agent_registry").update({ name: input.name.trim().slice(0, 120), system_prompt: input.systemPrompt.trim().slice(0, 12000), model_fallback_chain: input.modelFallbackChain, is_active: input.isActive, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  },
  async deleteAgent(id: string) {
    await requireAdmin();
    const { error } = await supabase.from("agent_registry").delete().eq("id", id);
    if (error) throw error;
  },
};
