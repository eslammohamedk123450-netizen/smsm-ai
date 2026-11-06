import { randomUUID } from "expo-crypto";
import { supabase } from "../../lib/supabase/client";

export interface ProviderInput {
  name: string;
  provider_type: string;
  base_url: string;
  description: string;
  api_key: string;
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
  async getProviders() {
    await requireAdmin();
    const { data, error } = await supabase.from("ai_providers_catalog")
      .select("id,name,provider_type,base_url,enabled,priority,last_test_status,last_tested_at")
      .order("priority", { ascending: true }).limit(100);
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

  async getModelsOverview() {
    await requireAdmin();
    const [modelsResult, healthResult, settingsResult, providers] = await Promise.all([
      supabase.from("ai_models")
        .select("id,name,provider_id,model_identifier,enabled,priority,context_window,routing_group,allowed_tiers,capabilities_json,response_timeout_ms,restriction_failure_threshold,restriction_window_minutes")
        .order("priority", { ascending: false }).order("name").limit(500),
      supabase.from("ai_model_health")
        .select("model_id,total_attempts,successful_attempts,failed_attempts,consecutive_failures,last_attempt_at,last_success_at,last_failure_at,last_status,last_error_code,last_error_reason,average_latency_ms,auto_restricted,restriction_reason,restricted_at")
        .limit(1000),
      supabase.from("ai_router_settings")
        .select("id,free_race_timeout_ms,paid_fallback_enabled,paid_fallback_timeout_ms,max_parallel_free_models,health_auto_restrict_enabled")
        .eq("id", 1).maybeSingle(),
      this.getProviders(),
    ]);
    if (modelsResult.error) throw modelsResult.error;
    if (healthResult.error) throw healthResult.error;
    if (settingsResult.error) throw settingsResult.error;
    const providerNames = new Map<number, string>(providers.map((item) => [Number(item.id), String(item.name ?? item.provider_type)]));
    const health = new Map<number, Record<string, unknown>>((healthResult.data ?? []).map((row) => [Number(row.model_id), row]));
    return {
      models: (modelsResult.data ?? []).map((row) => ({ ...row, provider_name: providerNames.get(Number(row.provider_id)) ?? "—", health: health.get(Number(row.id)) ?? null })),
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
};
