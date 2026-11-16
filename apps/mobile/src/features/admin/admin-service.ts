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
export interface ComposioStatus { configured: boolean; updated_at: string | null; }
export interface TavilyStatus { configured: boolean; updated_at: string | null; }
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
  role: "planner" | "thinker" | "worker" | "reviewer" | "summarizer" | "coordinator";
  system_prompt: string;
  model_fallback_chain: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentTaskQueueOverview {
  queued_count: number;
  running_count: number;
  completed_count: number;
  failed_count: number;
  cancelled_count: number;
  expired_lease_count: number;
  oldest_queued_at: string | null;
  generated_at: string | null;
  recent_jobs: Array<{
    id: string;
    user_id: string;
    job_type: string;
    status: "queued" | "running" | "completed" | "failed" | "cancelled";
    priority: number;
    attempt_count: number;
    max_attempts: number;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
    error_code: string | null;
  }>;
}

export interface HimsActivationCode {
  id: string;
  feature_key: string;
  label: string | null;
  /** Always null: activation codes are returned once at creation and never stored in plaintext. */
  code_plain: null;
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
  async getComposioStatus(): Promise<ComposioStatus> {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_composio_status");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { configured: row?.configured === true, updated_at: row?.updated_at ?? null };
  },
  async saveComposioApiKey(apiKey: string): Promise<void> {
    await requireAdmin();
    const value = apiKey.trim();
    if (!value || value.length > 16384) throw new Error("مفتاح Composio غير صالح.");
    const { error } = await supabase.rpc("suly_admin_set_composio_api_key", { p_api_key: value });
    if (error) throw error;
  },
  async getTavilyStatus(): Promise<TavilyStatus> {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_tavily_status");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { configured: row?.configured === true, updated_at: row?.updated_at ?? null };
  },
  async saveTavilyApiKey(apiKey: string): Promise<void> {
    await requireAdmin();
    const value = apiKey.trim();
    if (!/^tvly\S+$/i.test(value) || value.length > 16384) throw new Error("مفتاح Tavily غير صالح.");
    const { error } = await supabase.rpc("suly_admin_set_tavily_api_key", { p_api_key: value });
    if (error) throw error;
  },
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

  async saveImageGenerationModel(input: {
    modelId: string | null;
    providerId: number;
    displayName: string;
    modelIdentifier: string;
    endpointUrl: string;
    allowedTiers: string[];
    isActive: boolean;
    isDefault: boolean;
    prices: Array<{
      quality: string;
      price_credits: number;
      estimated_provider_cost_usd: number;
      target_margin: number;
      credit_value_egp: number;
      usd_to_egp: number;
      resolution: string;
      enabled: boolean;
    }>;
  }) {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_save_image_generation_model", {
      p_model_id: input.modelId,
      p_provider_id: input.providerId,
      p_display_name: input.displayName,
      p_model_identifier: input.modelIdentifier,
      p_endpoint_url: input.endpointUrl,
      p_allowed_tiers: input.allowedTiers,
      p_is_active: input.isActive,
      p_is_default: input.isDefault,
      p_prices: input.prices,
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || data.success !== true || typeof data.model_id !== "string") {
      throw new Error("لم تؤكد قاعدة البيانات حفظ نموذج الصور وأسعاره.");
    }
    return data as { success: true; model_id: string; service_type: "image"; is_active: boolean; is_default: boolean; supported_qualities: string[] };
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
        .select("id,name,provider_id,model_identifier,enabled,priority,context_window,routing_group,allowed_tiers,capabilities_json,task_roles,response_timeout_ms,restriction_failure_threshold,restriction_window_minutes")
        .order("priority", { ascending: false }).order("name").limit(500),
      supabase.from("ai_model_health")
        .select("model_id,total_attempts,successful_attempts,failed_attempts,consecutive_failures,last_attempt_at,last_success_at,last_failure_at,last_status,last_error_code,last_error_reason,average_latency_ms,auto_restricted,restriction_reason,restricted_at")
        .limit(1000),
      supabase.from("ai_model_probe_state")
        .select("model_id,consecutive_scheduled_failures,consecutive_scheduled_successes,last_scheduled_status,last_scheduled_at,last_error_code")
        .limit(1000),
      supabase.from("ai_router_settings")
        .select("id,free_race_timeout_ms,paid_fallback_enabled,paid_fallback_timeout_ms,max_parallel_free_models,health_auto_restrict_enabled,gmail_task_model_id,agent_planner_model_id,agent_summarizer_model_id")
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

  async getModelPriceVersions() {
    await requireAdmin();
    const { data: prices, error: priceError } = await supabase
      .from("ai_model_price_versions")
      .select("id,model_id,price_version,provider_input_cost_egp_per_million,provider_output_cost_egp_per_million,selling_input_egp_per_million,selling_output_egp_per_million,markup_rate,currency,is_current,effective_at,created_at")
      .eq("is_current", true)
      .order("model_id");
    if (priceError) throw priceError;
    const modelIds = [...new Set((prices ?? []).map((row) => Number(row.model_id)))];
    if (modelIds.length === 0) return [];
    const { data: models, error: modelError } = await supabase
      .from("ai_models")
      .select("id,name,model_identifier,provider_id")
      .in("id", modelIds);
    if (modelError) throw modelError;
    const modelById = new Map((models ?? []).map((row) => [Number(row.id), row]));
    return (prices ?? []).map((price) => ({ ...price, model: modelById.get(Number(price.model_id)) ?? null }));
  },

  async updateModelPrice(modelId: number, inputCost: number, outputCost: number, expectedVersion: number) {
    await requireAdmin();
    if (!Number.isSafeInteger(modelId) || modelId < 1
      || !Number.isFinite(inputCost) || inputCost < 0
      || !Number.isFinite(outputCost) || outputCost < 0
      || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      throw new Error("قيم تسعير النموذج غير صالحة.");
    }
    const { data, error } = await supabase.rpc("suly_admin_set_ai_model_price", {
      p_model_id: modelId,
      p_provider_input_cost_egp_per_million: inputCost,
      p_provider_output_cost_egp_per_million: outputCost,
      p_expected_version: expectedVersion,
    });
    if (error) throw error;
    if (!data || data.success !== true) throw new Error("تعذر إنشاء إصدار سعر جديد.");
    return data;
  },

  async getMediaModelPriceVersions() {
    await requireAdmin();
    const { data, error } = await supabase
      .from("suly_media_model_price_versions")
      .select("id,provider_id,service_type,model_identifier,display_name,unit_type,provider_cost_egp_per_unit,selling_price_egp_per_unit,markup_rate,price_version,provider_tested,suly_integration_verified,is_current")
      .eq("is_current", true)
      .order("service_type")
      .order("display_name");
    if (error) throw error;
    return data ?? [];
  },

  async updateMediaModelPrice(input: {
    providerId: number;
    serviceType: "image" | "video" | "audio";
    modelIdentifier: string;
    displayName: string;
    unitType: "image" | "video_second" | "audio_minute";
    providerCost: number;
    expectedVersion: number;
  }) {
    await requireAdmin();
    if (!Number.isSafeInteger(input.providerId) || input.providerId < 1
      || !input.modelIdentifier.trim() || !input.displayName.trim()
      || !Number.isFinite(input.providerCost) || input.providerCost < 0
      || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new Error("قيم تسعير الخدمة غير صالحة.");
    }
    const { data, error } = await supabase.rpc("suly_admin_set_media_model_price", {
      p_provider_id: input.providerId,
      p_service_type: input.serviceType,
      p_model_identifier: input.modelIdentifier,
      p_display_name: input.displayName,
      p_unit_type: input.unitType,
      p_provider_cost_egp_per_unit: input.providerCost,
      p_expected_version: input.expectedVersion,
    });
    if (error) throw error;
    if (!data || data.success !== true) throw new Error("تعذر إنشاء إصدار سعر جديد.");
    return data;
  },

  async updateModel(modelId: number, changes: Record<string, unknown>) {
    await requireAdmin();
    const allowed = ["enabled", "priority", "routing_group", "allowed_tiers", "response_timeout_ms", "restriction_failure_threshold", "restriction_window_minutes", "capabilities_json", "task_roles"];
    if (Object.keys(changes).some((key) => !allowed.includes(key))) throw new Error("حقل تعديل غير مسموح.");
    if ("task_roles" in changes) {
      const roles = changes.task_roles;
      const supportedRoles = ["general", "chat", "planner", "worker", "executor", "reviewer", "summarizer"];
      if (!Array.isArray(roles) || roles.length === 0 || roles.some((role) => typeof role !== "string" || !supportedRoles.includes(role))) {
        throw new Error("يجب تحديد دور واحد صالح على الأقل للنموذج.");
      }
      changes.task_roles = [...new Set(roles as string[])];
    }
    if ("capabilities_json" in changes) {
      let parsed: unknown = changes.capabilities_json;
      if (typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch { throw new Error("صيغة قدرات النموذج غير صالحة."); }
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("صيغة قدرات النموذج غير صالحة.");
      const value = parsed as Record<string, unknown>;
      const supported = ["chat", "vision", "pdf", "word", "video", "gmail", "google_drive", "github"];
      if (Object.keys(value).some((key) => !supported.includes(key)) || supported.some((key) => key in value && typeof value[key] !== "boolean")) throw new Error("قدرات النموذج يجب أن تكون مفاتيح معروفة وقيمًا منطقية.");
      changes.capabilities_json = JSON.stringify({ chat: value.chat !== false, vision: value.vision === true, pdf: value.pdf === true, word: value.word === true, video: value.video === true, gmail: value.gmail === true, google_drive: value.google_drive === true, github: value.github === true });
    }
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

  async updateGmailTaskModel(modelId: number | null) {
    await requireAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("ai_router_settings").update({
      gmail_task_model_id: modelId,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) throw error;
  },

  async updateAgentModels(plannerModelId: number | null, summarizerModelId: number | null) {
    await requireAdmin();
    const { error } = await supabase.rpc("suly_set_model_settings", {
      p_planner_model_id: plannerModelId,
      p_summarizer_model_id: summarizerModelId,
    });
    if (error) throw error;
  },

  async getRouteModelAssignments(): Promise<Array<{ route_role: string; model_id: number; priority: number; enabled: boolean }>> {
    await requireAdmin();
    const { data, error } = await supabase
      .from("ai_route_model_assignments")
      .select("route_role,model_id,priority,enabled")
      .order("route_role")
      .order("priority")
      .limit(2500);
    if (error) throw error;
    return (data ?? []) as Array<{ route_role: string; model_id: number; priority: number; enabled: boolean }>;
  },

  async saveRouteModelAssignments(routeRole: "chat" | "planner" | "worker" | "reviewer" | "summarizer", modelIds: number[]) {
    await requireAdmin();
    const ids = [...new Set(modelIds)].filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 2);
    const { data, error } = await supabase.rpc("suly_admin_save_route_models", {
      p_route_role: routeRole,
      p_model_ids: ids,
    });
    if (error) throw error;
    if (data?.success !== true) throw new Error("تعذر حفظ اختيارات النماذج لهذا القسم.");
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
      supabase.from("suly_credit_pricing").select("id,enabled,minimum_request_credits,input_credits_per_1k_tokens,output_credits_per_1k_tokens,negative_balance_limit,credit_value_egp,usd_to_egp,updated_at").eq("id", 1).maybeSingle(),
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
  async updateCreditControls(input: {
    enabled: boolean; minimum: number; inputRate: number; outputRate: number; negativeBalanceLimit: number;
    creditValueEgp: number | null; usdToEgp: number | null;
  }) {
    await requireAdmin();
    const values = [input.minimum, input.inputRate, input.outputRate, input.negativeBalanceLimit];
    if (values.some((value) => !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000)) {
      throw new Error("قيم الرصيد وحد الرصيد السالب يجب أن تكون أعدادًا صحيحة بين صفر ومليار.");
    }
    for (const value of [input.creditValueEgp, input.usdToEgp]) {
      if (value !== null && (!Number.isFinite(value) || value <= 0 || value > 1_000_000)) {
        throw new Error("قيمة الـ Credit وسعر الصرف يجب أن يكونا أكبر من صفر أو يتركا فارغين.");
      }
    }
    const { data, error } = await supabase.rpc("suly_admin_update_credit_finance_controls", {
      p_enabled: input.enabled,
      p_minimum_request_credits: input.minimum,
      p_input_credits_per_1k_tokens: input.inputRate,
      p_output_credits_per_1k_tokens: input.outputRate,
      p_negative_balance_limit: input.negativeBalanceLimit,
      p_credit_value_egp: input.creditValueEgp,
      p_usd_to_egp: input.usdToEgp,
    });
    if (error) throw error;
    return data as { success?: boolean; negative_balance_limit?: number; credit_value_egp?: number | null; usd_to_egp?: number | null };
  },
  async updateNegativeBalanceLimit(limit: number) {
    await requireAdmin();
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 1_000_000_000) {
      throw new Error("حد الرصيد السالب يجب أن يكون عددًا صحيحًا بين صفر ومليار.");
    }
    const { data, error } = await supabase.rpc("suly_admin_update_negative_balance_limit", { p_limit: limit });
    if (error) throw error;
    return data as { success?: boolean; negative_balance_limit?: number };
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
  async getStorageBuckets(): Promise<Array<{
    id: string; name: string; public: boolean; file_size_limit: number | null;
    allowed_mime_types: string[] | null; created_at: string | null; updated_at: string | null;
  }>> {
    await requireAdmin();
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    return (data ?? []).map((bucket) => ({
      id: bucket.id,
      name: bucket.name,
      public: bucket.public,
      file_size_limit: bucket.file_size_limit ?? null,
      allowed_mime_types: bucket.allowed_mime_types ?? null,
      created_at: bucket.created_at ?? null,
      updated_at: bucket.updated_at ?? null,
    }));
  },
  async listStorageObjects(bucketId: string, path = ""): Promise<Array<{
    name: string; id: string | null; updated_at: string | null; created_at: string | null;
    metadata: { size?: number; mimetype?: string; eTag?: string; cacheControl?: string } | null;
  }>> {
    await requireAdmin();
    const safeBucketId = bucketId.trim();
    if (!safeBucketId || safeBucketId.length > 100) throw new Error("معرّف مساحة التخزين غير صالح.");
    const safePath = path.split("/").filter(Boolean).join("/");
    if (safePath.length > 1024) throw new Error("مسار التخزين طويل جدًا.");
    const { data, error } = await supabase.storage.from(safeBucketId).list(safePath, {
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    return (data ?? []).map((item) => ({
      name: item.name,
      id: item.id ?? null,
      updated_at: item.updated_at ?? null,
      created_at: item.created_at ?? null,
      metadata: item.metadata ? {
        size: typeof item.metadata.size === "number" ? item.metadata.size : undefined,
        mimetype: typeof item.metadata.mimetype === "string" ? item.metadata.mimetype : undefined,
        eTag: typeof item.metadata.eTag === "string" ? item.metadata.eTag : undefined,
        cacheControl: typeof item.metadata.cacheControl === "string" ? item.metadata.cacheControl : undefined,
      } : null,
    }));
  },

  async getAgentTaskOverview(): Promise<AgentTaskQueueOverview> {
    await requireAdmin();
    const { data, error } = await supabase.rpc("suly_admin_agent_task_overview");
    if (error) throw new Error("تعذر تحميل مراقبة مهام الوكيل. تحقق من نشر ترحيل لوحة الإدارة.");
    const row = (Array.isArray(data) ? data[0] : data) ?? {};
    const count = (key: string) => Math.max(0, Number(row[key] ?? 0));
    const recentJobs = Array.isArray(row.recent_jobs) ? row.recent_jobs : [];
    return {
      queued_count: count("queued_count"),
      running_count: count("running_count"),
      completed_count: count("completed_count"),
      failed_count: count("failed_count"),
      cancelled_count: count("cancelled_count"),
      expired_lease_count: count("expired_lease_count"),
      oldest_queued_at: typeof row.oldest_queued_at === "string" ? row.oldest_queued_at : null,
      generated_at: typeof row.generated_at === "string" ? row.generated_at : null,
      recent_jobs: recentJobs.filter((job: any) => job && typeof job.id === "string").slice(0, 20),
    };
  },

  async getAgents(): Promise<AgentConfig[]> {
    await requireAdmin();
    const { data, error } = await supabase.from("agent_registry")
      .select("id,name,role,system_prompt,model_fallback_chain,is_active,created_at,updated_at")
      .order("updated_at", { ascending: false }).limit(200);
    if (error) throw error;
    return (data ?? []).map((row) => ({ ...row, role: ["planner", "thinker", "worker", "reviewer", "summarizer", "coordinator"].includes(row.role) ? row.role : "worker", model_fallback_chain: Array.isArray(row.model_fallback_chain) ? row.model_fallback_chain.map(String) : [] })) as AgentConfig[];
  },
  async createAgent(input: { name: string; role: "planner" | "thinker" | "worker" | "reviewer" | "summarizer" | "coordinator"; systemPrompt: string; modelFallbackChain: string[] }) {
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
