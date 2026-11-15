import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { adminService } from "./admin-service";
import { colors } from "../../theme/colors";

type Profile = {
  profile_key: "lite" | "pro" | "max";
  display_name: string;
  tagline: string;
  description: string;
  icon_key: string;
  sort_order: number;
  minimum_subscription_tier: string;
  capabilities_json: Record<string, boolean>;
  is_active: boolean;
};
type Model = { id: number; name: string; model_identifier: string; provider_id: number; enabled: boolean; routing_group: string; task_roles: string[] | null; allowed_tiers: string[] | null; capabilities_json: Record<string, boolean> | string | null; context_window: number | null };
type Mapping = { profile_key: string; model_id: number; route_role: string; enabled: boolean };

function rolesForModel(model: Model): string[] {
  const roles = model.task_roles?.length ? model.task_roles : ["general"];
  let capabilities: Record<string, unknown> = {};
  if (typeof model.capabilities_json === "string") {
    try { const parsed: unknown = JSON.parse(model.capabilities_json); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) capabilities = parsed as Record<string, unknown>; }
    catch { capabilities = { chat: false }; }
  } else if (model.capabilities_json && typeof model.capabilities_json === "object") {
    capabilities = model.capabilities_json;
  }
  const general = roles.includes("general");
  return [
    ...((general || roles.includes("chat")) && capabilities.chat !== false && !/(embed|embedding|whisper|tts|speech|audio|image|imagen|dall-e|flux|stable-diffusion|kling|seedance|seedream|ideogram|nano-banana|minimax|lyria|transcrib|robotics|deep-research|computer-use|guard|moderation|rerank)/i.test(model.model_identifier) ? ["chat"] : []),
    ...(general || roles.includes("planner") ? ["planner"] : []),
    ...(general || roles.includes("worker") || roles.includes("executor") ? ["worker"] : []),
    ...(general || roles.includes("reviewer") ? ["reviewer"] : []),
    ...(general || roles.includes("summarizer") ? ["summarizer"] : []),
  ];
}

export function SulyModelProfilesAdminCard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [profileResult, modelResult, mappingResult, providerRows] = await Promise.all([
      supabase.from("suly_model_profiles").select("profile_key,display_name,tagline,description,icon_key,sort_order,minimum_subscription_tier,capabilities_json,is_active").order("sort_order"),
      supabase.from("ai_models").select("id,name,model_identifier,provider_id,enabled,routing_group,task_roles,allowed_tiers,capabilities_json,context_window").eq("enabled", true).order("priority", { ascending: false }).limit(500),
      supabase.from("suly_model_profile_models").select("profile_key,model_id,route_role,enabled").limit(2000),
      adminService.getProviders(),
    ]);
    if (profileResult.error || modelResult.error || mappingResult.error) {
      setError("تعذر تحميل إعدادات مستويات SULY. تأكد من تطبيق ترحيل المستويات وصلاحيات الأدمن.");
    } else {
      const enabledProviderIds = new Set((providerRows as Array<{ id: number; enabled: boolean }>).filter((provider) => provider.enabled === true).map((provider) => Number(provider.id)));
      setProfiles((profileResult.data ?? []) as Profile[]);
      setModels(((modelResult.data ?? []) as Model[]).filter((model) => enabledProviderIds.has(Number(model.provider_id)) && model.routing_group !== "disabled"));
      setMappings((mappingResult.data ?? []) as Mapping[]);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visibleModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return models.filter((model) => !query || `${model.name} ${model.model_identifier} ${model.provider_id}`.toLowerCase().includes(query));
  }, [models, search]);

  const updateProfile = (key: Profile["profile_key"], patch: Partial<Profile>) => {
    setProfiles((current) => current.map((profile) => profile.profile_key === key ? { ...profile, ...patch } : profile));
  };

  const saveProfile = async (profile: Profile) => {
    setBusyKey(`profile:${profile.profile_key}`); setError(null); setNotice(null);
    const { error: writeError } = await supabase.from("suly_model_profiles").update({
      display_name: profile.display_name.trim(),
      tagline: profile.tagline.trim(),
      description: profile.description.trim(),
      icon_key: profile.icon_key.trim() || "sparkles",
      sort_order: Math.max(0, Math.floor(profile.sort_order)),
      is_active: profile.is_active,
      capabilities_json: profile.capabilities_json,
      updated_at: new Date().toISOString(),
    }).eq("profile_key", profile.profile_key);
    if (writeError) setError("تعذر حفظ بيانات مستوى SULY.");
    else setNotice(`تم حفظ ${profile.display_name}.`);
    setBusyKey(null);
  };

  const toggleMapping = async (profile: Profile, model: Model, enabled: boolean) => {
    const key = `${profile.profile_key}:${model.id}`;
    setBusyKey(key); setError(null); setNotice(null);
    const existingRoles = mappings.filter((item) => item.profile_key === profile.profile_key && item.model_id === model.id);
    let writeError: { message: string } | null = null;
    if (enabled) {
      const rows = rolesForModel(model).map((route_role, index) => ({
        profile_key: profile.profile_key, model_id: model.id, route_role, priority: (index + 1) * 100, enabled: true,
      }));
      const result = await supabase.from("suly_model_profile_models").upsert(rows, { onConflict: "profile_key,model_id,route_role" });
      writeError = result.error;
    } else if (existingRoles.length) {
      const result = await supabase.from("suly_model_profile_models").delete().eq("profile_key", profile.profile_key).eq("model_id", model.id);
      writeError = result.error;
    }
    if (writeError) setError("تعذر تحديث ربط النموذج بالمستوى.");
    else {
      setMappings((current) => enabled
        ? [...current.filter((item) => !(item.profile_key === profile.profile_key && item.model_id === model.id)), ...rolesForModel(model).map((route_role) => ({ profile_key: profile.profile_key, model_id: model.id, route_role, enabled: true }))]
        : current.filter((item) => !(item.profile_key === profile.profile_key && item.model_id === model.id)));
      setNotice(enabled ? "تم ربط النموذج بالمستوى." : "تم إلغاء ربط النموذج بالمستوى.");
    }
    setBusyKey(null);
  };

  return <View style={{ backgroundColor: colors.surface, borderColor: colors.divider, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 }}>
    <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ gap: 3, flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "900", textAlign: "right" }}>مستويات ونماذج SULY</Text>
        <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: "right" }}>تحكم في الاسم والوصف والنماذج الداخلية المرتبطة بكل مستوى.</Text>
      </View>
      <Pressable onPress={() => void load()}><Text style={{ color: colors.primary, fontWeight: "800" }}>تحديث</Text></Pressable>
    </View>
    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    {error ? <Text style={{ color: colors.error, textAlign: "right" }}>{error}</Text> : null}
    {notice ? <Text style={{ color: colors.success, textAlign: "right" }}>{notice}</Text> : null}
    <TextInput value={search} onChangeText={setSearch} placeholder="بحث في النماذج الداخلية" placeholderTextColor={colors.textMuted} style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 9, padding: 10, textAlign: "right" }} />
    {profiles.map((profile) => {
      const profileModels = new Set(mappings.filter((item) => item.profile_key === profile.profile_key && item.enabled).map((item) => item.model_id));
      return <View key={profile.profile_key} style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, gap: 8 }}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.primary, fontWeight: "900" }}>{profile.profile_key.toUpperCase()}</Text>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>مفعّل</Text>
            <Switch value={profile.is_active} onValueChange={(value) => updateProfile(profile.profile_key, { is_active: value })} />
          </View>
        </View>
        <TextInput value={profile.display_name} onChangeText={(value) => updateProfile(profile.profile_key, { display_name: value })} placeholder="اسم المستوى" placeholderTextColor={colors.textMuted} style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 9, padding: 10, textAlign: "right" }} />
        <TextInput value={profile.tagline} onChangeText={(value) => updateProfile(profile.profile_key, { tagline: value })} placeholder="وصف قصير" placeholderTextColor={colors.textMuted} style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 9, padding: 10, textAlign: "right" }} />
        <TextInput value={profile.description} onChangeText={(value) => updateProfile(profile.profile_key, { description: value })} placeholder="شرح القدرات" placeholderTextColor={colors.textMuted} multiline style={{ minHeight: 64, color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 9, padding: 10, textAlign: "right", textAlignVertical: "top" }} />
        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: "right" }}>مفتاح الأيقونة</Text>
            <TextInput value={profile.icon_key} onChangeText={(value) => updateProfile(profile.profile_key, { icon_key: value })} placeholder="zap / rocket / diamond" placeholderTextColor={colors.textMuted} style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 9, padding: 9, textAlign: "right" }} />
          </View>
          <View style={{ width: 95 }}>
            <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: "right" }}>ترتيب العرض</Text>
            <TextInput value={String(profile.sort_order)} onChangeText={(value) => updateProfile(profile.profile_key, { sort_order: Number.parseInt(value, 10) || 0 })} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.textMuted} style={{ color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, borderWidth: 1, borderRadius: 9, padding: 9, textAlign: "right" }} />
          </View>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: "right", fontWeight: "700" }}>القدرات المتاحة لهذا المستوى</Text>
        {[
          ["web_search", "البحث على الويب"],
          ["multi_step_agent", "تنفيذ المهام متعددة الخطوات"],
          ["advanced_reasoning", "التحليل والاستدلال المتقدم"],
          ["extended_context", "سياق أطول"],
        ].map(([key, label]) => <View key={key} style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{label}</Text>
          <Switch value={profile.capabilities_json?.[key] === true} onValueChange={(value) => updateProfile(profile.profile_key, { capabilities_json: { ...(profile.capabilities_json ?? {}), [key]: value } })} />
        </View>)}
        <Pressable disabled={busyKey === `profile:${profile.profile_key}`} onPress={() => void saveProfile(profile)} style={{ alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8, opacity: busyKey === `profile:${profile.profile_key}` ? 0.5 : 1 }}>
          <Text style={{ color: colors.background, fontWeight: "800" }}>{busyKey === `profile:${profile.profile_key}` ? "جارٍ الحفظ…" : "حفظ بيانات المستوى"}</Text>
        </Pressable>
        <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: "right" }}>النماذج المرتبطة ({profileModels.size})</Text>
        {visibleModels.map((model) => {
          const linked = profileModels.has(model.id);
          const busy = busyKey === `${profile.profile_key}:${model.id}`;
          return <View key={model.id} style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 11, textAlign: "right" }}>{model.name || model.model_identifier}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 9, textAlign: "right" }}>{model.model_identifier} · Provider #{model.provider_id} · {Number(model.context_window ?? 0).toLocaleString("en-US")} context</Text>
            </View>
            <Switch value={linked} disabled={busy} onValueChange={(value) => void toggleMapping(profile, model, value)} />
          </View>;
        })}
      </View>;
    })}
    <Text style={{ color: colors.textMuted, fontSize: 9, textAlign: "right" }}>يُعاد استخدام سجل ai_models ومزودي ai_providers الحاليين؛ لا يتم إنشاء كتالوج مزودين مكرر.</Text>
  </View>;
}
