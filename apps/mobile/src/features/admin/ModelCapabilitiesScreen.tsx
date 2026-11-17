import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type ServiceType = "chat" | "image" | "video" | "audio";
type OperationalState = "active" | "disabled" | "restricted" | "candidate" | "archived" | "unknown";
type StatusFilter = "all" | "active" | "restricted" | "disabled";
type RegistryModel = {
  model_id: string; provider_id: number; provider_name: string | null; provider_type?: string | null; service_type: ServiceType;
  model_identifier: string; display_name: string; lifecycle_state: "active" | "candidate" | "archived";
  legacy_chat_model_id: number | null; legacy_media_model_id: string | null; capability_key: string | null;
  operational_state: OperationalState;
};
type Capability = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };
const CAPABILITIES: Capability[] = [
  { key: "text", label: "إدخال وإخراج النص", icon: "text-outline" },
  { key: "chat", label: "المحادثة", icon: "chatbubble-ellipses-outline" },
  { key: "vision", label: "فهم الصور", icon: "eye-outline" },
  { key: "pdf_input", label: "إدخال PDF", icon: "document-text-outline" },
  { key: "file_input", label: "إدخال الملفات", icon: "folder-outline" },
  { key: "video_input", label: "إدخال الفيديو", icon: "videocam-outline" },
  { key: "audio_input", label: "إدخال الصوت", icon: "mic-outline" },
  { key: "audio_output", label: "إخراج الصوت", icon: "volume-high-outline" },
  { key: "image_generation", label: "توليد الصور", icon: "image-outline" },
  { key: "video_generation", label: "توليد الفيديو", icon: "film-outline" },
  { key: "transcription", label: "تفريغ الصوت", icon: "ear-outline" },
  { key: "function_calling", label: "استدعاء الدوال", icon: "git-branch-outline" },
  { key: "structured_output", label: "مخرجات منظمة", icon: "code-slash-outline" },
  { key: "streaming", label: "البث التدريجي", icon: "radio-outline" },
  { key: "web_search", label: "بحث الويب", icon: "search-outline" },
  { key: "file_search", label: "البحث بالملفات", icon: "folder-outline" },
  { key: "computer_use", label: "استخدام الكمبيوتر", icon: "desktop-outline" },
  { key: "code_interpreter", label: "تنفيذ الكود", icon: "code-slash-outline" },
  { key: "mcp_tools", label: "أدوات MCP", icon: "hardware-chip-outline" },
  { key: "gmail", label: "Gmail", icon: "mail-outline" },
  { key: "google_drive", label: "Google Drive", icon: "cloud-outline" },
  { key: "github", label: "GitHub", icon: "logo-github" },
];
const ALIASES: Record<string, string[]> = { pdf_input: ["pdf"], file_input: ["word"], video_input: ["video"] };
const MEDIA_CAPABILITIES: Record<Exclude<ServiceType, "chat">, string[]> = {
  image: ["text", "image_generation", "vision"],
  video: ["text", "video_generation", "video_input", "vision", "audio_output"],
  audio: ["text", "audio_input", "audio_output", "transcription"],
};
const STATUS_LABEL: Record<OperationalState, string> = {
  active: "متوفر", disabled: "معطّل", restricted: "مقيّد", candidate: "مرشح", archived: "مؤرشف", unknown: "غير معلوم",
};

function isStatus(model: RegistryModel, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "active") return model.operational_state === "active";
  if (filter === "restricted") return model.operational_state === "restricted";
  return model.operational_state === "disabled" || model.operational_state === "archived" || model.operational_state === "candidate" || model.operational_state === "unknown";
}

export function ModelCapabilitiesScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<RegistryModel[]>([]);
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [registry, providers, chat, media, health] = await Promise.all([
        supabase.rpc("suly_admin_list_unified_model_capabilities"),
        supabase.from("ai_providers").select("id,name,provider_type,enabled").limit(500),
        supabase.from("ai_models").select("id,enabled,routing_group").limit(1000),
        supabase.from("suly_media_generation_models").select("id,is_active").limit(1000),
        supabase.from("ai_model_health").select("model_id,auto_restricted").limit(1000),
      ]);
      if (registry.error) throw registry.error;
      if (providers.error) throw providers.error;
      const providerMap = new Map<number, { name: string; provider_type: string; enabled: boolean }>((providers.data ?? []).map((p) => [Number(p.id), { name: String(p.name ?? "—"), provider_type: String(p.provider_type ?? "—"), enabled: p.enabled === true }]));
      const chatMap = new Map<number, { enabled: boolean; routing_group: string }>((chat.data ?? []).map((m) => [Number(m.id), { enabled: m.enabled === true, routing_group: String(m.routing_group ?? "") }]));
      const mediaMap = new Map<string, boolean>((media.data ?? []).map((m) => [String(m.id), m.is_active === true]));
      const restricted = new Set<number>((health.data ?? []).filter((h) => h.auto_restricted === true).map((h) => Number(h.model_id)));
      const next = ((registry.data ?? []) as Array<Omit<RegistryModel, "operational_state">>).map((model) => {
        const provider = providerMap.get(Number(model.provider_id));
        let operational_state: OperationalState = "unknown";
        if (model.lifecycle_state === "archived") operational_state = "archived";
        else if (provider?.enabled === false) operational_state = "disabled";
        else if (model.legacy_chat_model_id !== null) {
          const legacy = chatMap.get(Number(model.legacy_chat_model_id));
          if ((legacy && !legacy.enabled) || legacy?.routing_group === "disabled") operational_state = "disabled";
          else if (restricted.has(Number(model.legacy_chat_model_id))) operational_state = "restricted";
          else if (legacy && provider?.enabled) operational_state = "active";
        } else if (model.legacy_media_model_id) {
          const active = mediaMap.get(String(model.legacy_media_model_id));
          if (active === false) operational_state = "disabled";
          else if (active === true && provider?.enabled) operational_state = "active";
        } else if (model.lifecycle_state === "candidate") operational_state = "candidate";
        return { ...model, provider_name: provider?.name ?? model.provider_name ?? null, provider_type: provider?.provider_type ?? null, operational_state };
      });
      setRows(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل دليل القدرات.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const models = useMemo(() => [...new Map(rows.map((row) => [row.model_id, row])).values()], [rows]);
  const capabilityMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of rows) if (row.capability_key) {
      const keys = map.get(row.model_id) ?? new Set<string>();
      keys.add(row.capability_key);
      map.set(row.model_id, keys);
    }
    return map;
  }, [rows]);
  const selected = CAPABILITIES.find((item) => item.key === selectedCapability) ?? null;
  const linked = useMemo(() => {
    if (!selected) return [];
    const keys = new Set([selected.key, ...(ALIASES[selected.key] ?? [])]);
    return models.filter((model) => [...(capabilityMap.get(model.model_id) ?? [])].some((key) => keys.has(key)));
  }, [models, capabilityMap, selected]);

  const addable = useMemo(() => {
    if (!selected) return [];
    const linkedIds = new Set(linked.map((model) => model.model_id));
    const q = search.trim().toLocaleLowerCase();
    return models.filter((model) => {
      if (linkedIds.has(model.model_id)) return false;
      if (model.service_type !== "chat" && !MEDIA_CAPABILITIES[model.service_type as Exclude<ServiceType, "chat">]?.includes(selected.key)) return false;
      if (!isStatus(model, statusFilter)) return false;
      if (capabilityFilter !== "all" && !capabilityMap.get(model.model_id)?.has(capabilityFilter)) return false;
      return !q || `${model.display_name} ${model.model_identifier} ${model.provider_name ?? ""}`.toLocaleLowerCase().includes(q);
    });
  }, [models, linked, selected, search, statusFilter, capabilityFilter, capabilityMap]);

  const addModel = async (model: RegistryModel) => {
    if (!selected) return;
    setSavingId(model.model_id); setError(null); setNotice(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("suly_admin_save_unified_model_capability", {
        p_model_id: model.model_id, p_capability_key: selected.key,
        p_vendor_claim_status: "unknown", p_vendor_evidence_url: null,
        p_provider_test_status: "not_tested", p_provider_evidence_url: null,
        p_suly_test_status: "not_tested", p_suly_evidence_url: null,
        p_notes: "أضيف من دليل القدرات؛ يحتاج مراجعة واختبار قبل الاعتماد.",
        p_review_status: "suggested",
      });
      if (rpcError) throw rpcError;
      if (data?.success !== true) throw new Error("لم تؤكد قاعدة البيانات إضافة النموذج.");
      setNotice(`تم ربط ${model.display_name} بقدرة ${selected.label} كاقتراح يحتاج مراجعة.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذرت إضافة النموذج.");
    } finally { setSavingId(null); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {!selected ? <>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SULY · CAPABILITY DIRECTORY</Text>
        <Text style={styles.title}>قدرات النماذج</Text>
        <Text style={styles.subtitle}>اختر قدرة لفتح صفحتها ورؤية النماذج المرتبطة بها وإضافة نماذج أخرى من كتالوج التطبيق.</Text>
      </View>
      <View style={styles.grid}>
        {CAPABILITIES.map((item) => {
          const count = models.filter((model) => capabilityMap.get(model.model_id)?.has(item.key) || (ALIASES[item.key] ?? []).some((alias) => capabilityMap.get(model.model_id)?.has(alias))).length;
          return <Pressable key={item.key} onPress={() => { setSelectedCapability(item.key); setSearch(""); setNotice(null); setError(null); }} style={styles.tile}>
            <View style={styles.tileIcon}><Ionicons name={item.icon} size={23} color={colors.primary}/></View>
            <Text style={styles.tileTitle}>{item.label}</Text>
            <Text style={styles.tileCount}>{count} نموذج</Text>
          </Pressable>;
        })}
      </View>
    </> : <>
      <View style={styles.header}>
        <Pressable onPress={() => { setSelectedCapability(null); setAddOpen(false); setError(null); setNotice(null); }} style={styles.back}><Ionicons name="arrow-forward" size={16} color={colors.primary}/><Text style={styles.backText}>كل القدرات</Text></Pressable>
        <View style={styles.detailTitleRow}>
          <View style={styles.tileIcon}><Ionicons name={selected.icon} size={23} color={colors.primary}/></View>
          <View style={styles.detailTitleCopy}><Text style={styles.eyebrow}>إدارة القدرة</Text><Text style={styles.title}>{selected.label}</Text></View>
        </View>
        <Text style={styles.subtitle}>النماذج المرتبطة بهذه القدرة. إضافة النموذج لا تفعّله ولا تعتمد قدرته تلقائيًا.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => { setAddOpen(true); setSearch(""); setStatusFilter("all"); setCapabilityFilter("all"); }} style={styles.primaryButton}><Ionicons name="add-circle-outline" size={17} color={colors.onPrimary}/><Text style={styles.primaryText}>إضافة نموذج</Text></Pressable>
        <Link href="/admin/model-capability-review" asChild><Pressable style={styles.secondaryButton}><Ionicons name="clipboard-outline" size={16} color={colors.primary}/><Text style={styles.secondaryText}>مراجعة الأدلة والاختبارات</Text></Pressable></Link>
      </View>
      <Text style={styles.sectionTitle}>النماذج المرتبطة: {linked.length}</Text>
      {linked.map((model) => <View key={model.model_id} style={styles.modelCard}>
        <View style={styles.modelCopy}>
          <Text style={styles.modelName}>{model.display_name}</Text>
          <Text style={styles.meta}>اسم المفتاح: {model.provider_name ?? `مزود #${model.provider_id}`} · المزود: {model.provider_type ?? "—"}</Text>
          <Text style={styles.meta}>{model.model_identifier} · {model.service_type}</Text>
        </View>
        <View style={styles.modelFooter}>
          <Text style={styles.meta}>حالة التشغيل: {STATUS_LABEL[model.operational_state]}</Text>
          <Text style={styles.meta}>المراجعة: {rows.find((row) => row.model_id === model.model_id && row.capability_key === selected.key)?.capability_key ? "مسجلة" : "مرتبطة عبر اسم قدرة قديم"}</Text>
        </View>
      </View>)}
      {linked.length === 0 ? <Text style={styles.empty}>لا توجد نماذج مرتبطة بهذه القدرة حاليًا. استخدم زر إضافة نموذج.</Text> : null}
    </>}
    {loading ? <ActivityIndicator color={colors.primary}/> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.success}>{notice}</Text> : null}
    <Modal visible={addOpen && !!selected} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}><Text style={styles.modalTitle}>إضافة نموذج إلى {selected?.label}</Text><Text style={styles.meta}>اختر من كل النماذج المسجلة في التطبيق</Text></View>
            <Pressable onPress={() => setAddOpen(false)}><Ionicons name="close-circle-outline" size={24} color={colors.textMuted}/></Pressable>
          </View>
          <View style={styles.searchBox}><Ionicons name="search-outline" size={17} color={colors.textMuted}/><TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم النموذج أو جزء منه..." placeholderTextColor={colors.textMuted} style={styles.search} autoCapitalize="none"/></View>
          <Text style={styles.filterLabel}>حالة النموذج</Text>
          <View style={styles.filters}>
            {([["all","الكل"],["active","المتوفر"],["restricted","المقيّد"],["disabled","المعطّل"]] as Array<[StatusFilter,string]>).map(([key,label]) => <Pressable key={key} onPress={() => setStatusFilter(key)} style={[styles.chip,statusFilter===key&&styles.chipActive]}><Text style={[styles.chipText,statusFilter===key&&styles.chipTextActive]}>{label}</Text></Pressable>)}
          </View>
          <Text style={styles.filterLabel}>فلترة حسب القدرات المسجلة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalFilters}>
            <Pressable onPress={() => setCapabilityFilter("all")} style={[styles.chip,capabilityFilter==="all"&&styles.chipActive]}><Text style={[styles.chipText,capabilityFilter==="all"&&styles.chipTextActive]}>كل القدرات</Text></Pressable>
            {CAPABILITIES.map((item) => <Pressable key={item.key} onPress={() => setCapabilityFilter(item.key)} style={[styles.chip,capabilityFilter===item.key&&styles.chipActive]}><Text style={[styles.chipText,capabilityFilter===item.key&&styles.chipTextActive]}>{item.label}</Text></Pressable>)}
          </ScrollView>
          <Text style={styles.resultCount}>{addable.length} نموذج مطابق</Text>
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {addable.map((model) => <View key={model.model_id} style={styles.resultRow}>
              <View style={styles.modelCopy}>
                <Text style={styles.modelName}>{model.display_name}</Text>
                <Text style={styles.meta}>المفتاح/المزود: {model.provider_name ?? `مزود #${model.provider_id}`}</Text>
                <Text style={styles.meta}>{model.model_identifier} · {model.service_type} · {STATUS_LABEL[model.operational_state]}</Text>
              </View>
              <Pressable disabled={savingId === model.model_id} onPress={() => void addModel(model)} style={styles.addButton}>
                {savingId === model.model_id ? <ActivityIndicator color={colors.onPrimary} size="small"/> : <Ionicons name="add" size={18} color={colors.onPrimary}/>}
              </Pressable>
            </View>)}
            {!addable.length ? <Text style={styles.empty}>لا توجد نماذج تطابق البحث والفلاتر لهذه القدرة.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </ScrollView>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, content: { padding: 14, gap: 12, paddingBottom: 36 },
  header: { gap: 6, alignItems: "flex-end" }, eyebrow: { color: c.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: c.textPrimary, fontSize: 21, fontWeight: "900", textAlign: "right" }, subtitle: { color: c.textMuted, fontSize: 10, lineHeight: 17, textAlign: "right" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  tile: { width: "31.5%", minHeight: 112, borderWidth: 1, borderColor: c.divider, borderRadius: 12, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", padding: 9, gap: 7 },
  tileIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.primary + "14", alignItems: "center", justifyContent: "center" },
  tileTitle: { color: c.textPrimary, fontSize: 9, fontWeight: "800", textAlign: "center" }, tileCount: { color: c.textMuted, fontSize: 8 },
  back: { flexDirection: "row-reverse", alignItems: "center", gap: 5, alignSelf: "flex-start" }, backText: { color: c.primary, fontSize: 10, fontWeight: "800" },
  detailTitleRow: { flexDirection: "row-reverse", alignItems: "center", gap: 9 }, detailTitleCopy: { flex: 1, alignItems: "flex-end", gap: 2 },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  primaryButton: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: c.primary, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  primaryText: { color: c.onPrimary, fontSize: 9, fontWeight: "900" }, secondaryButton: { flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1, borderColor: c.divider, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9 },
  secondaryText: { color: c.primary, fontSize: 9, fontWeight: "800" }, sectionTitle: { color: c.textPrimary, fontSize: 12, fontWeight: "900", textAlign: "right" },
  modelCard: { borderWidth: 1, borderColor: c.divider, borderRadius: 10, backgroundColor: c.surface, padding: 10, gap: 7 },
  modelCopy: { flex: 1, alignItems: "flex-end", gap: 3 }, modelName: { color: c.textPrimary, fontSize: 10, fontWeight: "900", textAlign: "right" },
  meta: { color: c.textMuted, fontSize: 8, textAlign: "right" }, modelFooter: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 6, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 6 },
  empty: { color: c.textMuted, fontSize: 9, textAlign: "center", padding: 18 }, error: { color: c.error, fontSize: 9, textAlign: "right" }, success: { color: c.success, fontSize: 9, textAlign: "right" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "flex-end" },
  modalCard: { maxHeight: "92%", backgroundColor: c.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, gap: 9 },
  modalHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 }, modalHeaderCopy: { flex: 1, alignItems: "flex-end", gap: 3 },
  modalTitle: { color: c.textPrimary, fontSize: 13, fontWeight: "900", textAlign: "right" },
  searchBox: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.divider, borderRadius: 9, paddingHorizontal: 9 },
  search: { flex: 1, minWidth: 0, color: c.textPrimary, fontSize: 10, paddingVertical: 9, textAlign: "right" },
  filterLabel: { color: c.textSecondary, fontSize: 9, fontWeight: "800", textAlign: "right" },
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 5 }, horizontalFilters: { flexDirection: "row-reverse", gap: 5 },
  chip: { borderWidth: 1, borderColor: c.divider, borderRadius: 18, paddingHorizontal: 9, paddingVertical: 6 },
  chipActive: { borderColor: c.primary, backgroundColor: c.primary + "14" }, chipText: { color: c.textSecondary, fontSize: 8 }, chipTextActive: { color: c.primary, fontWeight: "800" },
  resultCount: { color: c.textMuted, fontSize: 8, textAlign: "right" }, results: { minHeight: 150 },
  resultRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: c.divider, paddingVertical: 9 },
  addButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
});
