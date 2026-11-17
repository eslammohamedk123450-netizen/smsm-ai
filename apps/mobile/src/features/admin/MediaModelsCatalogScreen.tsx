import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { AdminMobileBreadcrumb } from "./AdminMobileBreadcrumb";
import { supabase } from "../../lib/supabase/client";
import { adminService } from "./admin-service";
import { MediaModelPricingAdminCard } from "./MediaModelPricingAdminCard";

type Kind = "image" | "video" | "transcription" | "voice";
type ServiceType = "image" | "video" | "audio";
type MediaModelRow = {
  id: string; provider_id: number; provider_name: string; provider_type: string; service_type: ServiceType;
  model_identifier: string; display_name: string; unit_type: "image" | "video_second" | "audio_minute";
  provider_cost_egp_per_unit: number; selling_price_egp_per_unit: number;
  price_version: number; provider_tested: boolean; suly_integration_verified: boolean;
};
type CapabilityEvidence = {
  provider_id: number; service_type: ServiceType; model_identifier: string; capability_key: string;
  vendor_claim_status: "unknown" | "supported" | "unsupported";
  provider_test_status: "not_tested" | "passed" | "failed";
  suly_test_status: "not_tested" | "passed" | "failed";
  vendor_evidence_url: string | null; provider_evidence_url: string | null; suly_evidence_url: string | null;
  notes: string | null; review_status: "suggested" | "legacy_unreviewed" | "approved" | "rejected";
};
const TITLES: Record<Kind, string> = {
  image: "نماذج الصور",
  video: "نماذج الفيديو",
  transcription: "نماذج تفريغ الصوت",
  voice: "نماذج توليد الصوت",
};
const SERVICE_FOR: Record<Kind, ServiceType> = { image: "image", video: "video", transcription: "audio", voice: "audio" };
const CAPABILITY_FOR: Partial<Record<Kind, string>> = { transcription: "transcription", voice: "audio_output" };
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  text: "text-outline", image_generation: "image-outline", vision: "eye-outline",
  video_generation: "videocam-outline", video_input: "film-outline",
  audio_input: "mic-outline", audio_output: "volume-high-outline", transcription: "document-text-outline",
};
const LABELS: Record<string, string> = {
  text: "إدخال نص", image_generation: "توليد الصور", vision: "فهم الصور",
  video_generation: "توليد الفيديو", video_input: "فهم الفيديو",
  audio_input: "إدخال الصوت", audio_output: "توليد الصوت", transcription: "تفريغ الصوت",
};
const STATUS_LABEL: Record<string, string> = { supported: "موثق لدى المزود", unsupported: "غير مدعوم", unknown: "غير محسوم" };
const TEST_LABEL: Record<string, string> = { passed: "ناجح", failed: "فاشل", not_tested: "لم يُختبر" };
const money = (value: number, unit: string) => `${Number(value).toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ج.م / ${unit}`;

export function MediaModelsCatalogScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ kind?: string; q?: string }>();
  const kind: Kind = params.kind === "video" || params.kind === "transcription" || params.kind === "voice" ? params.kind : "image";
  const [rows, setRows] = useState<MediaModelRow[]>([]);
  const [evidence, setEvidence] = useState<CapabilityEvidence[]>([]);
  const [search, setSearch] = useState(typeof params.q === "string" ? params.q : "");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [selected, setSelected] = useState<{ row: MediaModelRow; capability: CapabilityEvidence } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [priceRows, evidenceResult] = await Promise.all([
        adminService.getMediaModelPriceVersions(),
        supabase.rpc("suly_admin_list_unified_model_capabilities"),
      ]);
      if (evidenceResult.error) throw evidenceResult.error;
      setRows((priceRows ?? []) as MediaModelRow[]);
      setEvidence((evidenceResult.data ?? []) as CapabilityEvidence[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل كتالوج نماذج الوسائط.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelected(null); setSearch(typeof params.q === "string" ? params.q : ""); }, [kind, params.q]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (row.service_type !== SERVICE_FOR[kind]) return false;
      if (kind === "transcription" || kind === "voice") {
        const required = CAPABILITY_FOR[kind]!;
        const proof = evidence.some((item) => item.provider_id === row.provider_id
          && item.service_type === row.service_type && item.model_identifier === row.model_identifier
          && item.capability_key === required && item.vendor_claim_status === "supported" && item.review_status === "approved");
        if (!proof) return false;
      }
      return !query || `${row.display_name} ${row.model_identifier} ${row.provider_name} ${row.provider_type}`.toLocaleLowerCase().includes(query);
    });
  }, [rows, evidence, kind, search]);

  const getCapabilities = (row: MediaModelRow) => evidence.filter((item) =>
    item.provider_id === row.provider_id && item.service_type === row.service_type
    && item.model_identifier === row.model_identifier && item.vendor_claim_status === "supported" && item.review_status === "approved");

  const unitLabel = (row: MediaModelRow) => row.unit_type === "image" ? "صورة" : row.unit_type === "video_second" ? "ثانية فيديو" : row.unit_type === "audio_minute" ? "دقيقة صوت" : row.unit_type;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <AdminMobileBreadcrumb />
    <View style={styles.header}>
      <Link href="/admin" asChild><Pressable><Text style={styles.link}>‹ لوحة المشرف</Text></Pressable></Link>
      <View style={styles.headerCopy}><Text style={styles.title}>{TITLES[kind]}</Text><Text style={styles.subtitle}>كتالوج موحد · الأسعار الفعلية المسجلة · القدرات الموثقة</Text></View>
    </View>
    <View style={styles.tabs}>
      {(["image", "video", "transcription", "voice"] as Kind[]).map((item) => <Link key={item} href={`/admin/media-catalog?kind=${item}`} asChild><Pressable style={StyleSheet.flatten([styles.tab, item === kind && styles.tabActive])}><Text style={[styles.tabText, item === kind && styles.tabTextActive]}>{TITLES[item]}</Text></Pressable></Link>)}
    </View>
    <TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم النموذج أو المزود أو المعرّف" placeholderTextColor={colors.textMuted} style={styles.search} />
    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()} style={styles.retryButton}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View> : null}
    {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.count}>{visibleRows.length} نموذج ضمن هذا القسم</Text>}
    <View style={styles.viewControls}>
      <Text style={styles.count}>طريقة العرض</Text>
      <Pressable onPress={() => setViewMode("table")} style={[styles.viewButton, viewMode === "table" && styles.viewButtonActive]}><Text style={[styles.viewButtonText, viewMode === "table" && styles.viewButtonTextActive]}>جدول</Text></Pressable>
      <Pressable onPress={() => setViewMode("cards")} style={[styles.viewButton, viewMode === "cards" && styles.viewButtonActive]}><Text style={[styles.viewButtonText, viewMode === "cards" && styles.viewButtonTextActive]}>بطاقات</Text></Pressable>
    </View>
    {viewMode === "table" ? <>
    <View style={styles.tableHeader}>
      <Text style={[styles.headerCell, styles.nameCell]}>النموذج · المزود · اسم المفتاح</Text>
      <Text style={[styles.headerCell, styles.capCell]}>القدرات</Text>
      <Text style={[styles.headerCell, styles.priceCell]}>تكلفة المزود / سعر البيع</Text>
      <Text style={[styles.headerCell, styles.statusCell]}>التحقق</Text>
    </View>
    {visibleRows.map((row) => {
      const caps = getCapabilities(row);
      return <View key={row.id} style={styles.row}>
        <View style={styles.nameCell}>
          <Text style={styles.modelName}>{row.display_name}</Text>
          <Text style={styles.meta}>المزود: {row.provider_type} · اسم المفتاح: {row.provider_name}</Text>
          <Text style={styles.meta} selectable>{row.model_identifier}</Text>
        </View>
        <View style={styles.capCell}>
          {caps.map((cap) => <Pressable key={cap.capability_key} onPress={() => setSelected({ row, capability: cap })} accessibilityRole="button" accessibilityLabel={LABELS[cap.capability_key] ?? cap.capability_key} style={styles.capButton}>
            <Ionicons name={ICONS[cap.capability_key] ?? "checkmark-circle-outline"} size={17} color={cap.suly_test_status === "passed" ? colors.success : cap.provider_test_status === "passed" ? colors.primary : colors.textMuted} />
          </Pressable>)}
          {caps.length === 0 ? <Text style={styles.meta}>—</Text> : null}
        </View>
        <View style={styles.priceCell}>
          <Text style={styles.priceText}>{money(row.provider_cost_egp_per_unit, unitLabel(row))}</Text>
          <Text style={styles.meta}>بيع: {money(row.selling_price_egp_per_unit, unitLabel(row))}</Text>
          <Text style={styles.meta}>إصدار {row.price_version}</Text>
        </View>
        <View style={styles.statusCell}>
          <Text style={row.provider_tested ? styles.good : styles.pending}>المزود: {row.provider_tested ? "اختُبر" : "غير مختبر"}</Text>
          <Text style={row.suly_integration_verified ? styles.good : styles.pending}>SULY: {row.suly_integration_verified ? "متحقق" : "غير متحقق"}</Text>
        </View>
      </View>;
    })}
    </> : <View style={styles.cardsList}>
      {visibleRows.map((row) => {
        const caps = getCapabilities(row);
        return <View key={row.id} style={styles.modelCard}>
          <View style={styles.cardHeading}>
            <Text style={styles.modelName}>{row.display_name}</Text>
            <Text style={styles.meta}>{row.provider_name} · {row.provider_type}</Text>
          </View>
          <Text style={styles.meta}>اسم المفتاح: {row.provider_name}</Text>
          <Text style={styles.modelId} selectable>{row.model_identifier}</Text>
          <Text style={styles.cardSectionTitle}>القدرات الموثقة</Text>
          <View style={styles.cardCapabilities}>
            {caps.map((cap) => <Pressable key={cap.capability_key} onPress={() => setSelected({ row, capability: cap })} style={styles.capButton}>
              <Ionicons name={ICONS[cap.capability_key] ?? "checkmark-circle-outline"} size={17} color={cap.suly_test_status === "passed" ? colors.success : cap.provider_test_status === "passed" ? colors.primary : colors.textMuted} />
              <Text style={styles.capLabel}>{LABELS[cap.capability_key] ?? cap.capability_key}</Text>
            </Pressable>)}
            {caps.length === 0 ? <Text style={styles.meta}>لا توجد قدرات موثقة لهذا النموذج.</Text> : null}
          </View>
          <View style={styles.cardPrices}>
            <View style={styles.cardPriceCell}>
              <Text style={styles.meta}>التكلفة الحقيقية</Text>
              <Text style={styles.priceText}>{money(row.provider_cost_egp_per_unit, unitLabel(row))}</Text>
            </View>
            <View style={styles.cardPriceCell}>
              <Text style={styles.meta}>سعر البيع</Text>
              <Text style={styles.priceText}>{money(row.selling_price_egp_per_unit, unitLabel(row))}</Text>
            </View>
          </View>
          <View style={styles.statusCell}>
            <Text style={row.provider_tested ? styles.good : styles.pending}>المزود: {row.provider_tested ? "اختُبر" : "غير مختبر"}</Text>
            <Text style={row.suly_integration_verified ? styles.good : styles.pending}>SULY: {row.suly_integration_verified ? "متحقق" : "غير متحقق"}</Text>
          </View>
        </View>;
      })}
    </View>}
    {!loading && visibleRows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>{kind === "transcription" || kind === "voice" ? "لا توجد نماذج لديها قدرة موثقة رسميًا لهذا الاستخدام بعد. لم نعرض نماذج غير مثبتة على أنها تدعم هذه الوظيفة." : "لا توجد نماذج مسجلة في هذا القسم حاليًا."}</Text></View> : null}
    {selected ? <View style={styles.detail}>
      <View style={styles.detailHeader}><Text style={styles.detailTitle}>{LABELS[selected.capability.capability_key] ?? selected.capability.capability_key} · {selected.row.display_name}</Text><Pressable onPress={() => setSelected(null)}><Ionicons name="close-circle-outline" size={21} color={colors.textMuted} /></Pressable></View>
      <Text style={styles.meta}>ادعاء المزود: {STATUS_LABEL[selected.capability.vendor_claim_status]}</Text>
      <Text style={styles.meta}>اختبار المزود: {TEST_LABEL[selected.capability.provider_test_status]}</Text>
      <Text style={styles.meta}>اختبار تكامل SULY: {TEST_LABEL[selected.capability.suly_test_status]}</Text>
      {selected.capability.notes ? <Text style={styles.meta}>ملاحظات: {selected.capability.notes}</Text> : null}
      {selected.capability.vendor_evidence_url ? <Text selectable style={styles.meta}>وثائق: {selected.capability.vendor_evidence_url}</Text> : null}
    </View> : null}
    <MediaModelPricingAdminCard serviceType={SERVICE_FOR[kind]} capabilityKey={CAPABILITY_FOR[kind] as "transcription" | "audio_output" | undefined} initialRows={rows} initialEvidence={evidence} initialLoading={loading} skipInitialLoad />
    <Link href="/admin/models" asChild><Pressable><Text style={styles.link}>مراجعة واعتماد كل قدرات النماذج من المركز الموحد</Text></Pressable></Link>
    <View style={styles.footerLinks}>
      <Link href="/admin/api-keys" asChild><Pressable><Text style={styles.link}>إدارة المزودين ومفاتيح API</Text></Pressable></Link>
      {kind === "image" ? <Link href="/admin/image-generation" asChild><Pressable><Text style={styles.link}>إضافة / تعديل نموذج صور</Text></Pressable></Link> : null}
    </View>
    <Text style={styles.footnote}>الأسعار المعروضة هي القيم المسجلة في قاعدة البيانات. لا يتم افتراض دعم قدرة من اسم النموذج وحده، ولا يتم تفعيل نموذج أو تغيير فوترة المستخدم من هذه الصفحة.</Text>
  </ScrollView>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, content: { padding: 14, gap: 10, maxWidth: 1200, width: "100%", alignSelf: "center" }, errorBox: { borderWidth: 1, borderColor: c.error, borderRadius: 8, padding: 10, gap: 8 }, errorText: { color: c.error, fontSize: 10, textAlign: "right" }, retryButton: { alignSelf: "flex-end", borderWidth: 1, borderColor: c.divider, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7 }, retryText: { color: c.primary, fontSize: 10, fontWeight: "800" },
  header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 }, headerCopy: { flex: 1, alignItems: "flex-end", gap: 3 },
  title: { color: c.textPrimary, fontSize: 19, fontWeight: "900", textAlign: "right" }, subtitle: { color: c.textMuted, fontSize: 9, textAlign: "right" }, link: { color: c.primary, fontSize: 10, fontWeight: "800" },
  tabs: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, tab: { borderWidth: 1, borderColor: c.divider, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8 }, tabActive: { borderColor: c.primary, backgroundColor: c.surfaceElevated }, tabText: { color: c.textSecondary, fontSize: 9 }, tabTextActive: { color: c.primary, fontWeight: "800" },
  search: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.divider, borderRadius: 8, color: c.textPrimary, padding: 10, textAlign: "right", fontSize: 11 }, count: { color: c.textMuted, fontSize: 9, textAlign: "right" },
  viewControls: { flexDirection: "row-reverse", alignItems: "center", gap: 7 }, viewButton: { borderWidth: 1, borderColor: c.divider, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7 }, viewButtonActive: { borderColor: c.primary, backgroundColor: c.surfaceElevated }, viewButtonText: { color: c.textSecondary, fontSize: 9 }, viewButtonTextActive: { color: c.primary, fontWeight: "800" },
  cardsList: { gap: 8 }, modelCard: { borderWidth: 1, borderColor: c.divider, borderRadius: 10, backgroundColor: c.surface, padding: 12, gap: 8 }, cardHeading: { alignItems: "flex-end", gap: 3 }, modelId: { color: c.textMuted, fontSize: 9, textAlign: "left" }, cardSectionTitle: { color: c.textSecondary, fontSize: 9, fontWeight: "800", textAlign: "right" }, cardCapabilities: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, capLabel: { color: c.textSecondary, fontSize: 8 }, cardPrices: { flexDirection: "row-reverse", gap: 8 }, cardPriceCell: { flex: 1, borderWidth: 1, borderColor: c.divider, borderRadius: 8, padding: 8, gap: 4, alignItems: "center" },
  tableHeader: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.divider, borderRadius: 8, paddingVertical: 8 },
  headerCell: { color: c.textSecondary, fontSize: 8, fontWeight: "800", textAlign: "center" }, nameCell: { width: 225, paddingHorizontal: 7, alignItems: "flex-end" }, capCell: { width: 120, flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 4, paddingHorizontal: 4 }, priceCell: { width: 150, alignItems: "center", gap: 3, paddingHorizontal: 5 }, statusCell: { width: 125, alignItems: "flex-end", gap: 4, paddingHorizontal: 7 },
  row: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.divider, borderRadius: 8, paddingVertical: 9, marginTop: 5, minHeight: 76 },
  modelName: { color: c.textPrimary, fontSize: 10, fontWeight: "900", textAlign: "right" }, meta: { color: c.textMuted, fontSize: 8, textAlign: "right" }, capButton: { width: 26, height: 26, borderWidth: 1, borderColor: c.divider, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  priceText: { color: c.textPrimary, fontSize: 9, fontWeight: "800", textAlign: "center" }, good: { color: c.success, fontSize: 8, textAlign: "right" }, pending: { color: c.textMuted, fontSize: 8, textAlign: "right" },
  empty: { padding: 18, borderWidth: 1, borderColor: c.divider, borderRadius: 9, backgroundColor: c.surface }, emptyText: { color: c.textMuted, textAlign: "right", fontSize: 10 },
  detail: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, backgroundColor: c.surface, padding: 12, gap: 6 }, detailHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }, detailTitle: { color: c.textPrimary, fontSize: 11, fontWeight: "900", textAlign: "right", flex: 1 },
  footerLinks: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }, footnote: { color: c.textMuted, fontSize: 8, lineHeight: 14, textAlign: "right" },
});
