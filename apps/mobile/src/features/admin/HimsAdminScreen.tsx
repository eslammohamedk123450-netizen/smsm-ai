import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { adminService, type HimsActivationCode, type HimsResource } from "./admin-service";
import { colors } from "../../theme/colors";

function Field({ label, value, onChange, placeholder, keyboardType = "default" }: { label: string; value: string; onChange(value: string): void; placeholder: string; keyboardType?: "default" | "numeric" | "url" }) {
  return <View><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} keyboardType={keyboardType} autoCapitalize="none" /></View>;
}
function Button({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "HIMS-";
  for (let i = 0; i < 10; i += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

export function HimsAdminScreen() {
  const [codes, setCodes] = useState<HimsActivationCode[]>([]);
  const [resources, setResources] = useState<HimsResource[]>([]);
  const [code, setCode] = useState("");
  const [codeLabel, setCodeLabel] = useState("دفعة HIMS");
  const [maxUses, setMaxUses] = useState("1");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("lecture");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [loadedCodes, loadedResources] = await Promise.all([adminService.getHimsActivationCodes(), adminService.getHimsResources()]);
      setCodes(loadedCodes); setResources(loadedResources);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات HIMS."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const createCode = async () => {
    const normalized = code.trim().toUpperCase();
    const uses = maxUses.trim() ? Number(maxUses) : null;
    if (normalized.length < 6) { setError("اكتب كودًا من 6 أحرف على الأقل أو اضغط توليد كود."); return; }
    if (uses !== null && (!Number.isInteger(uses) || uses < 1)) { setError("عدد الاستخدامات يجب أن يكون رقمًا صحيحًا موجبًا."); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      await adminService.createHimsActivationCode({ code: normalized, label: codeLabel, maxUses: uses, expiresAt: null });
      setCode(""); setNotice(`تم إنشاء الكود ${normalized}. أرسله للمستخدم ليكتبه في المحادثة: !ACTIVATE_${normalized}`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إنشاء كود HIMS."); }
    finally { setBusy(false); }
  };

  const createResource = async () => {
    if (!title.trim() || !url.trim()) { setError("اكتب عنوان المورد والرابط."); return; }
    try { if (new URL(url.trim()).protocol !== "https:") throw new Error(); } catch { setError("رابط المورد يجب أن يبدأ بـ https://"); return; }
    setBusy(true); setError(null); setNotice(null);
    try { await adminService.createHimsResource({ title, url, kind, description }); setTitle(""); setUrl(""); setDescription(""); setNotice("تمت إضافة مورد HIMS بنجاح."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إضافة مورد HIMS."); }
    finally { setBusy(false); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.title}>إدارة HIMS</Text><Pressable onPress={() => void load()}><Text style={styles.link}>تحديث</Text></Pressable></View>
    <Text style={styles.explainer}>أنشئ أكواد تفعيل وأضف روابط المحاضرات والملفات. لا تُخزَّن مفاتيح أو ملفات داخل هذه الشاشة؛ الملفات الفعلية تمر عبر التخزين الخارجي R2.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.success}>{notice}</Text> : null}
    <View style={styles.card}><Text style={styles.sectionTitle}>إنشاء كود تفعيل</Text><Field label="الكود" value={code} onChange={setCode} placeholder="HIMS-2026-ABC" /><View style={styles.inline}><Button label="توليد كود" onPress={() => setCode(generateCode())} /><View style={styles.flex}><Field label="عدد الاستخدامات" value={maxUses} onChange={setMaxUses} placeholder="1" keyboardType="numeric" /></View></View><Field label="وصف الكود" value={codeLabel} onChange={setCodeLabel} placeholder="دفعة HIMS" /><Button label={busy ? "جارٍ الإنشاء…" : "إنشاء الكود"} onPress={() => void createCode()} disabled={busy} /></View>
    <View style={styles.card}><Text style={styles.sectionTitle}>إضافة محاضرة أو ملف</Text><Field label="العنوان" value={title} onChange={setTitle} placeholder="محاضرة الشبكات - الوحدة الأولى" /><Field label="الرابط HTTPS" value={url} onChange={setUrl} placeholder="https://..." keyboardType="url" /><Field label="النوع" value={kind} onChange={setKind} placeholder="lecture أو file أو library" /><Field label="الوصف" value={description} onChange={setDescription} placeholder="وصف اختياري" /><Button label={busy ? "جارٍ الحفظ…" : "إضافة المورد"} onPress={() => void createResource()} disabled={busy} /></View>
    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    <View style={styles.card}><Text style={styles.sectionTitle}>أكواد HIMS الحالية</Text>{!loading && codes.length === 0 ? <Text style={styles.detail}>لا يوجد كود بعد.</Text> : codes.map((item) => <View key={item.id} style={styles.row}><Text style={styles.cardTitle}>{item.label || "كود HIMS"}</Text><Text style={styles.detail}>بصمة: {item.code_fingerprint} · الاستخدام: {item.used_count}/{item.max_uses ?? "∞"} · {item.is_active ? "فعال" : "معطل"}</Text></View>)}</View>
    <View style={styles.card}><Text style={styles.sectionTitle}>موارد HIMS الحالية</Text>{!loading && resources.length === 0 ? <Text style={styles.detail}>لم تتم إضافة موارد بعد.</Text> : resources.map((item) => <View key={item.id} style={styles.row}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.detail}>{item.kind} · {item.url}</Text>{item.description ? <Text style={styles.detail}>{item.description}</Text> : null}</View>)}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, gap: 12 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { color: colors.textPrimary, fontSize: 26, fontWeight: "800", textAlign: "right" }, explainer: { color: colors.textSecondary, lineHeight: 21, textAlign: "right" }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 16, gap: 9 }, sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", textAlign: "right" }, label: { color: colors.textSecondary, textAlign: "right", marginTop: 3 }, input: { minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, paddingHorizontal: 12, color: colors.textPrimary, marginTop: 4 }, button: { minHeight: 42, borderRadius: 9, backgroundColor: colors.primary, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", marginTop: 6 }, disabled: { opacity: 0.5 }, buttonText: { color: "#FFFFFF", fontWeight: "700" }, link: { color: colors.accent, fontWeight: "700" }, error: { color: colors.error, textAlign: "right" }, success: { color: colors.success, textAlign: "right" }, inline: { flexDirection: "row", gap: 10, alignItems: "flex-end" }, flex: { flex: 1 }, row: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, marginTop: 3 }, cardTitle: { color: colors.textPrimary, fontWeight: "700", textAlign: "right" }, detail: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: "right" } });
