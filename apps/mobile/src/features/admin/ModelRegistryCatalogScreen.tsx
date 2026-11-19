import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { AdminMobileBreadcrumb } from "./AdminMobileBreadcrumb";
import { MediaModelPricingAdminCard } from "./MediaModelPricingAdminCard";
import { MediaGenerationModelsAdminScreen } from "./MediaGenerationModelsAdminScreen";
import { ModelsAdminScreen } from "./AdminScreens";
import { RouteModelChainsCard, type ModelChoice } from "./RouteModelChainsCard";

type ServiceType = "chat" | "image" | "video" | "audio";
type OperationalState = "active" | "available" | "disabled" | "restricted" | "candidate" | "archived" | "unknown";
type CapabilityReviewStatus = "suggested" | "legacy_unreviewed" | "approved" | "rejected";
type DetailTab = "info" | "capabilities" | "pricing" | "routing" | "tests" | "history";
const DETAIL_TABS: Array<[DetailTab, string]> = [["info", "المعلومات"], ["capabilities", "القدرات"], ["pricing", "التكلفة"], ["routing", "التعيينات"], ["tests", "الاختبارات"], ["history", "السجل"]];
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
  review_status?: CapabilityReviewStatus | null;
  vendor_claim_status?: "unknown" | "supported" | "unsupported" | null;
  provider_test_status?: "not_tested" | "passed" | "failed" | null;
  suly_test_status?: "not_tested" | "passed" | "failed" | null;
  operational_state: OperationalState;
};
type ModelUsageTransaction = {
  id: string; user_id: string; request_id: string | null; event_type: string; amount: number;
  balance_delta: number; input_tokens: number; output_tokens: number; model_id: number | null;
  source: string; reason: string | null; created_at: string;
};
type ModelProbeLog = { run_type: string; status: string; duration_ms: number; error_code: string | null; checked_at: string; model_name: string; provider_name: string };
type MediaPriceSummary = { id: string; provider_id: number; service_type: "image" | "video" | "audio"; model_identifier: string; display_name: string; unit_type: "image" | "video_second" | "audio_minute"; provider_cost_egp_per_unit: number; selling_price_egp_per_unit: number; price_version: number; provider_tested: boolean; suly_integration_verified: boolean };
type ModelCompanyCost = {
  request_id: string; user_id: string | null; provider_cost_usd: number; cost_status: string;
  user_credits_charged: number; revenue_egp: number; provider_cost_egp: number;
  other_cost_egp: number; gross_profit_egp: number; price_version: string | null;
  created_at: string;
};
type CapabilityKey = string;
type StatusFilter = "all" | "active" | "available" | "restricted" | "disabled";

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
const REVIEW_LABEL: Record<CapabilityReviewStatus, string> = { approved: "معتمدة", suggested: "مقترحة", legacy_unreviewed: "تحتاج مراجعة", rejected: "مرفوضة" };
const STATUS_LABEL: Record<OperationalState, string> = {
  active: "فعال", available: "متاح", disabled: "معطّل", restricted: "مقيّد", candidate: "مرشح", archived: "مؤرشف", unknown: "غير معلوم",
};
const FILTER_LABEL: Record<StatusFilter, string> = {
  all: "الكل", active: "فعال", available: "متاح", restricted: "مقيّد", disabled: "معطّل",
};

function modelTestMessage(result: { status: "success" | "error"; duration_ms: number; error_code: string | null }): string {
  if (result.status === "success") return `نجح الاختبار · ${result.duration_ms}ms`;
  switch (result.error_code) {
    case "provider_disabled": return "لم يُرسل الطلب: المزود معطّل.";
    case "credential_unavailable": return "لم يُرسل الطلب: مفتاح المزود غير متاح.";
    case "model_timeout": return "انتهت مهلة النموذج قبل الرد.";
    case "empty_response": return "وصل الطلب، لكن المزود لم يُرجع نصًا.";
    case "provider_unreachable": return "تعذر الوصول إلى خادم المزود.";
    case "provider_url_invalid": return "عنوان المزود غير صالح.";
    default: return `فشل الاختبار · ${result.error_code ?? "provider_error"}`;
  }
}

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
  const { width } = useWindowDimensions();
  const columns = width >= 1180 ? 5 : width >= 900 ? 4 : width >= 620 ? 3 : 2;
  const tileWidth = `${(100 - (columns - 1) * 2.5) / columns}%`;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [testingModelId, setTestingModelId] = useState<number | null>(null);
  const [updatingModelId, setUpdatingModelId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, string>>({});
  const [usageTransactions, setUsageTransactions] = useState<ModelUsageTransaction[]>([]);
  const [companyCosts, setCompanyCosts] = useState<ModelCompanyCost[]>([]);
  const [probeLogs, setProbeLogs] = useState<ModelProbeLog[]>([]);
  const [mediaPriceRows, setMediaPriceRows] = useState<MediaPriceSummary[]>([]);
  const [mediaEditorOpen, setMediaEditorOpen] = useState(false);
  const [advancedManagementOpen, setAdvancedManagementOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<RegistryModel | null>(null);
  const [selectedDetailTab, setSelectedDetailTab] = useState<DetailTab>("info");
  const [rows, setRows] = useState<RegistryModel[]>([]);
  const [routingModels, setRoutingModels] = useState<ModelChoice[]>([]);
  const [pricesByModel, setPricesByModel] = useState<Map<number, { input: number; output: number }>>(new Map());
  const [chatOrderByModel, setChatOrderByModel] = useState<Map<number, number>>(new Map());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [capability, setCapability] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (preserveScreen = false) => {
    if (!preserveScreen) {
      setLoading(true);
      setError(null);
    }
    try {
      const [registry, providers, chat, media, health, priceRows, chatRoutes, mediaPrices, modelOverview] = await Promise.all([
        supabase.rpc("suly_admin_list_unified_model_capabilities"),
        supabase.rpc("suly_admin_list_providers"),
        supabase.from("ai_models").select("id,enabled,routing_group").limit(1000),
        supabase.from("suly_media_generation_models").select("id,is_active").limit(1000),
        supabase.from("ai_model_health").select("model_id,auto_restricted,last_status").limit(1000),
        adminService.getModelPriceVersions().catch(() => []),
        supabase.from("ai_route_model_assignments").select("model_id,priority").eq("route_role", "chat").eq("enabled", true).order("priority", { ascending: true }),
        adminService.getMediaModelPriceVersions().catch(() => []),
        adminService.getModelsOverview().catch(() => ({ models: [] })),
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
      const healthByModel = new Map<number, { restricted: boolean; lastStatus: string | null }>((health.data ?? []).map((item) => [Number(item.model_id), { restricted: item.auto_restricted === true, lastStatus: typeof item.last_status === "string" ? item.last_status : null }]));
      const normalizedRows: RegistryModel[] = ((registry.data ?? []) as Array<Omit<RegistryModel, "operational_state">>).map((raw) => {
        const provider = providerById.get(Number(raw.provider_id));
        const legacy = raw.legacy_chat_model_id !== null ? chatById.get(Number(raw.legacy_chat_model_id)) : undefined;
        let operational_state: OperationalState = "unknown";
        if (raw.lifecycle_state === "archived") operational_state = "archived";
        else if (!provider || provider.enabled === false) operational_state = "disabled";
        else if (raw.legacy_chat_model_id !== null) {
          if (legacy && !legacy.enabled || legacy?.routing_group === "disabled") operational_state = "disabled";
          else if (healthByModel.get(Number(raw.legacy_chat_model_id))?.restricted) operational_state = "restricted";
          else if (legacy && provider?.enabled && healthByModel.get(Number(raw.legacy_chat_model_id))?.lastStatus === "success") operational_state = "available";
          else if (legacy && provider?.enabled) operational_state = "active";
        } else if (raw.legacy_media_model_id) {
          const active = mediaById.get(String(raw.legacy_media_model_id));
          if (active === false) operational_state = "disabled";
          else if (active === true && provider?.enabled) operational_state = "active";
        } else if (raw.lifecycle_state === "candidate") operational_state = "candidate";
        return {
          ...raw,
          provider_name: provider?.name ?? raw.provider_name ?? null,
          provider_type: provider?.provider_type ?? null,
          provider_enabled: provider?.enabled === true,
          operational_state,
        };
      });
      // Disabled provider keys are absent from every registry view and filter.
      const visibleRows = normalizedRows.filter((model) => providerById.get(Number(model.provider_id))?.enabled === true);
      setRows(visibleRows.sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setRoutingModels((modelOverview.models ?? []) as ModelChoice[]);
      const priceMap = new Map<number, { input: number; output: number }>();
      for (const price of (priceRows ?? []) as Array<{ model_id: number; provider_input_cost_egp_per_million: number; provider_output_cost_egp_per_million: number }>) priceMap.set(Number(price.model_id), { input: Number(price.provider_input_cost_egp_per_million), output: Number(price.provider_output_cost_egp_per_million) });
      setPricesByModel(priceMap);
      setMediaPriceRows((mediaPrices ?? []) as MediaPriceSummary[]);
      const orderMap = new Map<number, number>();
      (chatRoutes.data ?? []).forEach((route, index) => orderMap.set(Number(route.model_id), index + 1));
      setChatOrderByModel(orderMap);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل كتالوج النماذج.");
    } finally {
      if (!preserveScreen) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const modelId = selectedModel?.legacy_chat_model_id;
    if (modelId == null) {
      setUsageTransactions([]);
      setCompanyCosts([]);
      setProbeLogs([]);
      setHistoryError(null);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    setHistoryError(null);
    void Promise.all([
      supabase.from("suly_credit_transactions")
        .select("id,user_id,request_id,event_type,amount,balance_delta,input_tokens,output_tokens,model_id,source,reason,created_at")
        .eq("model_id", modelId).eq("event_type", "settle")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("suly_company_cost_ledger")
        .select("request_id,user_id,provider_cost_usd,cost_status,user_credits_charged,revenue_egp,provider_cost_egp,other_cost_egp,gross_profit_egp,price_version,created_at")
        .eq("model_id", modelId).order("created_at", { ascending: false }).limit(100),
      adminService.getModelProbeLogs(modelId),
    ]).then(([transactions, costs, probes]) => {
      if (!active) return;
      if (transactions.error) throw transactions.error;
      if (costs.error) throw costs.error;
      setUsageTransactions((transactions.data ?? []) as ModelUsageTransaction[]);
      setCompanyCosts((costs.data ?? []) as ModelCompanyCost[]);
      setProbeLogs((probes ?? []) as ModelProbeLog[]);
    }).catch((cause) => {
      if (!active) return;
      setUsageTransactions([]);
      setCompanyCosts([]);
      setProbeLogs([]);
      setHistoryError(cause instanceof Error ? cause.message : "تعذر تحميل سجل الاستخدام والتكلفة.");
    }).finally(() => {
      if (active) setHistoryLoading(false);
    });
    return () => { active = false; };
  }, [selectedModel?.legacy_chat_model_id]);


  const capabilitiesByModel = useMemo(() => capabilityKeys(rows), [rows]);
  const capabilityReviewsByModel = useMemo(() => {
    const result = new Map<string, Map<string, CapabilityReviewStatus>>();
    for (const row of rows) if (row.capability_key) {
      const reviews = result.get(row.model_id) ?? new Map<string, CapabilityReviewStatus>();
      reviews.set(row.capability_key, row.review_status ?? "legacy_unreviewed");
      result.set(row.model_id, reviews);
    }
    return result;
  }, [rows]);
  const openOperationalRecord = (model: RegistryModel) => {
    if (!model.provider_enabled) {
      router.push("/admin/api-keys");
      return;
    }
    if (model.service_type !== "chat") {
      setSelectedModel(model);
      setSelectedDetailTab("pricing");
      return;
    }
    const q = encodeURIComponent(model.model_identifier);
    router.push(`/admin/models?q=${q}` as never);
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
  const mediaEvidenceRows = useMemo(() => rows.map((row) => ({
    provider_id: row.provider_id,
    service_type: row.service_type,
    model_identifier: row.model_identifier,
    capability_key: row.capability_key ?? "",
    vendor_claim_status: row.vendor_claim_status ?? "unknown",
    review_status: row.review_status ?? "legacy_unreviewed",
  })), [rows]);
  const usageTotals = useMemo(() => ({
    requests: usageTransactions.length,
    inputTokens: usageTransactions.reduce((sum, row) => sum + Number(row.input_tokens ?? 0), 0),
    outputTokens: usageTransactions.reduce((sum, row) => sum + Number(row.output_tokens ?? 0), 0),
    revenue: companyCosts.reduce((sum, row) => sum + Number(row.revenue_egp ?? 0), 0),
    providerCost: companyCosts.reduce((sum, row) => sum + Number(row.provider_cost_egp ?? 0), 0),
    profit: companyCosts.reduce((sum, row) => sum + Number(row.gross_profit_egp ?? 0), 0),
    estimated: companyCosts.filter((row) => row.cost_status === "estimated").length,
    confirmed: companyCosts.filter((row) => row.cost_status === "confirmed" || row.cost_status === "reconciled").length,
  }), [usageTransactions, companyCosts]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return models.filter((model) => {
      const matchesSearch = !q || `${model.display_name} ${model.model_identifier} ${model.provider_name ?? ""} ${model.service_type}`.toLocaleLowerCase().includes(q);
      const matchesStatus = status === "all" || model.operational_state === status || (status === "disabled" && model.operational_state === "archived");
      const matchesCapability = capability === "all" || [capability, ...(CAPABILITY_ALIASES[capability] ?? [])].some((key) => capabilitiesByModel.get(model.model_id)?.has(key) === true);
      return matchesSearch && matchesStatus && matchesCapability;
    });
  }, [models, search, status, capability, capabilitiesByModel]);

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" maintainVisibleContentPosition={{ minIndexForVisible: 0 }}>
    <AdminMobileBreadcrumb />
    <View style={styles.header}>
      <Text style={styles.eyebrow}>SULY · MODEL REGISTRY</Text>
      <Text style={styles.title}>نماذج التطبيق</Text>
      <Text style={styles.subtitle}>كل النماذج المسجلة في سجل التطبيق، بما فيها النص والصور والفيديو والصوت، مع حالة التشغيل واسم المزود/المفتاح المرتبط.</Text>
    </View>

    <RouteModelChainsCard models={routingModels} />
    <View style={styles.modelPageActions}><Pressable accessibilityRole="button" onPress={() => setMediaEditorOpen(true)} style={styles.detailLink}><Ionicons name="add-circle-outline" size={15} color={colors.primary}/><Text style={styles.detailLinkText}>إضافة / تعديل نموذج صور</Text></Pressable></View>
    <View style={styles.metrics}>
      <Text style={styles.metric}>الكل: {models.length}</Text>
      <Text style={styles.metric}>فعال: {models.filter((m) => m.operational_state === "active").length}</Text>
      <Text style={styles.metric}>متاح: {models.filter((m) => m.operational_state === "available").length}</Text>
      <Text style={styles.metric}>مقيّد: {models.filter((m) => m.operational_state === "restricted").length}</Text>
      <Text style={styles.metric}>معطّل: {models.filter((m) => m.operational_state === "disabled" || m.operational_state === "archived").length}</Text>
      <Text style={styles.metric}>قدرات معتمدة: {rows.filter((row) => row.capability_key && row.review_status === "approved").length}</Text>
      <Text style={styles.metric}>تحتاج مراجعة: {rows.filter((row) => row.capability_key && (row.review_status === "suggested" || row.review_status === "legacy_unreviewed")).length}</Text>
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
    {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(true)}><Text style={styles.link}>إعادة المحاولة</Text></Pressable></View> : null}
    {!loading ? <View style={styles.modelGrid}>
      {filtered.map((model) => <View key={model.model_id} style={[styles.modelTile, { width: tileWidth }]}>
        <View style={styles.modelTileTop}>
          <View style={styles.modelIcon}><Ionicons name={model.service_type === "image" ? "image-outline" : model.service_type === "video" ? "videocam-outline" : model.service_type === "audio" ? "volume-high-outline" : "hardware-chip-outline"} size={25} color={colors.primary}/></View>
          <View style={styles.modelTileStatusActions}>
            <View style={[styles.status, (model.operational_state === "active" || model.operational_state === "available") ? styles.statusActive : model.operational_state === "restricted" ? styles.statusRestricted : styles.statusDisabled]}><Text style={styles.statusText}>{STATUS_LABEL[model.operational_state]}</Text></View>
            {model.legacy_chat_model_id !== null && model.operational_state === "restricted" && model.provider_enabled && model.lifecycle_state === "active" ? <Pressable
              accessibilityRole="button"
              accessibilityLabel="فك قيد النموذج وتفعيله في مسار الشات"
              disabled={updatingModelId !== null}
              onPress={() => void (async () => {
                const modelId = Number(model.legacy_chat_model_id);
                setUpdatingModelId(modelId);
                try {
                  const result = await adminService.resetModelHealth(modelId);
                  if (result?.success !== true) throw new Error("لم تؤكد قاعدة البيانات فك القيد.");
                  await adminService.updateModel(modelId, { enabled: true, routing_group: "free_race" });
                  const assignments = await adminService.getRouteModelAssignments();
                  const chatIds = assignments.filter((item) => item.route_role === "chat" && item.enabled).map((item) => Number(item.model_id));
                  if (!chatIds.includes(modelId)) await adminService.saveRouteModelAssignments("chat", [...chatIds, modelId]);
                  setTestResults((current) => ({ ...current, [modelId]: "تم فك القيد وتفعيل النموذج وإضافته إلى نهاية أولوية الشات. اختبره للتأكد من استجابته." }));
                  await load(true);
                } catch (cause) {
                  setTestResults((current) => ({ ...current, [modelId]: cause instanceof Error ? cause.message : "تعذر فك القيد وتفعيل النموذج." }));
                  await load(true);
                } finally { setUpdatingModelId(null); }
              })()}
              style={styles.modelStateAction}
            ><Ionicons name="lock-open-outline" size={12} color={colors.primary}/><Text style={styles.modelStateActionText}>فك القيد وتفعيل</Text></Pressable> : null}
            {model.legacy_chat_model_id !== null && !model.provider_enabled && model.lifecycle_state === "active" ? <Pressable
              accessibilityRole="button"
              accessibilityLabel="إدارة مزود النموذج"
              onPress={() => router.push("/admin/api-keys")}
              style={styles.modelStateAction}
            ><Ionicons name="key-outline" size={12} color={colors.primary}/><Text style={styles.modelStateActionText}>إدارة المزود</Text></Pressable> : null}
            {model.legacy_chat_model_id !== null && model.operational_state === "disabled" && model.provider_enabled && model.lifecycle_state === "active" ? <Pressable
              accessibilityRole="button"
              accessibilityLabel="تفعيل النموذج وإضافته إلى أولوية الشات"
              disabled={updatingModelId !== null}
              onPress={() => void (async () => {
                const modelId = Number(model.legacy_chat_model_id);
                setUpdatingModelId(modelId);
                try {
                  await adminService.updateModel(modelId, { enabled: true, routing_group: "free_race" });
                  const assignments = await adminService.getRouteModelAssignments();
                  const chatIds = assignments.filter((item) => item.route_role === "chat" && item.enabled).map((item) => Number(item.model_id));
                  if (!chatIds.includes(modelId)) await adminService.saveRouteModelAssignments("chat", [...chatIds, modelId]);
                  setTestResults((current) => ({ ...current, [modelId]: "تم تفعيل النموذج وإضافته إلى نهاية أولوية الشات." }));
                  await load(true);
                } catch (cause) {
                  setTestResults((current) => ({ ...current, [modelId]: cause instanceof Error ? cause.message : "تعذر تفعيل النموذج." }));
                  await load(true);
                } finally { setUpdatingModelId(null); }
              })()}
              style={styles.modelStateAction}
            ><Ionicons name="power-outline" size={12} color={colors.primary}/><Text style={styles.modelStateActionText}>تفعيل</Text></Pressable> : null}
          </View>
        </View>
        <View style={styles.modelTileInfo}>
          <Text numberOfLines={2} style={styles.modelName}>{model.display_name}</Text>
          <Text numberOfLines={1} style={styles.meta}>{model.provider_name ?? `مزود #${model.provider_id}`} · {model.provider_type ?? model.service_type}</Text>
          <Text numberOfLines={1} style={styles.meta}>{model.model_identifier}</Text>
          {model.legacy_chat_model_id !== null && !model.provider_enabled ? <Text style={styles.error}>المزود معطّل؛ لن يُرسل الاختبار.</Text> : null}
        </View>
        <View style={styles.modelTileActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="عرض القدرات المسجلة" onPress={() => { setSelectedModel(model); setSelectedDetailTab("capabilities"); }} style={styles.tileAction}><Ionicons name="eye-outline" size={16} color={colors.primary}/><Text style={styles.tileActionLabel}>القدرات</Text></Pressable>
          {model.legacy_chat_model_id !== null ? <Pressable accessibilityRole="button" accessibilityLabel="اختبار النموذج" disabled={testingModelId !== null || updatingModelId !== null || !model.provider_enabled} onPress={() => void (async () => {
            const modelId = Number(model.legacy_chat_model_id); setTestingModelId(modelId);
            try {
              const result = await adminService.testModel(modelId);
              setTestResults((current) => ({ ...current, [modelId]: modelTestMessage(result) }));
              await load(true);
            } catch (cause) {
              setTestResults((current) => ({ ...current, [modelId]: cause instanceof Error ? cause.message : "تعذر تشغيل الاختبار." }));
            } finally { setTestingModelId(null); }
          })()} style={styles.tileAction}><Ionicons name={testingModelId === Number(model.legacy_chat_model_id) ? "hourglass-outline" : "flask-outline"} size={16} color={colors.primary}/><Text style={styles.tileActionLabel}>{testingModelId === Number(model.legacy_chat_model_id) ? "جارٍ" : "اختبار"}</Text></Pressable> : <View style={styles.tileActionDisabled}><Ionicons name="flask-outline" size={16} color={colors.textMuted}/><Text style={styles.tileActionLabel}>اختبار</Text></View>}
          <Pressable accessibilityRole="button" accessibilityLabel="السجل والتفاصيل" onPress={() => { setSelectedModel(model); setSelectedDetailTab("info");  }} style={styles.tileAction}><Ionicons name="document-text-outline" size={16} color={colors.textSecondary}/><Text style={styles.tileActionLabel}>تفاصيل</Text></Pressable>
        </View>
        {model.legacy_chat_model_id !== null && testResults[Number(model.legacy_chat_model_id)] ? <Text numberOfLines={2} style={testResults[Number(model.legacy_chat_model_id)].startsWith("نجح") || testResults[Number(model.legacy_chat_model_id)].startsWith("تم") ? styles.success : styles.error}>{testResults[Number(model.legacy_chat_model_id)]}</Text> : null}
      </View>)}
    </View> : null}
    {!loading && filtered.length === 0 ? <Text style={styles.empty}>لا توجد نماذج تطابق البحث والفلاتر.</Text> : null}
    <Modal visible={selectedModel !== null} transparent={false} animationType="slide" onRequestClose={() => setSelectedModel(null)}>
      <View style={styles.fullPageDetail}>
        <ScrollView style={styles.detailModal} contentContainerStyle={styles.detailModalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.detailModalHeader}>
            <View style={styles.detailModalCopy}>
              <View style={styles.detailModelIcon}><Ionicons name={selectedModel?.service_type === "image" ? "image-outline" : selectedModel?.service_type === "video" ? "videocam-outline" : selectedModel?.service_type === "audio" ? "volume-high-outline" : "hardware-chip-outline"} size={28} color={colors.primary}/></View>
              <Text style={styles.detailModalEyebrow}>MODEL DETAILS</Text>
              <Text style={styles.detailModalTitle}>{selectedModel?.display_name ?? "تفاصيل النموذج"}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={() => setSelectedModel(null)}><Ionicons name="close-circle-outline" size={23} color={colors.textMuted}/></Pressable>
          </View>
          {selectedModel ? <>
            <View style={styles.detailTabs}>
              {DETAIL_TABS.map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: selectedDetailTab === key }} onPress={() => setSelectedDetailTab(key)} style={[styles.detailTab, selectedDetailTab === key && styles.detailTabActive]}><Text style={[styles.detailTabText, selectedDetailTab === key && styles.detailTabTextActive]}>{label}</Text></Pressable>)}
            </View>
            {selectedDetailTab === "info" ? <>
              <View style={styles.detailMetaGrid}>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>المزود / اسم المفتاح</Text><Text style={styles.detailMetaValue}>{selectedModel.provider_name ?? `مزود #${selectedModel.provider_id}`} · {selectedModel.provider_type ?? "—"}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>نوع الخدمة</Text><Text style={styles.detailMetaValue}>{selectedModel.service_type}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>معرّف المزود</Text><Text selectable style={styles.detailMetaValue}>{selectedModel.model_identifier}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>دورة الحياة</Text><Text style={styles.detailMetaValue}>{selectedModel.lifecycle_state === "active" ? "مفعل في السجل" : selectedModel.lifecycle_state === "archived" ? "مؤرشف" : "مرشح"}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>حالة التشغيل</Text><Text style={styles.detailMetaValue}>{STATUS_LABEL[selectedModel.operational_state]}</Text></View>
              <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>حالة المزود</Text><Text style={styles.detailMetaValue}>{selectedModel.provider_enabled ? "مفعّل" : "معطّل أو غير متاح"}</Text></View>
            </View>
            {selectedModel.service_type === "image" ? <Pressable accessibilityRole="button" onPress={() => { setSelectedModel(null); setMediaEditorOpen(true); }} style={styles.detailLink}><Text style={styles.detailLinkText}>تعديل إعدادات نموذج الصور</Text></Pressable> : null}
            {selectedModel.legacy_chat_model_id !== null ? <Pressable accessibilityRole="button" onPress={() => { router.setParams({ q: selectedModel.model_identifier }); setSelectedModel(null); setAdvancedManagementOpen(true); }} style={styles.detailLink}><Text style={styles.detailLinkText}>إعدادات النموذج المتقدمة · القيود والتوجيه والصلاحيات</Text></Pressable> : null}
            </> : null}
            {selectedDetailTab === "capabilities" ? <>
              <Text style={styles.detailSectionTitle}>القدرات المسجلة وحالة اعتماد كل قدرة</Text>
              <View style={styles.capabilityLine}>
                {(CAPABILITIES.filter(([key]) => [key, ...(CAPABILITY_ALIASES[key] ?? [])].some((candidate) => capabilitiesByModel.get(selectedModel.model_id)?.has(candidate)))).map(([key, label, icon]) => {
                  const review = capabilityReviewsByModel.get(selectedModel.model_id)?.get(key) ?? (CAPABILITY_ALIASES[key] ?? []).map((alias) => capabilityReviewsByModel.get(selectedModel.model_id)?.get(alias)).find(Boolean) ?? "legacy_unreviewed";
                  const evidence = rows.find((row) => row.model_id === selectedModel.model_id && [key, ...(CAPABILITY_ALIASES[key] ?? [])].includes(row.capability_key ?? ""));
                  return <View key={key} style={[styles.capabilityBadge, review === "approved" ? styles.capabilityBadgeApproved : review === "rejected" ? styles.capabilityBadgeRejected : styles.capabilityBadgePending]}><Ionicons name={icon} size={13} color={colors.textSecondary}/><View style={styles.capabilityBadgeCopy}><Text style={styles.capabilityText}>{label}</Text><Text style={styles.capabilityReviewText}>{REVIEW_LABEL[review]} · دعم المزود: {evidence?.vendor_claim_status ?? "غير معروف"}</Text><Text style={styles.capabilityReviewText}>اختبار المزود: {evidence?.provider_test_status ?? "غير مختبر"} · SULY: {evidence?.suly_test_status ?? "غير مختبر"}</Text></View></View>;
                })}
                {!capabilitiesByModel.get(selectedModel.model_id)?.size ? <Text style={styles.meta}>لا توجد قدرات مسجلة لهذا النموذج.</Text> : null}
              </View>
              <Text style={styles.detailNoticeText}>القدرات المقترحة أو القديمة غير المعتمدة لا تُعرض كقدرات مؤكدة ولا ينبغي استخدامها في التوجيه قبل اعتمادها.</Text>
              <Text style={styles.detailNoticeText}>إضافة القدرة لا تعني أن النموذج يدعمها أو أنها مفعّلة. لا تعتمد أو تستخدم قبل إثبات دعم المزود ونجاح الاختبار.</Text>
            </> : null}
            {selectedDetailTab === "pricing" ? <>
              <Text style={styles.detailSectionTitle}>التكلفة المسجلة</Text>
              {selectedModel.legacy_chat_model_id !== null ? <>
                <View style={styles.priceLine}>
                  <View style={styles.priceCell}><Text style={styles.priceLabel}>تكلفة الإدخال / مليون</Text><Text style={styles.priceValue}>{pricesByModel.has(Number(selectedModel.legacy_chat_model_id)) ? `${pricesByModel.get(Number(selectedModel.legacy_chat_model_id))!.input.toLocaleString("en-EG")} ج.م` : "غير مسجلة"}</Text></View>
                  <View style={styles.priceCell}><Text style={styles.priceLabel}>تكلفة الإخراج / مليون</Text><Text style={styles.priceValue}>{pricesByModel.has(Number(selectedModel.legacy_chat_model_id)) ? `${pricesByModel.get(Number(selectedModel.legacy_chat_model_id))!.output.toLocaleString("en-EG")} ج.م` : "غير مسجلة"}</Text></View>
                </View>
                <Pressable accessibilityRole="button" onPress={() => { const model = selectedModel; setSelectedModel(null); openModelPriceHistory(model); }} style={styles.detailLink}><Text style={styles.detailLinkText}>فتح سجل الأسعار</Text></Pressable>
              </> : <MediaModelPricingAdminCard serviceType={selectedModel.service_type as "image" | "video" | "audio"} initialRows={mediaPriceRows} initialEvidence={mediaEvidenceRows} initialLoading={loading} skipInitialLoad />}
            </> : null}
            {selectedDetailTab === "routing" ? <>
              <Text style={styles.detailSectionTitle}>التعيينات وترتيب التوجيه</Text>
              <Text style={styles.detailMetaValue}>{selectedModel.legacy_chat_model_id !== null && chatOrderByModel.has(Number(selectedModel.legacy_chat_model_id)) ? `ترتيب الشات الحالي: #${chatOrderByModel.get(Number(selectedModel.legacy_chat_model_id))}` : "لا يوجد تعيين شات مؤكد لهذا السجل."}</Text>
              <Text style={styles.meta}>لا يتم تفعيل النموذج أو تغيير أولوية التوجيه من بطاقة الكتالوج.</Text>
              <Pressable accessibilityRole="button" onPress={() => { setSelectedModel(null); router.push("/admin/agents"); }} style={styles.detailLink}><Text style={styles.detailLinkText}>فتح إعدادات التوجيه والتعيينات</Text></Pressable>
            </> : null}
            {selectedDetailTab === "tests" ? <>
              <Text style={styles.detailSectionTitle}>سجل اختبارات الاتصال والقدرات</Text>
              {rows.filter((row) => row.model_id === selectedModel.model_id && row.capability_key).map((row) => <View key={row.capability_key} style={styles.detailMetaCell}>
                <Text style={styles.detailMetaLabel}>{CAPABILITIES.find(([key]) => key === row.capability_key)?.[1] ?? row.capability_key}</Text>
                <Text style={styles.detailMetaValue}>دعم المزود: {row.vendor_claim_status ?? "غير معروف"} · اختبار المزود: {row.provider_test_status ?? "غير مختبر"} · SULY: {row.suly_test_status ?? "غير مختبر"}</Text>
              </View>)}
              {probeLogs.map((log, index) => <View key={`${log.checked_at}-${index}`} style={styles.historyRow}>
                <Text style={styles.detailMetaLabel}>{new Date(log.checked_at).toLocaleString("ar-EG")} · {log.run_type === "manual" ? "يدوي" : "دوري"}</Text>
                <Text style={styles.detailMetaValue}>{log.status === "success" ? "ناجح" : log.status === "skipped" ? "تخطّي" : "فشل"} · {log.duration_ms}ms</Text>
                {log.error_code ? <Text style={styles.meta}>{log.error_code}</Text> : null}
              </View>)}
              {!probeLogs.length && !rows.some((row) => row.model_id === selectedModel.model_id && row.capability_key) ? <Text style={styles.meta}>لا توجد نتائج اختبار مسجلة لهذا النموذج.</Text> : null}
            </> : null}
            {selectedDetailTab === "history" ? <>
              <Text style={styles.detailSectionTitle}>سجل الاستخدام والتكلفة لهذا النموذج</Text>
              {selectedModel.legacy_chat_model_id === null ? <Text style={styles.meta}>سجل العمليات التفصيلي لهذا النوع غير متاح في سجل المحادثات الحالي.</Text> : <>
                <View style={styles.detailMetaGrid}>
                  <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>طلبات التسوية</Text><Text style={styles.detailMetaValue}>{usageTotals.requests}</Text></View>
                  <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>Input Tokens</Text><Text style={styles.detailMetaValue}>{usageTotals.inputTokens.toLocaleString("en-EG")}</Text></View>
                  <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>Output Tokens</Text><Text style={styles.detailMetaValue}>{usageTotals.outputTokens.toLocaleString("en-EG")}</Text></View>
                  <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>الإيراد المسجل</Text><Text style={styles.detailMetaValue}>{usageTotals.revenue.toLocaleString("en-EG", { maximumFractionDigits: 4 })} ج.م</Text></View>
                  <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>تكلفة المزود المسجلة</Text><Text style={styles.detailMetaValue}>{usageTotals.providerCost.toLocaleString("en-EG", { maximumFractionDigits: 4 })} ج.م</Text></View>
                  <View style={styles.detailMetaCell}><Text style={styles.detailMetaLabel}>صافي المساهمة المسجل</Text><Text style={styles.detailMetaValue}>{usageTotals.profit.toLocaleString("en-EG", { maximumFractionDigits: 4 })} ج.م</Text></View>
                </View>
                <Text style={styles.meta}>بيانات التكلفة: {usageTotals.confirmed} مؤكدة/مسوّاة · {usageTotals.estimated} تقديرية. القيم المالية مأخوذة من سجل تكلفة الشركة، ولا تُستنتج من أسعار التوكن وحدها.</Text>
                {historyLoading ? <ActivityIndicator color={colors.primary}/> : null}
                {historyError ? <Text style={styles.error}>{historyError}</Text> : null}
                {usageTransactions.map((transaction) => {
                  const cost = companyCosts.find((row) => row.request_id === transaction.request_id);
                  return <View key={transaction.id} style={styles.historyRow}>
                    <Text style={styles.detailMetaLabel}>{new Date(transaction.created_at).toLocaleString("ar-EG")}</Text>
                    <Text style={styles.detailMetaValue}>المستخدم: {transaction.user_id.slice(0, 8)}… · Tokens: {Number(transaction.input_tokens ?? 0).toLocaleString("en-EG")} إدخال + {Number(transaction.output_tokens ?? 0).toLocaleString("en-EG")} إخراج</Text>
                    <Text style={styles.meta}>خصم المستخدم: {cost ? Number(cost.user_credits_charged).toLocaleString("en-EG") + " Credits" : Number(transaction.amount).toLocaleString("en-EG") + " Credits"}</Text>
                    <Text style={styles.meta}>تكلفة المزود: {cost ? Number(cost.provider_cost_egp).toLocaleString("en-EG", { maximumFractionDigits: 4 }) + " ج.م · " + cost.cost_status : "لا توجد مطابقة في سجل تكلفة الشركة"}</Text>
                    <Text style={styles.meta}>الربح المسجل: {cost ? Number(cost.gross_profit_egp).toLocaleString("en-EG", { maximumFractionDigits: 4 }) + " ج.م" : "غير متاح"} · الطلب: {transaction.request_id ? transaction.request_id.slice(0, 12) + "…" : "بدون معرّف"}</Text>
                  </View>;
                })}
                {!historyLoading && usageTransactions.length === 0 ? <Text style={styles.meta}>لا توجد عمليات تسوية مسجلة لهذا النموذج.</Text> : null}
              </>}
            </> : null}
            <Pressable accessibilityRole="button" onPress={() => { const model = selectedModel; setSelectedModel(null); openOperationalRecord(model); }} style={styles.detailPrimaryAction}><Text style={styles.detailPrimaryActionText}>{selectedModel.provider_enabled ? "فتح شاشة إدارة النموذج" : "فتح إدارة المزود"}</Text></Pressable>
          </> : null}
        </ScrollView>
      </View>
    </Modal>
    <Modal visible={advancedManagementOpen} transparent={false} animationType="slide" onRequestClose={() => { setAdvancedManagementOpen(false); router.setParams({ q: "" }); }}>
      <View style={styles.fullPageDetail}>
        <View style={styles.detailModalHeader}>
          <Text style={styles.detailModalTitle}>إعدادات النموذج المتقدمة</Text>
          <Pressable accessibilityRole="button" onPress={() => { setAdvancedManagementOpen(false); router.setParams({ q: "" }); }}>
            <Ionicons name="close-circle-outline" size={24} color={colors.textMuted}/>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>{advancedManagementOpen ? <ModelsAdminScreen showPricing={false}/> : null}</View>
      </View>
    </Modal>
    <Modal visible={mediaEditorOpen} transparent={false} animationType="slide" onRequestClose={() => setMediaEditorOpen(false)}>
      <View style={styles.fullPageDetail}>
        <View style={styles.detailModalHeader}><Text style={styles.detailModalTitle}>إدارة نماذج الصور</Text><Pressable accessibilityRole="button" onPress={() => { setMediaEditorOpen(false); void load(true); }}><Ionicons name="close-circle-outline" size={24} color={colors.textMuted}/></Pressable></View>
        <View style={{ flex: 1 }}>{mediaEditorOpen ? <MediaGenerationModelsAdminScreen /> : null}</View>
      </View>
    </Modal>
  </ScrollView>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  fullPageDetail: { flex: 1, backgroundColor: c.background, padding: 14, paddingTop: 28 },
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
  modelPageActions: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
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
  modelGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  modelTile: { borderWidth: 1, borderColor: c.divider, borderRadius: 14, backgroundColor: c.surface, padding: 10, aspectRatio: 0.9, justifyContent: "space-between", gap: 7 },
  modelTileTop: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 6 },
  modelTileStatusActions: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", flexWrap: "wrap", gap: 5 },
  modelStateAction: { minHeight: 25, flexDirection: "row-reverse", alignItems: "center", gap: 3, borderWidth: 1, borderColor: c.primary + "70", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  modelStateActionText: { color: c.primary, fontSize: 7, fontWeight: "900" },
  modelTileInfo: { alignItems: "flex-end", gap: 4, flex: 1, justifyContent: "center" },
  modelTileActions: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-around", gap: 4, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 5 },
  tileAction: { minWidth: 42, height: 38, borderWidth: 1, borderColor: c.divider, borderRadius: 9, alignItems: "center", justifyContent: "center", gap: 1, paddingHorizontal: 4 },
  tileActionDisabled: { minWidth: 42, height: 38, borderWidth: 1, borderColor: c.divider, borderRadius: 9, alignItems: "center", justifyContent: "center", gap: 1, paddingHorizontal: 4, opacity: 0.4 },
  tileActionLabel: { color: c.textSecondary, fontSize: 7, fontWeight: "800" },
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
  capabilityBadgeApproved: { borderColor: c.success, backgroundColor: c.success + "10" },
  capabilityBadgePending: { borderColor: c.warning, backgroundColor: c.warning + "08" },
  capabilityBadgeRejected: { borderColor: c.error, backgroundColor: c.error + "08" },
  capabilityBadgeCopy: { gap: 2, alignItems: "flex-end" },
  capabilityText: { color: c.textSecondary, fontSize: 7, fontWeight: "800" },
  capabilityReviewText: { color: c.textMuted, fontSize: 6 },
  empty: { color: c.textMuted, fontSize: 10, textAlign: "center", padding: 20 },
  detailModal: { flex: 1, width: "100%", maxWidth: 900, alignSelf: "center", borderWidth: 1, borderColor: c.divider, borderRadius: 14, backgroundColor: c.surface },
  detailModalContent: { padding: 15, gap: 11, paddingBottom: 28 },
  detailModelIcon: { width: 58, height: 58, borderRadius: 16, backgroundColor: c.primary + "14", borderWidth: 1, borderColor: c.divider, alignItems: "center", justifyContent: "center" },
  detailModalHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 }, detailModalCopy: { flex: 1, alignItems: "flex-end", gap: 3 }, detailModalEyebrow: { color: c.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1 }, detailModalTitle: { color: c.textPrimary, fontSize: 17, fontWeight: "900", textAlign: "right" },
  historyRow: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, padding: 10, gap: 5, backgroundColor: c.surfaceElevated },
  detailMetaGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }, detailMetaCell: { flexBasis: "48%", flexGrow: 1, minWidth: 120, backgroundColor: c.surfaceElevated, borderRadius: 8, padding: 9, gap: 4 }, detailMetaLabel: { color: c.textMuted, fontSize: 8, textAlign: "right" }, detailMetaValue: { color: c.textPrimary, fontSize: 9, fontWeight: "700", textAlign: "right" },
  detailTabs: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 5, borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: 8 },
  detailTab: { borderWidth: 1, borderColor: c.divider, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  detailTabActive: { borderColor: c.primary, backgroundColor: c.primary + "16" },
  detailTabText: { color: c.textMuted, fontSize: 8, fontWeight: "800" }, detailTabTextActive: { color: c.primary },
  capabilityHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  detailSectionTitle: { color: c.textPrimary, fontSize: 10, fontWeight: "900", textAlign: "right" }, detailNotice: { borderWidth: 1, borderColor: c.divider, borderRadius: 8, padding: 9 }, detailNoticeText: { color: c.textMuted, fontSize: 9, lineHeight: 16, textAlign: "right" }, detailLinks: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, detailLink: { borderWidth: 1, borderColor: c.divider, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7 }, detailLinkText: { color: c.textSecondary, fontSize: 8, fontWeight: "800" }, detailPrimaryAction: { minHeight: 40, borderRadius: 9, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }, detailPrimaryActionText: { color: c.onPrimary, fontSize: 10, fontWeight: "900" },
  errorBox: { borderWidth: 1, borderColor: c.error, borderRadius: 9, padding: 10, gap: 6 },
  success: { color: c.success, fontSize: 9, fontWeight: "800", textAlign: "right" },
  error: { color: c.error, fontSize: 9, textAlign: "right" },
  link: { color: c.primary, fontSize: 9, fontWeight: "800", textAlign: "right" },
});
