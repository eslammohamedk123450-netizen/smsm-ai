import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type PriceRow = {
  id: string;
  model_id: number;
  price_version: number;
  provider_input_cost_egp_per_million: number;
  provider_output_cost_egp_per_million: number;
  selling_input_egp_per_million: number;
  selling_output_egp_per_million: number;
  markup_rate: number;
  model: { id: number; name: string; model_identifier: string; provider_id: number } | null;
};

const money = (value: number) => Number(value).toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function ModelPricingAdminCard() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [inputCost, setInputCost] = useState("");
  const [outputCost, setOutputCost] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async (): Promise<PriceRow[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminService.getModelPriceVersions() as PriceRow[];
      const nextRows = result.filter((row) => row.model);
      setRows(nextRows);
      return nextRows;
    } catch {
      setError("تعذر تحميل أسعار النماذج. تحقق من صلاحية الأدمن وتطبيق ترحيل الأسعار.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter((row) => !query || `${row.model?.name ?? ""} ${row.model?.model_identifier ?? ""}`.toLocaleLowerCase().includes(query));
  }, [rows, search]);

  const selected = rows.find((row) => row.model_id === selectedId) ?? null;
  const select = (row: PriceRow) => {
    setSelectedId(row.model_id);
    setInputCost(String(row.provider_input_cost_egp_per_million));
    setOutputCost(String(row.provider_output_cost_egp_per_million));
    setError(null);
    setNotice(null);
  };

  const save = async () => {
    if (!selected) return;
    const input = Number(inputCost);
    const output = Number(outputCost);
    if (!Number.isFinite(input) || input < 0 || !Number.isFinite(output) || output < 0) {
      setError("أدخل تكلفة صحيحة موجبة أو صفرًا.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await adminService.updateModelPrice(selected.model_id, input, output, selected.price_version);
      setNotice("تم حفظ إصدار سعر جديد مع الاحتفاظ بالإصدار السابق.");
      const updatedRows = await load();
      const updated = updatedRows?.find((row) => row.model_id === selected.model_id);
      if (updated) {
        setSelectedId(updated.model_id);
        setInputCost(String(updated.provider_input_cost_egp_per_million));
        setOutputCost(String(updated.provider_output_cost_egp_per_million));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ السعر.");
    } finally {
      setSaving(false);
    }
  };

  return <View style={styles.card}>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>كتالوج أسعار النماذج النصية</Text>
        <Text style={styles.subtitle}>44 نموذجًا · التكلفة بالجنيه لكل مليون رمز · سعر البيع محسوب بزيادة 40%</Text>
      </View>
      <Pressable onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>تحديث</Text></Pressable>
    </View>
    <TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم النموذج أو المعرّف" placeholderTextColor={colors.textMuted} style={styles.search} />
    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    <View style={styles.rows}>
      {visibleRows.map((row) => <Pressable key={row.model_id} onPress={() => select(row)} style={[styles.row, selectedId === row.model_id && styles.selectedRow]}>
        <View style={styles.rowMain}>
          <Text style={styles.modelName}>{row.model?.name ?? row.model?.model_identifier ?? `#${row.model_id}`}</Text>
          <Text style={styles.modelId}>{row.model?.model_identifier}</Text>
        </View>
        <View style={styles.priceColumns}>
          <View style={styles.priceColumn}><Text style={styles.priceLabel}>إدخال / 1M</Text><Text style={styles.priceValue}>{money(row.provider_input_cost_egp_per_million)} ← {money(row.selling_input_egp_per_million)}</Text></View>
          <View style={styles.priceColumn}><Text style={styles.priceLabel}>إخراج / 1M</Text><Text style={styles.priceValue}>{money(row.provider_output_cost_egp_per_million)} ← {money(row.selling_output_egp_per_million)}</Text></View>
        </View>
        <Text style={styles.version}>الإصدار {row.price_version}</Text>
      </Pressable>)}
    </View>
    {selected ? <View style={styles.editor}>
      <Text style={styles.editorTitle}>تعديل تكلفة {selected.model?.name}</Text>
      <View style={styles.inputs}>
        <View style={styles.field}><Text style={styles.fieldLabel}>تكلفة الإدخال / مليون</Text><TextInput keyboardType="decimal-pad" value={inputCost} onChangeText={setInputCost} style={styles.input} /></View>
        <View style={styles.field}><Text style={styles.fieldLabel}>تكلفة الإخراج / مليون</Text><TextInput keyboardType="decimal-pad" value={outputCost} onChangeText={setOutputCost} style={styles.input} /></View>
      </View>
      <Text style={styles.selling}>سعر البيع المتوقع: {money((Number(inputCost) || 0) * 1.4)} إدخال · {money((Number(outputCost) || 0) * 1.4)} إخراج ج.م / مليون</Text>
      <Pressable disabled={saving} onPress={() => void save()} style={[styles.save, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? "جارٍ الحفظ…" : "حفظ إصدار سعر جديد"}</Text></Pressable>
    </View> : <Text style={styles.hint}>اختر نموذجًا من القائمة لتعديل تكلفته. كل تعديل ينشئ إصدارًا جديدًا ولا يمحو سجل الأسعار السابق.</Text>}
    <Text style={styles.note}>ملاحظة: الأسعار محفوظة كمرجع مالي بالجنيه، ولم يتم تغيير خصم رصيد المستخدمين؛ قيمة الرصيد بالجنيه غير مضبوطة حاليًا.</Text>
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
  row: { borderWidth: 1, borderColor: colors.divider, borderRadius: 8, padding: 9, gap: 5, backgroundColor: colors.background },
  selectedRow: { borderColor: colors.primary, backgroundColor: colors.surface },
  rowMain: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 6 },
  modelName: { color: colors.textPrimary, fontSize: 10, fontWeight: "800", textAlign: "right", flex: 1 },
  modelId: { color: colors.textMuted, fontSize: 8, flex: 1, textAlign: "left" },
  priceColumns: { flexDirection: "row-reverse", gap: 8 },
  priceColumn: { flex: 1, gap: 2 },
  priceLabel: { color: colors.textMuted, fontSize: 8, textAlign: "right" },
  priceValue: { color: colors.textSecondary, fontSize: 9, textAlign: "right", fontVariant: ["tabular-nums"] },
  version: { color: colors.textMuted, fontSize: 8, textAlign: "right" },
  editor: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, gap: 8 },
  editorTitle: { color: colors.textPrimary, fontSize: 11, fontWeight: "800", textAlign: "right" },
  inputs: { flexDirection: "row-reverse", gap: 8 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { color: colors.textMuted, fontSize: 8, textAlign: "right" },
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
