import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { adminService } from "./admin-service";
import { colors } from "../../theme/colors";

function encodeCredentialPart(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function CloudinarySettingsScreen() {
  const [cloudName, setCloudName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void adminService.getCloudinaryStatus()
      .then((status) => setConfigured(status.configured))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "تعذر تحميل حالة Cloudinary."))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const cloud = cloudName.trim();
    const key = apiKey.trim();
    const secret = apiSecret.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(cloud)) { setError("أدخل Cloud Name صحيحًا من لوحة Cloudinary."); return; }
    if (!key || !secret) { setError("أدخل API Key وAPI Secret معًا."); return; }
    if (key.length > 512 || secret.length > 1024) { setError("إحدى قيم الاعتماد أطول من الحد المسموح."); return; }
    const credentialUrl = `cloudinary://${encodeCredentialPart(key)}:${encodeCredentialPart(secret)}@${cloud}`;
    setSaving(true); setError(null); setNotice(null);
    try {
      await adminService.saveCloudinaryUrl(credentialUrl);
      setConfigured(true); setApiKey(""); setApiSecret("");
      setNotice("تم حفظ إعداد Cloudinary داخل Supabase Vault. لن تظهر المفاتيح مرة أخرى.");
    } catch (cause) {
      setApiKey(""); setApiSecret("");
      setError(cause instanceof Error ? cause.message : "تعذر حفظ إعداد Cloudinary بأمان.");
    } finally { setSaving(false); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <Link href="/admin" asChild><TouchableOpacity activeOpacity={0.7}><Text style={styles.back}>‹ لوحة المشرف</Text></TouchableOpacity></Link>
      <Text style={styles.title}>التخزين · Cloudinary</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.description}>أدخل بيانات Cloudinary مرة واحدة. تُحفظ في Supabase Vault ويستخدمها الخادم لتوقيع الرفع والتحقق من الملفات وإصدار روابط عرض خاصة. لا يُرسل API Secret إلى التطبيق أو المستخدمين.</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : <>
        <Text style={styles.label}>Cloud Name</Text>
        <TextInput value={cloudName} onChangeText={setCloudName} style={styles.input} placeholder="اسم السحابة" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} />
        <Text style={styles.label}>API Key</Text>
        <TextInput value={apiKey} onChangeText={setApiKey} style={styles.input} placeholder={configured ? "محفوظ · أدخل القيمة الجديدة للتدوير" : "مفتاح Cloudinary"} placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <Text style={styles.label}>API Secret</Text>
        <TextInput value={apiSecret} onChangeText={setApiSecret} style={styles.input} placeholder={configured ? "محفوظ · أدخل القيمة الجديدة للتدوير" : "سر Cloudinary"} placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <Text style={styles.status}>الحالة: {configured ? "مُضاف بأمان" : "لم تتم الإضافة"}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <TouchableOpacity disabled={saving} onPress={() => void save()} activeOpacity={0.7} style={[styles.button, saving && styles.disabled]}>
          {saving ? <ActivityIndicator color="#07120D" /> : <Text style={styles.buttonText}>{configured ? "حفظ واستبدال المفاتيح" : "حفظ المفاتيح بأمان"}</Text>}
        </TouchableOpacity>
      </>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, maxWidth: 780, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  back: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "900", textAlign: "right" },
  card: { padding: 16, gap: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  description: { color: colors.textSecondary, fontSize: 12, lineHeight: 20, textAlign: "right" },
  label: { color: colors.textPrimary, fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 4 },
  input: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background, color: colors.textPrimary, textAlign: "left", fontSize: 13 },
  status: { color: colors.textMuted, fontSize: 10, textAlign: "right" },
  error: { color: colors.error, fontSize: 11, textAlign: "right" },
  notice: { color: colors.success, fontSize: 11, textAlign: "right" },
  button: { minHeight: 46, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  buttonText: { color: "#07120D", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.6 },
});
