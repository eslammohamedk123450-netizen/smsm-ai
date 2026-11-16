import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { supabase } from "../../lib/supabase/client";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type ModelOption = { id: number; name: string; model_identifier: string; provider_name?: string };
type EvidenceRow = {
  model_id: number; capability_key: string;
  vendor_claim_status: "unknown" | "supported" | "unsupported"; vendor_evidence_url: string | null;
  provider_test_status: "not_tested" | "passed" | "failed"; provider_evidence_url: string | null;
  suly_test_status: "not_tested" | "passed" | "failed"; suly_evidence_url: string | null;
  notes: string | null;
};
const CAPABILITIES = [
  ["text", "إدخال النص"], ["vision", "فهم الصور"], ["pdf_input", "إدخال PDF"], ["file_input", "إدخال الملفات"],
  ["video_input", "إدخال الفيديو"], ["audio_input", "إدخال الصوت"], ["audio_output", "إخراج الصوت"],
  ["image_generation", "توليد الصور"], ["video_generation", "توليد الفيديو"], ["transcription", "تفريغ الصوت"],
  ["function_calling", "استدعاء الدوال"], ["structured_output", "مخرجات منظمة"], ["streaming", "البث التدريجي"],
  ["web_search", "أداة بحث الويب"], ["file_search", "أداة البحث بالملفات"], ["computer_use", "استخدام الكمبيوتر"],
  ["code_interpreter", "تنفيذ/تحليل الكود"], ["mcp_tools", "أدوات MCP"],
  ["gmail", "تكامل أداة Gmail"], ["google_drive", "تكامل أداة Drive"], ["github", "تكامل أداة GitHub"],
] as const;
const VENDOR = [["unknown", "غير معروف"], ["supported", "مدعوم رسميًا"], ["unsupported", "غير مدعوم"]] as const;
const TEST = [["not_tested", "لم يُختبر"], ["passed", "نجح"], ["failed", "فشل"]] as const;

export function ModelCapabilityEvidenceAdminCard({ models }: { models: ModelOption[] }) {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [modelId, setModelId] = useState<number | null>(models[0]?.id ?? null);
  const [capability, setCapability] = useState<string>("text");
  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState<EvidenceRow["vendor_claim_status"]>("unknown");
  const [vendorUrl, setVendorUrl] = useState("");
  const [provider, setProvider] = useState<EvidenceRow["provider_test_status"]>("not_tested");
  const [providerUrl, setProviderUrl] = useState("");
  const [suly, setSuly] = useState<EvidenceRow["suly_test_status"]>("not_tested");
  const [sulyUrl, setSulyUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("suly_admin_list_model_capability_evidence", { p_model_id: null });
      if (rpcError) throw rpcError;
      setRows((data ?? []) as EvidenceRow[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل أدلة القدرات."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const row = rows.find((item) => item.model_id === modelId && item.capability_key === capability);
    setVendor(row?.vendor_claim_status ?? "unknown"); setVendorUrl(row?.vendor_evidence_url ?? "");
    setProvider(row?.provider_test_status ?? "not_tested"); setProviderUrl(row?.provider_evidence_url ?? "");
    setSuly(row?.suly_test_status ?? "not_tested"); setSulyUrl(row?.suly_evidence_url ?? "");
    setNotes(row?.notes ?? ""); setError(null); setNotice(null);
  }, [rows, modelId, capability]);

  const filteredModels = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return models.filter((m) => !q || `${m.name} ${m.model_identifier} ${m.provider_name ?? ""}`.toLocaleLowerCase().includes(q));
  }, [models, search]);
  const current = models.find((m) => m.id === modelId);
  const runTextProbe = async () => {
    if (!modelId || capability !== "text") return;
    setTesting(true); setError(null); setNotice(null);
    try {
      const result = await adminService.testModel(modelId);
      await load();
      if (result.status === "success") {
        setNotice(`نجح اختبار النص للمزود خلال ${Math.max(0, Math.floor(result.duration_ms))}ms، وتم تحديث سجل دليل المزود تلقائيًا.`);
      } else {
        setError(`فشل اختبار النص: ${result.error_code ?? "provider_probe_failed"}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تنفيذ اختبار النص.");
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!modelId) return;
    if (suly === "passed" && provider !== "passed") { setError("لا يمكن اعتماد تكامل SULY قبل نجاح اختبار المزود."); return; }
    const urls = [vendorUrl, providerUrl, sulyUrl];
    if (urls.some((url) => url.trim() && !/^https:\/\//i.test(url.trim()))) { setError("روابط الأدلة يجب أن تبدأ بـ https://"); return; }
    if (vendor !== "unknown" && !vendorUrl.trim()) { setError("أضف رابط الوثائق قبل اعتماد ادعاء المزود."); return; }
    if (provider !== "not_tested" && !providerUrl.trim()) { setError("أضف رابط دليل اختبار المزود قبل تسجيل النتيجة."); return; }
    if (suly !== "not_tested" && !sulyUrl.trim()) { setError("أضف رابط تقرير اختبار SULY قبل تسجيل النتيجة."); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("suly_admin_save_model_capability_evidence", {
        p_model_id: modelId, p_capability_key: capability, p_vendor_claim_status: vendor,
        p_vendor_evidence_url: vendorUrl.trim() || null, p_provider_test_status: provider,
        p_provider_evidence_url: providerUrl.trim() || null, p_suly_test_status: suly,
        p_suly_evidence_url: sulyUrl.trim() || null, p_notes: notes.trim() || null,
      });
      if (rpcError) throw rpcError;
      if (data?.success !== true) throw new Error("لم تؤكد قاعدة البيانات حفظ سجل القدرة.");
      setNotice("تم حفظ حالة القدرة وأدلتها في سجل مستقل مع تسجيل العملية.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ سجل القدرة."); }
    finally { setSaving(false); }
  };

  return <View style={styles.card}>
    <View style={styles.header}><View style={styles.copy}><Text style={styles.title}>توثيق قدرات النماذج</Text><Text style={styles.sub}>3 مستويات منفصلة: توثيق المزود، اختبار المزود، واختبار تكامل SULY. الحالة المجهولة لا تعني أن القدرة مدعومة.</Text></View><Pressable onPress={() => void load()}><Text style={styles.action}>تحديث</Text></Pressable></View>
    <TextInput value={search} onChangeText={setSearch} placeholder="ابحث عن نموذج بالاسم أو المعرّف" placeholderTextColor={colors.textMuted} style={styles.input} />
    <View style={styles.wrap}>{filteredModels.slice(0, 30).map((m) => <Pressable key={m.id} onPress={() => setModelId(m.id)} style={[styles.chip, modelId === m.id && styles.selected]}><Text style={styles.chipText}>{m.name} · {m.provider_name ?? "مزود"} · #{m.id}</Text></Pressable>)}</View>
    <Text style={styles.hint}>{filteredModels.length > 30 ? "اعرض أول 30 نتيجة؛ استخدم البحث لتضييق القائمة." : `${filteredModels.length} نموذج مطابق`}</Text>
    {current ? <Text style={styles.selectedName}>{current.name} · {current.provider_name ?? "مزود"} · #{current.id} · {current.model_identifier}</Text> : null}
    <View style={styles.wrap}>{CAPABILITIES.map(([key, label]) => <Pressable key={key} onPress={() => setCapability(key)} style={[styles.chip, capability === key && styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    {capability === "text" ? <View style={styles.probeRow}>
      <View style={styles.probeCopy}><Text style={styles.probeTitle}>اختبار النص الفعلي</Text><Text style={styles.hint}>يختبر اتصال المزود واستجابة النص فقط، ولا يثبت الرؤية أو الصوت أو الوسائط.</Text></View>
      <Pressable disabled={testing || loading || !modelId} onPress={() => void runTextProbe()} style={[styles.probeButton, (testing || loading || !modelId) && styles.disabled]}><Text style={styles.probeButtonText}>{testing ? "جارٍ الاختبار…" : "اختبار النص الآن"}</Text></Pressable>
    </View> : null}
    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    <Text style={styles.label}>١. ما تقوله وثائق المزود</Text>
    <View style={styles.wrap}>{VENDOR.map(([value, label]) => <Pressable key={value} onPress={() => setVendor(value)} style={[styles.chip, vendor === value && styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    <TextInput value={vendorUrl} onChangeText={setVendorUrl} placeholder="رابط الوثائق الرسمية https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input} />
    <Text style={styles.label}>٢. اختبار المزود لهذه القدرة</Text>
    <View style={styles.wrap}>{TEST.map(([value, label]) => <Pressable key={value} onPress={() => setProvider(value)} style={[styles.chip, provider === value && styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    <TextInput value={providerUrl} onChangeText={setProviderUrl} placeholder="رابط/مرجع نتيجة اختبار المزود https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input} />
    <Text style={styles.label}>٣. اختبار تكامل SULY نفسه</Text>
    <View style={styles.wrap}>{TEST.map(([value, label]) => <Pressable key={value} onPress={() => setSuly(value)} style={[styles.chip, suly === value && styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    <TextInput value={sulyUrl} onChangeText={setSulyUrl} placeholder="رابط تقرير/اختبار تكامل SULY https://" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={styles.input} />
    <TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات الاختبار والقيود (اختياري)" placeholderTextColor={colors.textMuted} style={styles.input} multiline />
    {error ? <Text style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.success}>{notice}</Text> : null}
    <Pressable disabled={saving || loading || !modelId} onPress={() => void save()} style={[styles.save, (saving || loading || !modelId) && styles.disabled]}><Text style={styles.saveText}>{saving ? "جارٍ الحفظ…" : "حفظ سجل القدرة"}</Text></Pressable>
    <Text style={styles.hint}>هذا السجل لا يغيّر توجيه الإنتاج تلقائيًا؛ تظل قواعد التوجيه الحالية كما هي إلى أن تكتمل أدلة التحقق واختبارات عدم التأثير.</Text>
  </View>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  card: { borderWidth: 1, borderColor: c.divider, borderRadius: 12, backgroundColor: c.surface, padding: 13, gap: 9 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  copy: { flex: 1, alignItems: "flex-end", gap: 3 }, title: { color: c.textPrimary, fontSize: 14, fontWeight: "900", textAlign: "right" },
  sub: { color: c.textMuted, fontSize: 9, textAlign: "right", lineHeight: 15 }, action: { color: c.primary, fontSize: 10, fontWeight: "800" },
  input: { borderWidth: 1, borderColor: c.divider, borderRadius: 8, backgroundColor: c.background, color: c.textPrimary, padding: 9, fontSize: 10, textAlign: "right" },
  wrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 5 }, chip: { borderWidth: 1, borderColor: c.divider, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  selected: { borderColor: c.primary, backgroundColor: c.background }, chipText: { color: c.textPrimary, fontSize: 9 }, hint: { color: c.textMuted, fontSize: 8, textAlign: "right" },
  selectedName: { color: c.textPrimary, fontSize: 10, fontWeight: "800", textAlign: "right" }, label: { color: c.textSecondary, fontSize: 10, fontWeight: "800", textAlign: "right" },
  save: { backgroundColor: c.primary, borderRadius: 8, padding: 10, alignItems: "center" }, saveText: { color: c.onPrimary, fontSize: 10, fontWeight: "800" },
  probeRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: c.divider, borderRadius: 8, padding: 9 },
  probeCopy: { flex: 1, alignItems: "flex-end", gap: 3 }, probeTitle: { color: c.textPrimary, fontSize: 10, fontWeight: "800", textAlign: "right" },
  probeButton: { backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }, probeButtonText: { color: c.onPrimary, fontSize: 9, fontWeight: "800" },
  disabled: { opacity: 0.5 }, error: { color: c.error, fontSize: 9, textAlign: "right" }, success: { color: c.success, fontSize: 9, textAlign: "right" },
});
