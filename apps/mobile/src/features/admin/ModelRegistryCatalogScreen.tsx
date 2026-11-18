import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { AdminMobileBreadcrumb } from "./AdminMobileBreadcrumb";

type ServiceType = "chat" | "image" | "video" | "audio";
type OperationalState = "active" | "disabled" | "restricted" | "candidate" | "archived" | "unknown";
type RegistryModel = {
  model_id: string;
  provider_id: number;
  provider_name: string | null;
  provider_type?: string | null;
  provider_enabled?: boolean;
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
const CAPABILITY_ALIASES: Record<string, string[]> = { pdf_input: ["pdf"], file_input: ["word"], video_input: ["video"] };
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
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const [selectedModel, setSelectedModel] = useState<RegistryModel | null>(null);
  const [rows, setRows] = useState<RegistryModel[]>([]);
  const [pricesByModel, setPricesByModel] = useState<Map<number, { input: number; output: number }>>(new Map());
  const [chatOrderByModel, setChatOrderByModel] = useState<Map<number, number>>(new Map());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [capability, setCapability] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [registry, providers, chat, media, health, priceRows, chatRoutes] = await Promise.all([
        supabase.rpc("suly_admin_list_unified_model_capabilities"),
        supabase.rpc("suly_admin_list_providers"),
        supabase.from("ai_models").select("id,enabled,routing_group").limit(1000),
        supabase.from("suly_media_generation_models").select("id,is_active").limit(1000),
        supabase.from("ai_model_health").select("model_id,auto_restricted").limit(1000),
        adminService.getModelPriceVersions().catch(() => []),
        supabase.from("ai_route_model_assignments").select("model_id,priority").eq("route_role", "chat").eq("enabled", true).order("priority", { ascending: true }),
      ]);
      if (registry.error) throw registry.error;
      if (providers.error) throw providers.error;
      const providerById = new Map<number, { name: string; provider_type: string; enabled: boolean }>(
        ((providers.data ?? []) as Array<{ id: number; name: string; provider_type: string; enabled: boolean }>).map((item) => [Number(item.id), { name: String(item.name ?? "—"), provider_type: String(item.provider_type ?? "—"), enabled: item.enabled === true }])
      );
      const chatById = new Map<number, { enabled: boolean; routing_group: string }>(
        (chat.data ?? []).map((item) => [Number(item.id), { enabled: item.enabled === true, routing_group: String(item.routing_group ?? "") }])
      );
      const mediaById = new Map<string, boolean>((media.data ?? []).map((item) => [String(item.id), item.is_active === true]));
      const restricted = new Set<number>((health.data ?? []).filter((item) => item.auto_restricted === true).map((item) => Number(item.model_id)));
      const normalizedRows: RegistryModel[] = ((registry.data ?? []) as Array<Omit<RegistryModel, "operational_state">>).map((raw) => {
        const provider = providerById.get(Number(raw.provider_id));
        let operational_state: OperationalState = "unknown";
        if (raw.lifecycle_state === "archived") operational_state = "archived";
        else if (!provider || provider.enabled === false) operational_state = "disabled";
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
        return { ...raw, provider_name: provider?.name ?? raw.provider_name ?? null, provider_type: provider?.provider_type ?? null, provider_enabled: provider?.enabled === true, operational_state };
      });
      // Retain all capability rows; the model cards deduplicate models separately.
      setRows(normalizedRows.sort((a, b) => a.display_name.localeCompare(b.display_name)));
      const priceMap = new Map<number, { input: number; output: number }>();
      for (const price of (priceRows ?? []) as Array<{ model_id: number; provider_input_cost_egp_per_million: number; provider_output_cost_egp_per_million: number }>) priceMap.set(Number(price.model_id), { input: Number(price.provider_input_cost_egp_per_million), output: Number(price.provider_output_cost_egp_per_million) });
      setPricesByModel(priceMap);
      const orderMap = new Map<number, number>();
      (chatRoutes.data ?? []).forEach((route, index) => orderMap.set(Number(route.model_id), index + 1));
      setChatOrderByModel(orderMap);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل كتالوج النماذج.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const capabilitiesByModel = useMemo(() => capabilityKeys(rows), [rows]);
  const openOperationalRecord = (model: RegistryModel) => {
    if (!model.provider_enabled) {
      router.push("/admin/api-keys");
      return;
    }
    const q = encodeURIComponent(model.model_identifier);
    if (model.service_type === "chat") {
      router.push(`/admin/models?q=${q}` as never);
      return;
    }
    if (model.service_type === "audio") {
      const evidence = capabilitiesByModel.get(model.model_id);
      if (evidence?.has("transcription")) {
        router.push(`/admin/media-catalog?kind=transcription&q=${q}` as never);
      } else if (evidence?.has("audio_output")) {
        router.push(`/admin/media-catalog?kind=voice&q=${q}` as never);
      } else {
        router.push("/admin/model-capability-review");
      }
      return;
    }
    router.push(`/admin/media-catalog?kind=${model.service_type}&q=${q}` as never);
  };
  const openModelPriceHistory = (model: RegistryModel) => {
    const q = encodeURIComponent(model.model_identifier);
    if (model.service_type === "chat") {
      router.push(`/admin/models?q=${q}` as never);
      return;
    }
    if (model.service_type === "audio") {
      const evidence = capabilitiesByModel.get(model.model_id);
      if (evidence?.has("transcription")) {
        router.push(`/admin/media-catalog?kind=transcription&q=${q}` as never);
      } else if (evidence?.has("audio_output")) {
        router.push(`/admin/media-catalog?kind=voice&q=${q}` as never);
      } else {
        router.push("/admin/model-capability-review");
      }
      return;
    }
    router.push(`/admin/media-catalog?kind=${model.service_type}&q=${q}` as never);
  };
  const models = useMemo(() => [...new Map(rows.map((row) => [row.model_id, row])).values()], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return models.filter((model) => {
      const matchesSearch = !q || `${model.display_name} ${model.model_identifier} ${model.provider_name ?? ""} ${model.service_type}`.toLocaleLowerCase().includes(q);
      const matchesStatus = status === "all" || (status === "active" ? model.operational_state === "active" : status === "restricted" ? model.operational_state === "restricted" : status === "disabled" ? model.operational_state === "disabled" || model.operational_state === "archived" : model.operational_state === "candidate" || model.operational_state === "unknown");
      const matchesCapability = capability === "all" || [capability, ...(CAPABILITY_ALIASES[capability] ?? [])].some((key) => capabilitiesByModel.get(model.model_id)?.has(key) === true);
      return matchesSearch && matchesStatus && matchesCapability;
    });
  }, [models, search, status, capability, capabilitiesByModel]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <AdminMobileBreadcrumb />
    <View style={styles.header}>
      <Text style={styles.eyebrow}>SULY · MODEL REGISTRY</Text>
      <Text style={styles.title}>نماذج التطبيق</Text>
      <Text style={styles.subtitle}>كل النماذج المسجلة في سجل التطبيق، بما فيها النص والصور والفيديو والصوت، مع حالة التشغيل واسم المزود/المفتاح المرتبط.</Text>
    </View>
    <View style={styles.actions}>
      <Link href="/admin/models-operations" asChild><Pressable style={styles.secondaryButton}><Ionicons name="settings-outline" size={16} color={colors.primary}/><Text style={styles.secondaryText}>إدارة التشغيل والاختبارات</Text></Pressable></Link>
      <Link href="/admin/model-capabilities" asChild><Pressable style={styles.primaryButton}><Ionicons name="grid-outline" size={16} color={colors.onPrimary}/><Text style={styles.primaryText}>إدارة القدرات</Text></Pressable></Link>
    </View>
    <View style={styles.viewToolbar}>
      <Text style={styles.label}>طريقة العرض</Text>
      <View style={styles.viewToggle}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: viewMode === "table" }} onPress={() => setViewMode("table")} style={[styles.viewOption, viewMode === "table" && styles.viewOptionActive]}>
          <Ionicons name="list-outline" size={15} color={viewMode === "table" ? colors.primary : colors.textMuted}/><Text style={[styles.viewOptionText, viewMode === "table" && styles.viewOptionTextActive]}>جدول</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: viewMode === "cards" }} onPress={() => setViewMode("cards")} style={[styles.viewOption, viewMode === "cards" && styles.viewOptionActive]}>
          <Ionicons name="grid-outline" size={15} color={viewMode === "cards" ? colors.primary : colors.textMuted}/><Text style={[styles.viewOptionText, viewMode === "cards" && styles.viewOptionTextActive]}>بطاقات</Text>
        </Pressable>
      </View>
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
    {!loading && viewMode === "cards" ? filtered.map((model) => <View key={model.model_id} style={styles.modelCard}>
      <View style={styles.modelHeading}>
        <View style={styles.modelIcon}><Ionicons name={model.service_type === "image" ? "image-outline" : model.service_type === "video" ? "videocam-outline" : model.service_type === "audio" ? "volume-high-outline" : "hardware-chip-outline"} size={23} color={colors.primary}/></View>
        <View style={styles.modelCopy}>
          <Text style={styles.modelName}>{model.display_name}</Text>
          <Text style={styles.meta}>اسم المفتاح: {model.provider_name ?? `مزود #${model.provider_id}`} · المزود: {model.provider_type ?? "—"}</Text>
          <Text style={styles.meta}>المعرّف: {model.model_identifier} · النوع: {model.service_type}</Text>
        </View>
        <View style={[styles.status, model.operational_state === "active" ? styles.statusActive : model.operational_state === "restricted" ? styles.statusRestricted : styles.statusDisabled]}>
          <Text style={styles.statusText}>{STATUS_LABEL[model.operational_state]}</Text>
        </View>
      </View>
      <View style={styles.capabilityLine}>
        {(CAPABILITIES.filter(([key]) => capabilitiesByModel.get(model.model_id)?.has(key))).map(([key, label, icon]) => <View key={key} style={styles.capabilityBadge}><Ionicons name={icon} size={13} color={colors.textSecondary}/><Text style={styles.capabilityText}>{label}</Text></View>)}
        {!capabilitiesByModel.get(model.model_id)?.size ? <Text style={styles.meta}>لا توجد قدرات مسجلة بعد</Text> : null}
      </View>
      {model.legacy_chat_model_id !== null ? <View style={styles.priceLine}>
        <View style={styles.priceCell}><Text style={styles.priceLabel}>تكلفة الإدخال / مليون</Text><Text style={styles.priceValue}>{pricesByModel.has(Number(model.legacy_chat_model_id)) ? `${pricesByModel.get(Number(model.legacy_chat_model_id))!.input.toLocaleString("en-EG")} ج.م` : "غير مسجلة"}</Text></View>
        <View style={styles.priceCell}><Text style={styles.priceLabel}>تكلفة الإخراج / مليون</Text><Text style={styles.priceValue}>{pricesByModel.has(Number(model.legacy_chat_model_id)) ? `${pricesByModel.get(Number(model.legacy_chat_model_id))!.output.toLocaleString("en-EG")} ج.م` : "غير مسجلة"}</Text></View>
        <View style={styles.priceCell}><Text style={styles.priceLabel}>ترتيب الشات</Text><Text style={styles.priceValue}>{chatOrderByModel.has(Number(model.legacy_chat_model_id)) ? `#${chatOrderByModel.get(Number(model.legacy_chat_model_id))}` : "غير مربوط"}</Text></View>
      </View> : null}
      <View style={styles.modelCardActions}>
        <Pressable accessibilityRole="button" onPress={() => setSelectedModel(model)} style={styles.detailAction}><Ionicons name="information-circle-outline" size={14} color={colors.primary}/><Text style={styles.detailActionText}>تفاصيل النموذج</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => openOperationalRecord(model)} style={styles.manageAction}><Ionicons name="settings-outline" size={14} color={colors.textSecondary}/><Text style={styles.manageActionText}>{model.provider_enabled ? "فتح الإدارة" : "إدارة المزود"}</Text></Pressable>
      </View>
    </View>) : null}
    {!loading && viewMode === "table" ? <View style={styles.tableFrame}>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScrollContent}>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.tableNameCell]}>النموذج / المعرّف</Text>
            <Text style={[styles.tableHeaderCell, styles.tableProviderCell]}>المزود</Text>
            <Text style={[styles.tableHeaderCell, styles.tableTypeCell]}>النوع</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCapabilitiesCell]}>القدرات المسجلة</Text>
            <Text style={[styles.tableHeaderCell, styles.tableStateCell]}>الحالة</Text>
            <Text style={[styles.tableHeaderCell, styles.tableActionsCell]}>الإجراءات</Text>
          </View>
          {filtered.map((model) => {
            const modelCapabilities = CAPABILITIES.filter(([key]) => capabilitiesByModel.get(model.model_id)?.has(key)).map(([, label]) => label);
            return <View key={model.model_id} style={styles.tableRow}>
              <View style={[styles.tableCell, styles.tableNameCell]}><Text style={styles.tableModelName}>{model.display_name}</Text><Text style={styles.meta}>{model.model_identifier}</Text></View>
              <View style={[styles.tableCell, styles.tableProviderCell]}><Text style={styles.tableCellText}>{model.provider_name ?? `مزود #${model.provider_id}`}</Text><Text style={styles.meta}>{model.provider_type ?? "—"}</Text></View>
              <View style={[styles.tableCell, styles.tableTypeCell]}><Text style={styles.tableCellText}>{model.service_type}</Text></View>
              <View style={[styles.tableCell, styles.tableCapabilitiesCell]}><Text style={styles.tableCellText}>{modelCapabilities.length ? modelCapabilities.join(" · ") : "غير موثقة"}</Text></View>
              <View style={[styles.tableCell, styles.tableStateCell]}><View style={[styles.status, model.operational_state === "active" ? styles.statusActive : model.operational_state === "restricted" ? styles.statusRestricted : styles.statusDisabled]}><Text style={styles.statusText}>{STATUS_LABEL[model.operational_state]}</Text></View></View>
              <View style={[styles.tableCell, styles.tableActionsCell]}>
                <Pressable accessibilityRole="button" onPress={() => setSelectedModel(model)} style={styles.tableAction}><Ionicons name="information-circle-outline" size={14} color={colors.primary}/><Text style={styles.tableActionText}>تفاصيل</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => openOperationalRecord(model)} style={styles.tableAction}><Ionicons name="settings-outline" size={14} color={colors.textSecondary}/><Text style={styles.tableActionText}>{model.provider_enabled ? "إدارة" : "المزود"}</Text></Pressable>
              </View>
            </View>;
          })}
        </View>
      </ScrollView>
    </View> : null}
    {!loading && filtered.length === 0 ? <Text style={styles.empty}>لا توجد نماذج تطابق البحث والفلاتر.</Text> : null}
    <Modal visible={selectedModel !== null} transparent animationType="slide" onRequestClose={() => setSelectedModel(null)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalScrim} onPress={() => setSelectedModel(null)} accessibilityRole="button" accessibilityLabel="إغلاق التفاصيل"/>
        <View style={styles.detailModal}>
          <View style={styles.detailModalHeader}>
            <View style={styles.detailModalCopy}>
              <Text style={styles.detailModalEyebrow}>MODEL DETAILS · READ ONLY</Text>
              <Text style={styles.detailModalTitle}>{selectedModel?.display_name ?? "تفاصيل النموذج"}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={() => setSelectedModel(null)}><Ionicons name="close-circle-outline" size={23} color={colors.textMuted}/></Pressable>
          </View>
          {selectedModel ? <>
            <View style={styles.detailMetaGrid}>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>المزود / اسم المفتاح</Text><Text style={styles.detailMetaValue}>{selectedModel.provider_name ?? `مزود #${selectedModel.provider_id}`} · {selectedModel.provider_type ?? "—"}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>نوع الخدمة</Text><Text style={styles.detailMetaValue}>{selectedModel.service_type}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>معرّف المزود</Text><Text selectable style={styles.detailMetaValue}>{selectedModel.model_identifier}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>دورة الحياة</Text><Text style={styles.detailMetaValue}>{selectedModel.lifecycle_state === "active" ? "مفعل في السجل" : selectedModel.lifecycle_state === "archived" ? "مؤرشف" : "مرشح"}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>حالة التشغيل</Text><Text style={styles.detailMetaValue}>{STATUS_LABEL[selectedModel.operational_state]}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>حالة المزود</Text><Text style={styles.detailMetaValue}>{selectedModel.provider_enabled ? "مفعّل" : "معطّل أو غير متاح"}</Text></View>
            </View>
            <Text style={styles.detailSectionTitle}>القدرات المسجلة — ليست كلها معتمدة</Text>
            <View style={styles.capabilityLine}>
              {(CAPABILITIES.filter(([key]) => capabilitiesByModel.get(selectedModel.model_id)?.has(key))).map(([key, label, icon]) => <View key={key} style={styles.capabilityBadge}><Ionicons name={icon} size={13} color={colors.textSecondary}/><Text style={styles.capabilityText}>{label}</Text></View>)}
              {!capabilitiesByModel.get(selectedModel.model_id)?.size ? <Text style={styles.meta}>لا توجد أدلة قدرات مسجلة لهذا النموذج.</Text> : null}
            </View>
            <View style={styles.detailNotice}><Text style={styles.detailNoticeText}>الأسعار وسجل الصحة والتاريخ التفصيلي للتدقيق موجودة في صفحاتها المختصة؛ لم تُنسخ إلى هذا الملخص ولا يتم استنتاج قيم غير متاحة.</Text></View>
            <View style={styles.detailLinks}>
              <Pressable accessibilityRole="button" onPress={() => { setSelectedModel(null); router.push("/admin/model-capability-review"); }} style={styles.detailLink}><Text style={styles.detailLinkText}>مراجعة أدلة القدرات</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setSelectedModel(null); router.push("/admin/models-operations"); }} style={styles.detailLink}><Text style={styles.detailLinkText}>التشغيل والصحة</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { const model = selectedModel; setSelectedModel(null); openModelPriceHistory(model); }} style={styles.detailLink}><Text style={styles.detailLinkText}>سجل أسعار النموذج</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setSelectedModel(null); router.push("/admin/audit"); }} style={styles.detailLink}><Text style={styles.detailLinkText}>سجل التدقيق</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" onPress={() => { const model = selectedModel; setSelectedModel(null); openOperationalRecord(model); }} style={styles.detailPrimaryAction}><Text style={styles.detailPrimaryActionText}>{selectedModel.provider_enabled ? "فتح شاشة إدارة النموذج" : "فتح إدارة المزود"}</Text></Pressable>
          </> : null}
        </View>
      </View>
    </Modal>
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
  viewToolbar: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  viewToggle: { flexDirection: "row-reverse", borderWidth: 1, borderColor: c.divider, borderRadius: 10, padding: 3, backgroundColor: c.surface, gap: 3 },
  viewOption: { minHeight: 32, paddingHorizontal: 10, borderRadius: 7, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5 },
  viewOptionActive: { backgroundColor: c.primary + "18" },
  viewOptionText: { color: c.textMuted, fontSize: 9, fontWeight: "700" },
  viewOptionTextActive: { color: c.primary },
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
  tableFrame: { borderWidth: 1, borderColor: c.divider, borderRadius: 12, overflow: "hidden", backgroundColor: c.surface },
  tableScrollContent: { minWidth: "100%" },
  table: { minWidth: 890 },
  tableHeader: { minHeight: 42, flexDirection: "row-reverse", alignItems: "center", backgroundColor: c.surfaceElevated, borderBottomWidth: 1, borderBottomColor: c.divider },
  tableHeaderCell: { color: c.textSecondary, fontSize: 9, fontWeight: "900", textAlign: "right", paddingHorizontal: 10 },
  tableRow: { minHeight: 58, flexDirection: "row-reverse", alignItems: "center", borderBottomWidth: 1, borderBottomColor: c.divider },
  tableCell: { minHeight: 58, paddingHorizontal: 10, paddingVertical: 7, justifyContent: "center", alignItems: "flex-end", gap: 3 },
  tableNameCell: { width: 205 }, tableProviderCell: { width: 145 }, tableTypeCell: { width: 85 }, tableCapabilitiesCell: { width: 235 }, tableStateCell: { width: 100 }, tableActionsCell: { width: 120 },
  tableModelName: { color: c.textPrimary, fontSize: 10, fontWeight: "900", textAlign: "right" },
  tableCellText: { color: c.textSecondary, fontSize: 9, textAlign: "right" },
  tableAction: { flexDirection: "row-reverse", alignItems: "center", gap: 3, paddingVertical: 4 },
  tableActionText: { color: c.textSecondary, fontSize: 8, fontWeight: "700" },
  modelCardActions: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 7 },
  detailAction: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingVertical: 5 }, detailActionText: { color: c.primary, fontSize: 9, fontWeight: "800" },
  manageAction: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingVertical: 5 }, manageActionText: { color: c.textSecondary, fontSize: 9, fontWeight: "700" },
  modelCard: { borderWidth: 1, borderColor: c.divider, borderRadius: 12, backgroundColor: c.surface, padding: 11, gap: 8 },
  modelHeading: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 },
  modelIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.primary + "14", borderWidth: 1, borderColor: c.divider, alignItems: "center", justifyContent: "center" },
  priceLine: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 8 },
  priceCell: { flex: 1, minWidth: 82, backgroundColor: c.surfaceElevated, borderRadius: 8, padding: 7, gap: 4 },
  priceLabel: { color: c.textMuted, fontSize: 7, textAlign: "right" },
  priceValue: { color: c.textPrimary, fontSize: 9, fontWeight: "900", textAlign: "right" },
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
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: c.modalOverlay, padding: 12 }, modalScrim: { ...StyleSheet.absoluteFill }, detailModal: { maxHeight: "88%", width: "100%", maxWidth: 760, alignSelf: "center", borderWidth: 1, borderColor: c.divider, borderTopLeftRadius: 17, borderTopRightRadius: 17, borderBottomLeftRadius: 13, borderBottomRightRadius: 13, backgroundColor: c.surface, padding: 15, gap: 11 },
  detailModalHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 }, detailModalCopy: { flex: 1, alignItems: "flex-end", gap: 3 }, detailModalEyebrow: { color: c.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1 }, detailModalTitle: { color: c.textPrimary, fontSize: 17, fontWeight: "900", textAlign: "right" },
  detailMetaGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }, detailMetaCell: { flexBasis: "48%", flexGrow: 1, minWidth: 120, backgroundColor: c.surfaceElevated, borderRadius: 8, padding: 9, gap: 4 }, detailMetaLabel: { color: c.textMuted, fontSize: 8, textAlign: "right" }, detailMetaValue: { color: c.textPrimary, fontSize: 9, fontWeight: "700", textAlign: "right" },
  detailSectionTitle: { color: c.textPrimary, fontSize: 10, fontWeight: "900", textAlign: "right" }, detailNotice: { borderWidth: 1, borderColor: c.divider, borderRadius: 8, padding: 9 }, detailNoticeText: { color: c.textMuted, fontSize: 9, lineHeight: 16, textAlign: "right" }, detailLinks: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, detailLink: { borderWidth: 1, borderColor: c.divider, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7 }, detailLinkText: { color: c.textSecondary, fontSize: 8, fontWeight: "800" }, detailPrimaryAction: { minHeight: 40, borderRadius: 9, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }, detailPrimaryActionText: { color: c.onPrimary, fontSize: 10, fontWeight: "900" },
  errorBox: { borderWidth: 1, borderColor: c.error, borderRadius: 9, padding: 10, gap: 6 },
  error: { color: c.error, fontSize: 9, textAlign: "right" },
  link: { color: c.primary, fontSize: 9, fontWeight: "800", textAlign: "right" },
});
