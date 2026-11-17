import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type ServiceType = "chat" | "image" | "video" | "audio";
type OperationalState = "active" | "disabled" | "restricted" | "candidate" | "archived" | "unknown";
type RegistryModel = {
  model_id: string;
  provider_id: number;
  provider_name: string | null;
  service_type: ServiceType;
  model_identifier: string;
  display_name: string;
  lifecycle_state: "active" | "candidate" | "archived";
  legacy_chat_model_id: number | null;
  legacy_media_model_id: string | null;
  capability_key: string | null;
  operational_state: OperationalState;
};
type CapabilityKey = string;
type StatusFilter = "all" | "active" | "restricted" | "disabled" | "candidate";

const CAPABILITIES: Array<[CapabilityKey, string, keyof typeof Ionicons.glyphMap]> = [
  ["text", "إدخال وإخراج النص", "text-outline"], ["chat", "المحادثة", "chatbubble-ellipses-outline"],
  ["vision", "فهم الصور", "eye-outline"], ["pdf_input", "إدخال PDF", "document-text-outline"],
  ["file_input", "إدخال الملفات", "folder-outline"], ["video_input", "إدخال الفيديو", "videocam-outline"],
  ["audio_input", "إدخال الصوت", "mic-outline"], ["audio_output", "إخراج الصوت", "volume-high-outline"],
  ["image_generation", "توليد الصور", "image-outline"], ["video_generation", "توليد الفيديو", "film-outline"],
  ["transcription", "تفريغ الصوت", "ear-outline"], ["function_calling", "استدعاء الدوال", "git-branch-outline"],
  ["structured_output", "مخرجات منظمة", "code-slash-outline"], ["streaming", "البث التدريجي", "radio-outline"],
  ["web_search", "بحث الويب", "search-outline"], ["file_search", "البحث بالملفات", "folder-outline"],
  ["computer_use", "استخدام الكمبيوتر", "desktop-outline"], ["code_interpreter", "تنفيذ الكود", "code-slash-outline"],
  ["mcp_tools", "أدوات MCP", "hardware-chip-outline"], ["gmail", "Gmail", "mail-outline"],
  ["google_drive", "Google Drive", "cloud-outline"], ["github", "GitHub", "logo-github"],
];
const STATUS_LABEL: Record<OperationalState, string> = {
  active: "متوفر", disabled: "معطّل", restricted: "مقيّد", candidate: "مرشح", archived: "مؤرشف", unknown: "غير معلوم",
};
const FILTER_LABEL: Record<StatusFilter, string> = {
  all: "الكل", active: "المتوفر", restricted: "المقيّد", disabled: "المعطّل", candidate: "المرشح",
};

function capabilityKeys(rows: RegistryModel[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.capability_key) continue;
    const keys = result.get(row.model_id) ?? new Set<string>();
    keys.add(row.capability_key);
    result.set(row.model_id, keys);
  }
  return result;
}

export function ModelRegistryCatalogScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<RegistryModel[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [capability, setCapability] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [registry, providers, chat, media, health] = await Promise.all([
        supabase.rpc("suly_admin_list_unified_model_capabilities"),
        supabase.from("ai_providers").select("id,name,enabled").limit(500),
        supabase.from("ai_models").select("id,enabled,routing_group").limit(1000),
        supabase.from("suly_media_generation_models").select("id,is_active").limit(1000),
        supabase.from("ai_model_health").select("model_id,auto_restricted").limit(1000),
      ]);
      if (registry.error) throw registry.error;
      if (providers.error) throw providers.error;
      const providerById = new Map<number, { name: string; enabled: boolean }>(
        (providers.data ?? []).map((item) => [Number(item.id), { name: String(item.name ?? "—"), enabled: item.enabled === true }])
      );
      const chatById = new Map<number, { enabled: boolean; routing_group: string }>(
        (chat.data ?? []).map((item) => [Number(item.id), { enabled: item.enabled === true, routing_group: String(item.routing_group ?? "") }])
      );
      const mediaById = new Map<string, boolean>((media.data ?? []).map((item) => [String(item.id), item.is_active === true]));
      const restricted = new Set<number>((health.data ?? []).filter((item) => item.auto_restricted === true).map((item) => Number(item.model_id)));
      const unique = new Map<string, RegistryModel>();
      for (const raw of (registry.data ?? []) as Array<Omit<RegistryModel, "operational_state">>) {
        const provider = providerById.get(Number(raw.provider_id));
        let operational_state: OperationalState = "unknown";
        if (raw.lifecycle_state === "archived") operational_state = "archived";
        else if (provider?.enabled === false) operational_state = "disabled";
        else if (raw.legacy_chat_model_id !== null) {
          const legacy = chatById.get(Number(raw.legacy_chat_model_id));
          if (legacy && !legacy.enabled || legacy?.routing_group === "disabled") operational_state = "disabled";
          else if (restricted.has(Number(raw.legacy_chat_model_id))) operational_state = "restricted";
          else if (legacy && provider?.enabled) operational_state = "active";
        } else if (raw.legacy_media_model_id) {
          const active = mediaById.get(String(raw.legacy_media_model_id));
          if (active === false) operational_state = "disabled";
          else if (active === true && provider?.enabled) operational_state = "active";
        } else if (raw.lifecycle_state === "candidate") operational_state = "candidate";
        const model = { ...raw, provider_name: provider?.name ?? raw.provider_name ?? null, operational_state };
        if (!unique.has(model.model_id)) unique.set(model.model_id, model);
      }
      setRows([...unique.values()].sort((a, b) => a.display_name.localeCompare(b.display_name)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل كتالوج النماذج.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const capabilitiesByModel = useMemo(() => capabilityKeys(rows), [rows]);
  const models = useMemo(() => [...new Map(rows.map((row) => [row.model_id, row])).values()], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return models.filter((model) => {
      const matchesSearch = !q || `${model.display_name} ${model.model_identifier} ${model.provider_name ?? ""} ${model.service_type}`.toLocaleLowerCase().includes(q);
      const matchesStatus = status === "all" || (status === "active" ? model.operational_state === "active" : status === "restricted" ? model.operational_state === "restricted" : status === "disabled" ? model.operational_state === "disabled" || model.operational_state === "archived" : model.operational_state === "candidate" || model.operational_state === "unknown");
      const matchesCapability = capability === "all" || capabilitiesByModel.get(model.model_id)?.has(capability) === true;
      return matchesSearch && matchesStatus && matchesCapability;
    });
  }, [models, search, status, capability, capabilitiesByModel]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <Text style={styles.eyebrow}>SULY · MODEL REGISTRY</Text>
      <Text style={styles.title}>نماذج التطبيق</Text>
      <Text style={styles.subtitle}>كل النماذج المسجلة في سجل التطبيق، بما فيها النص والصور والفيديو والصوت، مع حالة التشغيل واسم المزود/المفتاح المرتبط.</Text>
    </View>
    <View style={styles.actions}>
      <Link href="/admin/models-operations" asChild><Pressable style={styles.secondaryButton}><Ionicons name="settings-outline" size={16} color={colors.primary}/><Text style={styles.secondaryText}>إدارة التشغيل والاختبارات</Text></Pressable></Link>
      <Link href="/admin/model-capabilities" asChild><Pressable style={styles.primaryButton}><Ionicons name="grid-outline" size={16} color={colors.onPrimary}/><Text style={styles.primaryText}>إدارة القدرات</Text></Pressable></Link>
    </View>
    <View style={styles.metrics}>
      <Text style={styles.metric}>الكل: {models.length}</Text>
      <Text style={styles.metric}>متوفر: {models.filter((m) => m.operational_state === "active").length}</Text>
      <Text style={styles.metric}>مقيّد: {models.filter((m) => m.operational_state === "restricted").length}</Text>
      <Text style={styles.metric}>معطّل: {models.filter((m) => m.operational_state === "disabled" || m.operational_state === "archived").length}</Text>
    </View>
    <View style={styles.searchBox}>
      <Ionicons name="search-outline" size={18} color={colors.textMuted}/>
      <TextInput value={search} onChangeText={setSearch} placeholder="ابحث بأي جزء من اسم النموذج أو المفتاح..." placeholderTextColor={colors.textMuted} style={styles.search} autoCapitalize="none"/>
      {search ? <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={17} color={colors.textMuted}/></Pressable> : null}
    </View>
    <View style={styles.filters}>
      {(Object.keys(FILTER_LABEL) as StatusFilter[]).map((key) => <Pressable key={key} onPress={() => setStatus(key)} style={[styles.chip, status === key && styles.chipActive]}><Text style={[styles.chipText, status === key && styles.chipTextActive]}>{FILTER_LABEL[key]}</Text></Pressable>)}
    </View>
    <Text style={styles.label}>تصفية حسب القدرة</Text>
    <View style={styles.filters}>
      <Pressable onPress={() => setCapability("all")} style={[styles.chip, capability === "all" && styles.chipActive]}><Text style={[styles.chipText, capability === "all" && styles.chipTextActive]}>كل القدرات</Text></Pressable>
      {CAPABILITIES.map(([key, label, icon]) => <Pressable key={key} onPress={() => setCapability(key)} style={[styles.iconChip, capability === key && styles.chipActive]}><Ionicons name={icon} size={14} color={capability === key ? colors.primary : colors.textMuted}/><Text style={[styles.chipText, capability === key && styles.chipTextActive]}>{label}</Text></Pressable>)}
    </View>
    <Text style={styles.resultCount}>عرض {filtered.length} من {models.length}</Text>
    {loading ? <ActivityIndicator color={colors.primary}/> : null}
    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.link}>إعادة المحاولة</Text></Pressable></View> : null}
    {!loading && filtered.map((model) => <View key={model.model_id} style={styles.modelCard}>
      <View style={styles.modelHeading}>
        <View style={styles.modelCopy}>
          <Text style={styles.modelName}>{model.display_name}</Text>
          <Text style={styles.meta}>المفتاح/المزود: {model.provider_name ?? `مزود #${model.provider_id}`}</Text>
          <Text style={styles.meta}>المعرّف: {model.model_identifier} · النوع: {model.service_type}</Text>
        </View>
        <View style={[styles.status, model.operational_state === "active" ? styles.statusActive : model.operational_state === "restricted" ? styles.statusRestricted : styles.statusDisabled]}>
          <Text style={styles.statusText}>{STATUS_LABEL[model.operational_state]}</Text>
        </View>
      </View>
      <View style={styles.capabilityLine}>
        {(CAPABILITIES.filter(([key]) => capabilitiesByModel.get(model.model_id)?.has(key))).slice(0, 7).map(([key, label, icon]) => <View key={key} style={styles.capabilityBadge}><Ionicons name={icon} size={13} color={colors.textSecondary}/><Text style={styles.capabilityText}>{label}</Text></View>)}
        {!capabilitiesByModel.get(model.model_id)?.size ? <Text style={styles.meta}>لا توجد قدرات مسجلة بعد</Text> : null}
      </View>
    </View>)}
    {!loading && filtered.length === 0 ? <Text style={styles.empty}>لا توجد نماذج تطابق البحث والفلاتر.</Text> : null}
  </ScrollView>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 14, gap: 12, paddingBottom: 36 },
  header: { gap: 5, alignItems: "flex-end" },
  eyebrow: { color: c.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  title: { color: c.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "right" },
  subtitle: { color: c.textMuted, fontSize: 10, lineHeight: 17, textAlign: "right" },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  primaryButton: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: c.primary, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  primaryText: { color: c.onPrimary, fontSize: 9, fontWeight: "900" },
  secondaryButton: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.divider, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  secondaryText: { color: c.primary, fontSize: 9, fontWeight: "900" },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  metric: { color: c.textSecondary, fontSize: 9 },
  searchBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.divider, borderRadius: 10, paddingHorizontal: 10, backgroundColor: c.surface },
  search: { flex: 1, minWidth: 0, color: c.textPrimary, paddingVertical: 10, textAlign: "right", fontSize: 10 },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: c.divider, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: c.surface },
  iconChip: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderWidth: 1, borderColor: c.divider, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 6 },
  chipActive: { borderColor: c.primary, backgroundColor: c.primary + "14" },
  chipText: { color: c.textSecondary, fontSize: 8, fontWeight: "700" },
  chipTextActive: { color: c.primary },
  label: { color: c.textPrimary, fontSize: 10, fontWeight: "800", textAlign: "right" },
  resultCount: { color: c.textMuted, fontSize: 9, textAlign: "right" },
  modelCard: { borderWidth: 1, borderColor: c.divider, borderRadius: 12, backgroundColor: c.surface, padding: 11, gap: 8 },
  modelHeading: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 },
  modelCopy: { flex: 1, gap: 3, alignItems: "flex-end" },
  modelName: { color: c.textPrimary, fontSize: 12, fontWeight: "900", textAlign: "right" },
  meta: { color: c.textMuted, fontSize: 8, textAlign: "right" },
  status: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1 },
  statusActive: { borderColor: c.success, backgroundColor: c.success + "12" },
  statusRestricted: { borderColor: c.warning, backgroundColor: c.warning + "12" },
  statusDisabled: { borderColor: c.divider, backgroundColor: c.background },
  statusText: { color: c.textSecondary, fontSize: 8, fontWeight: "800" },
  capabilityLine: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 5 },
  capabilityBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 4, borderWidth: 1, borderColor: c.divider, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4 },
  capabilityText: { color: c.textSecondary, fontSize: 7 },
  empty: { color: c.textMuted, fontSize: 10, textAlign: "center", padding: 20 },
  errorBox: { borderWidth: 1, borderColor: c.error, borderRadius: 9, padding: 10, gap: 6 },
  error: { color: c.error, fontSize: 9, textAlign: "right" },
  link: { color: c.primary, fontSize: 9, fontWeight: "800", textAlign: "right" },
});
