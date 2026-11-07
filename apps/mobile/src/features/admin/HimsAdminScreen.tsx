import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { adminService, type HimsActivationCode, type HimsResource } from "./admin-service";
import { colors } from "../../theme/colors";
import { formatBytes, pickMedia, uploadMediaFile, type MediaAsset, type PickKind } from "../media/media-service";

function Field({ label, value, onChange, placeholder, keyboardType = "default" }: { label: string; value: string; onChange(value: string): void; placeholder: string; keyboardType?: "default" | "numeric" | "url" }) {
  return <View><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} keyboardType={keyboardType} autoCapitalize="none" /></View>;
}
function Button({ label, onPress, disabled = false, tone = "primary" }: { label: string; onPress(): void; disabled?: boolean; tone?: "primary" | "ghost" }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[tone === "primary" ? styles.button : styles.ghostButton, disabled && styles.disabled]}><Text style={tone === "primary" ? styles.buttonText : styles.ghostButtonText}>{label}</Text></Pressable>;
}
function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "HIMS-";
  for (let i = 0; i < 10; i += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}
function commandFor(code: string) {
  return `!ACTIVATE_${code}`;
}
function posterFor(url: string, kind: string) {
  return kind === "video" ? url.replace(/\.[A-Za-z0-9]+$/, ".jpg") : url;
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
  const [uploading, setUploading] = useState<PickKind | null>(null);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{ code: string; command: string } | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [loadedCodes, loadedResources] = await Promise.all([adminService.getHimsActivationCodes(), adminService.getHimsResources()]);
      setCodes(loadedCodes); setResources(loadedResources);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات HIMS."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const copy = async (value: string, what: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setError(null);
      setNotice(`تم نسخ ${what}: ${value}`);
    } catch {
      setError("تعذر النسخ من المتصفح. حدّد النص وانسخه يدويًا.");
    }
  };

  const createCode = async () => {
    const normalized = code.trim().toUpperCase();
    const uses = maxUses.trim() ? Number(maxUses) : null;
    if (normalized.length < 6) { setError("اكتب كودًا من 6 أحرف على الأقل أو اضغط توليد كود."); return; }
    if (uses !== null && (!Number.isInteger(uses) || uses < 1)) { setError("عدد الاستخدامات يجب أن يكون رقمًا صحيحًا موجبًا."); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const created = await adminService.createHimsActivationCode({ code: normalized, label: codeLabel, maxUses: uses, expiresAt: null });
      const savedCode = created?.code ?? normalized;
      setLastCreated({ code: savedCode, command: created?.command ?? commandFor(savedCode) });
      setCode("");
      setNotice("تم حفظ الكود. يمكنك نسخه من بطاقة آخر كود أو من قائمة الأكواد في أي وقت.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إنشاء كود HIMS."); }
    finally { setBusy(false); }
  };

  /** Uploads a real file to Cloudinary under the HIMS feature, then fills the form. */
  const uploadForHims = async (pickKind: PickKind) => {
    setUploading(pickKind); setError(null); setNotice(null);
    try {
      const picked = await pickMedia(pickKind);
      if (!picked) { setUploading(null); return; }
      setNotice(`جارٍ رفع ${picked.part.name} إلى Cloudinary…`);
      const asset = await uploadMediaFile({ picked, featureKey: "hims" });
      setPreview(asset);
      if (!title.trim()) setTitle(asset.filename ?? "ملف HIMS");
      setUrl(asset.url);
      setKind(asset.kind === "video" ? "video" : asset.kind === "image" ? "image" : "file");
      setNotice(`تم رفع الملف (${formatBytes(asset.sizeBytes)}). اضغط «إضافة المورد» لحفظه داخل HIMS.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر رفع الملف إلى Cloudinary.");
      setNotice(null);
    } finally { setUploading(null); }
  };

  const createResource = async () => {
    if (!title.trim() || !url.trim()) { setError("اكتب عنوان المورد والرابط، أو ارفع ملفًا أولًا."); return; }
    try { if (new URL(url.trim()).protocol !== "https:") throw new Error(); } catch { setError("رابط المورد يجب أن يبدأ بـ https://"); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      await adminService.createHimsResource({ title, url, kind, description });
      setTitle(""); setUrl(""); setDescription(""); setPreview(null);
      setNotice("تمت إضافة مورد HIMS بنجاح.");
      await load();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إضافة مورد HIMS."); }
    finally { setBusy(false); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.title}>إدارة HIMS</Text><Pressable onPress={() => void load()}><Text style={styles.link}>تحديث</Text></Pressable></View>
    <Text style={styles.explainer}>أنشئ أكواد تفعيل وأضف محاضرات وملفات. الوسائط تُرفع إلى Cloudinary ويُحفظ رابطها فقط في Supabase.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.success}>{notice}</Text> : null}

    {lastCreated ? <View style={[styles.card, styles.highlightCard]}>
      <Text style={styles.sectionTitle}>آخر كود تم إنشاؤه</Text>
      <Text selectable style={styles.commandText}>{lastCreated.command}</Text>
      <View style={styles.inline}>
        <Button label="نسخ الأمر كاملًا" onPress={() => void copy(lastCreated.command, "أمر التفعيل")} />
        <Button label="نسخ الكود فقط" tone="ghost" onPress={() => void copy(lastCreated.code, "الكود")} />
      </View>
      <Text style={styles.detail}>أرسل هذا الأمر في المحادثة كما هو. يعمل أيضًا لو أرسل المستخدم الكود وحده بدون البادئة.</Text>
    </View> : null}

    <View style={styles.card}><Text style={styles.sectionTitle}>إنشاء كود تفعيل</Text><Field label="الكود" value={code} onChange={setCode} placeholder="HIMS-2026-ABC" /><View style={styles.inline}><Button label="توليد كود" tone="ghost" onPress={() => setCode(generateCode())} /><View style={styles.flex}><Field label="عدد الاستخدامات" value={maxUses} onChange={setMaxUses} placeholder="1" keyboardType="numeric" /></View></View><Field label="وصف الكود" value={codeLabel} onChange={setCodeLabel} placeholder="دفعة HIMS" /><Button label={busy ? "جارٍ الإنشاء…" : "إنشاء الكود"} onPress={() => void createCode()} disabled={busy} /></View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>إضافة محاضرة أو ملف</Text>
      <Text style={styles.detail}>ارفع صورة أو فيديو أو مستندًا مباشرة، أو الصق رابطًا خارجيًا.</Text>
      <View style={styles.inline}>
        <Button label={uploading === "image" ? "جارٍ رفع الصورة…" : "رفع صورة"} tone="ghost" onPress={() => void uploadForHims("image")} disabled={uploading !== null || busy} />
        <Button label={uploading === "video" ? "جارٍ رفع الفيديو…" : "رفع فيديو"} tone="ghost" onPress={() => void uploadForHims("video")} disabled={uploading !== null || busy} />
        <Button label={uploading === "document" ? "جارٍ رفع الملف…" : "رفع ملف"} tone="ghost" onPress={() => void uploadForHims("document")} disabled={uploading !== null || busy} />
      </View>
      {uploading ? <ActivityIndicator color={colors.primary} /> : null}
      {preview ? <View style={styles.previewRow}>
        {preview.kind === "raw"
          ? <View style={[styles.preview, styles.fileThumb]}><Text style={styles.fileIcon}>FILE</Text></View>
          : <Image source={{ uri: posterFor(preview.url, preview.kind) }} style={styles.preview} resizeMode="cover" />}
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{preview.filename ?? "ملف مرفوع"}</Text>
          <Text style={styles.detail}>{preview.kind} · {formatBytes(preview.sizeBytes)}</Text>
          <Text selectable numberOfLines={1} style={styles.detail}>{preview.url}</Text>
        </View>
      </View> : null}
      <Field label="العنوان" value={title} onChange={setTitle} placeholder="محاضرة الشبكات - الوحدة الأولى" />
      <Field label="الرابط HTTPS" value={url} onChange={setUrl} placeholder="https://..." keyboardType="url" />
      <Field label="النوع" value={kind} onChange={setKind} placeholder="lecture أو image أو video أو file" />
      <Field label="الوصف" value={description} onChange={setDescription} placeholder="وصف اختياري" />
      <Button label={busy ? "جارٍ الحفظ…" : "إضافة المورد"} onPress={() => void createResource()} disabled={busy || uploading !== null} />
    </View>

    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>أكواد HIMS الحالية</Text>
      {!loading && codes.length === 0 ? <Text style={styles.detail}>لا يوجد كود بعد.</Text> : codes.map((item) => <View key={item.id} style={styles.row}>
        <Text style={styles.cardTitle}>{item.label || "كود HIMS"}</Text>
        {item.code_plain
          ? <Text selectable style={styles.commandText}>{commandFor(item.code_plain)}</Text>
          : <Text style={styles.detail}>هذا الكود أُنشئ قبل تفعيل الحفظ، ولا يمكن استرجاع نصه. البصمة: {item.code_fingerprint}</Text>}
        <Text style={styles.detail}>الاستخدام: {item.used_count}/{item.max_uses ?? "∞"} · {item.is_active ? "فعال" : "معطل"}{item.last_used_at ? ` · آخر استخدام: ${item.last_used_at.slice(0, 16).replace("T", " ")}` : ""}</Text>
        <View style={styles.inline}>
          <Button label="نسخ الأمر" onPress={() => void copy(commandFor(item.code_plain ?? ""), "أمر التفعيل")} disabled={!item.code_plain} />
          {item.code_plain ? <Button label="نسخ الكود" tone="ghost" onPress={() => void copy(item.code_plain ?? "", "الكود")} /> : null}
        </View>
      </View>)}
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}>موارد HIMS الحالية</Text>
      {!loading && resources.length === 0 ? <Text style={styles.detail}>لم تتم إضافة موارد بعد.</Text> : resources.map((item) => <View key={item.id} style={styles.row}>
        <View style={styles.previewRow}>
          {item.kind === "image" || item.kind === "video" ? <Image source={{ uri: posterFor(item.url, item.kind) }} style={styles.preview} resizeMode="cover" /> : null}
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.detail}>{item.kind} · {item.url}</Text>
            {item.description ? <Text style={styles.detail}>{item.description}</Text> : null}
          </View>
        </View>
      </View>)}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, gap: 12 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { color: colors.textPrimary, fontSize: 26, fontWeight: "800", textAlign: "right" }, explainer: { color: colors.textSecondary, lineHeight: 21, textAlign: "right" }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, padding: 16, gap: 9 }, highlightCard: { borderColor: colors.accent }, sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", textAlign: "right" }, label: { color: colors.textSecondary, textAlign: "right", marginTop: 3 }, input: { minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, paddingHorizontal: 12, color: colors.textPrimary, marginTop: 4 }, button: { minHeight: 42, borderRadius: 9, backgroundColor: colors.primary, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", marginTop: 6 }, ghostButton: { minHeight: 42, borderRadius: 9, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", marginTop: 6 }, ghostButtonText: { color: colors.accent, fontWeight: "700" }, disabled: { opacity: 0.45 }, buttonText: { color: "#FFFFFF", fontWeight: "700" }, link: { color: colors.accent, fontWeight: "700" }, error: { color: colors.error, textAlign: "right" }, success: { color: colors.success, textAlign: "right" }, inline: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" }, flex: { flex: 1 }, row: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, marginTop: 3, gap: 6 }, cardTitle: { color: colors.textPrimary, fontWeight: "700", textAlign: "right" }, commandText: { color: colors.accent, fontSize: 15, fontWeight: "700", textAlign: "left", backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, overflow: "hidden" }, detail: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: "right" }, previewRow: { flexDirection: "row-reverse", gap: 10, alignItems: "center" }, preview: { width: 84, height: 64, borderRadius: 8, backgroundColor: colors.surfaceElevated }, fileThumb: { alignItems: "center", justifyContent: "center" }, fileIcon: { color: colors.textMuted, fontWeight: "800", fontSize: 12 } });