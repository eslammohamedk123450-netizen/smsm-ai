import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { adminService } from "./admin-service";

type MediaPriceRow = {
  id: string;
  provider_id: number;
  service_type: "image" | "video" | "audio";
  model_identifier: string;
  display_name: string;
  unit_type: "image" | "video_second" | "audio_minute";
  provider_cost_egp_per_unit: number;
  selling_price_egp_per_unit: number;
  price_version: number;
  provider_tested: boolean;
  suly_integration_verified: boolean;
};

const money = (value: number) => Number(value).toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const serviceLabel: Record<MediaPriceRow["service_type"], string> = { image: "صورة", video: "ثانية فيديو", audio: "دقيقة صوت" };

export function MediaModelPricingAdminCard() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<MediaPriceRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cost, setCost] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.getMediaModelPriceVersions() as MediaPriceRow[];
      setRows(result);
    } catch {
      setError("تعذر تحميل أسعار خدمات الوسائط.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter((row) => !query || `${row.display_name} ${row.model_identifier} ${row.service_type}`.toLocaleLowerCase().includes(query));
  }, [rows, search]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const select = (row: MediaPriceRow) => {
    setSelectedId(row.id);
    setCost(String(row.provider_cost_egp_per_unit));
    setError(null);
    setNotice(null);
  };

  const save = async () => {
    if (!selected) return;
    const value = Number(cost);
    if (!Number.isFinite(value) || value < 0) {
      setError("أدخل تكلفة صحيحة موجبة أو صفرًا.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await adminService.updateMediaModelPrice({
        providerId: selected.provider_id,
        serviceType: selected.service_type,
        modelIdentifier: selected.model_identifier,
        displayName: selected.display_name,
        unitType: selected.unit_type,
        providerCost: value,
        expectedVersion: selected.price_version,
      });
      setNotice("تم حفظ إصدار جديد، مع الاحتفاظ بسجل الأسعار السابق.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ السعر.");
    } finally {
      setSaving(false);
    }
  };

  return <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>أسعار الصور والفيديو والصوت</Text>
        <Text style={styles.subtitle}>22 نموذجًا · تكلفة المزود وسعر البيع بالجنيه · زيادة ثابتة 40%</Text>
      </View>
      <Pressable onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>تحديث</Text></Pressable>
    </View>
    <TextInput value={search} onChangeText={setSearch} placeholder="ابحث عن نموذج أو خدمة" placeholderTextColor={colors.textMuted} style={styles.search} />
    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    <View style={styles.rows}>
      {visibleRows.map((row) => <Pressable key={row.id} onPress={() => select(row)} style={[styles.row, selectedId === row.id && styles.selectedRow]}>
        <View style={styles.rowMain}>
          <Text style={styles.modelName}>{row.display_name}</Text>
          <Text style={styles.unit}>{serviceLabel[row.service_type]}</Text>
        </View>
        <Text style={styles.modelId}>{row.model_identifier}</Text>
        <Text style={styles.price}>التكلفة {money(row.provider_cost_egp_per_unit)} ج.م ← البيع {money(row.selling_price_egp_per_unit)} ج.م / {serviceLabel[row.service_type]}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusOk}>{row.provider_tested ? "تم اختباره لدى المزود" : "غير مختبر لدى المزود"}</Text>
          <Text style={styles.statusPending}>{row.suly_integration_verified ? "تكامل SULY متحقق" : "تكامل SULY غير متحقق"}</Text>
          <Text style={styles.version}>v{row.price_version}</Text>
        </View>
      </Pressable>)}
    </View>
    {selected ? <View style={styles.editor}>
      <Text style={styles.editorTitle}>تعديل تكلفة {selected.display_name}</Text>
      <TextInput keyboardType="decimal-pad" value={cost} onChangeText={setCost} style={styles.input} />
      <Text style={styles.selling}>سعر البيع المتوقع: {money((Number(cost) || 0) * 1.4)} ج.م / {serviceLabel[selected.service_type]}</Text>
      <Pressable disabled={saving} onPress={() => void save()} style={[styles.save, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? "جارٍ الحفظ…" : "حفظ إصدار سعر جديد"}</Text></Pressable>
    </View> : <Text style={styles.hint}>اختر خدمة لتعديل تكلفتها. هذه الأسعار مرجعية ولا تفعّل نموذجًا أو تشغّل خدمة تلقائيًا.</Text>}
    <Text style={styles.note}>كل النماذج مسجلة كمجرّبة لدى المزود بناءً على تأكيدك. تكامل SULY والتشغيل والفوترة ما زالت غير مفعّلة حتى اجتياز اختبار كل مسار مستقلًا.</Text>
  </View>;
}

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.divider, borderRadius: 12, backgroundColor: colors.surface, padding: 13, gap: 10 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 8 },
  headerCopy: { flex: 1, alignItems: "flex-end", gap: 3 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", textAlign: "right" },
  subtitle: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
  refresh: { borderWidth: 1, borderColor: colors.divider, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  refreshText: { color: colors.textPrimary, fontSize: 10, fontWeight: "700" },
  search: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, color: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 9, textAlign: "right", fontSize: 11 },
  rows: { gap: 5 },
  row: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, padding: 9, gap: 4, backgroundColor: colors.background },
  selectedRow: { borderColor: colors.primary, backgroundColor: colors.surface },
  rowMain: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 6 },
  modelName: { color: colors.textPrimary, fontSize: 10, fontWeight: "800", textAlign: "right", flex: 1 },
  unit: { color: colors.primary, fontSize: 8, fontWeight: "700" },
  modelId: { color: colors.textMuted, fontSize: 8, textAlign: "left" },
  price: { color: colors.textSecondary, fontSize: 9, textAlign: "right" },
  statusRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, flexWrap: "wrap" },
  statusOk: { color: colors.success, fontSize: 8 },
  statusPending: { color: colors.warning, fontSize: 8 },
  version: { color: colors.textMuted, fontSize: 8 },
  editor: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, gap: 8 },
  editorTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: "800", textAlign: "right" },
  input: { borderWidth: 1, borderColor: colors.divider, borderRadius: 7, color: colors.textPrimary, backgroundColor: colors.background, padding: 8, textAlign: "right", fontSize: 11 },
  selling: { color: colors.primary, fontSize: 9, fontWeight: "700", textAlign: "right" },
  save: { backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: "center" },
  saveText: { color: "#07120D", fontSize: 10, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  hint: { color: colors.textMuted, fontSize: 9, textAlign: "right" },
  note: { color: colors.textMuted, fontSize: 8, textAlign: "right", lineHeight: 14 },
  error: { color: colors.error, fontSize: 9, textAlign: "right" },
  notice: { color: colors.success, fontSize: 9, textAlign: "right" },
});
