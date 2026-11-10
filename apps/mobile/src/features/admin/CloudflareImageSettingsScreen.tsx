import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { adminService } from "./admin-service";
import { colors } from "../../theme/colors";

function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function CloudflareImageSettingsScreen() {
  const [accountId, setAccountId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [creditsPerImage, setCreditsPerImage] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const config = await adminService.getCloudflareImageSettings();
      setAccountId(config.accountId);
      setTokenConfigured(config.tokenConfigured);
      setEnabled(config.enabled);
      setCreditsPerImage(String(config.creditsPerImage));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل إعدادات توليد الصور.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    const account = accountId.trim().toLowerCase();
    const cost = Number(creditsPerImage.trim());
    if (!/^[0-9a-f]{32}$/.test(account)) {
      setError("أدخل Cloudflare Account ID صحيحًا مكوّنًا من 32 خانة hex.");
      return;
    }
    if (!Number.isSafeInteger(cost) || cost < 1 || cost > 1_000_000_000) {
      setError("تكلفة الصورة يجب أن تكون عددًا صحيحًا بين 1 ومليار رصيد.");
      return;
    }
    if (enabled && !tokenConfigured && !apiToken.trim()) {
      setError("أدخل API Token قبل تفعيل التوليد.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await adminService.saveCloudflareImageSettings({
        accountId: account,
        apiToken: apiToken.trim() || null,
        enabled,
        creditsPerImage: cost,
      });
      setTokenConfigured(saved.tokenConfigured);
      setApiToken("");
      setNotice("تم حفظ الإعدادات. رمز API محفوظ في Vault ولا يمكن عرضه من التطبيق.");
    } catch (cause) {
      setApiToken("");
      setError(cause instanceof Error ? cause.message : "تعذر حفظ إعدادات Cloudflare بأمان.");
    } finally {
      setSaving(false);
    }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <Link href="/admin" asChild><TouchableOpacity activeOpacity={0.7}><Text style={styles.back}>‹ لوحة المشرف</Text></TouchableOpacity></Link>
      <Text style={styles.title}>توليد الصور · Cloudflare</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.description}>يُرسل طلب إنشاء الصورة من الخادم إلى Cloudflare Workers AI باستخدام نموذج FLUX.1 Schnell. لا يُرسل رمز API إلى المستخدمين ولا يُحفظ في التطبيق.</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : <>
        <FieldLabel>Cloudflare Account ID</FieldLabel>
        <TextInput value={accountId} onChangeText={setAccountId} style={styles.input} placeholder="32 خانة hex" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} maxLength={32} />
        <FieldLabel>Cloudflare API Token {tokenConfigured ? "(اختياري للتدوير)" : ""}</FieldLabel>
        <Text style={styles.hint}>أنشئ رمزًا بصلاحية Workers AI Read فقط. قيمة الرمز لا تُسترجع بعد الحفظ؛ اترك الحقل فارغًا للإبقاء على الرمز الحالي.</Text>
        <TextInput value={apiToken} onChangeText={setApiToken} style={styles.input} placeholder={tokenConfigured ? "الرمز محفوظ · أدخل جديدًا للتغيير" : "الصق API Token هنا"} placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <FieldLabel>تكلفة إنشاء صورة واحدة (أرصدة)</FieldLabel>
        <TextInput value={creditsPerImage} onChangeText={setCreditsPerImage} style={styles.input} keyboardType="number-pad" maxLength={10} />
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>تفعيل توليد الصور للمستخدمين</Text>
          <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: colors.divider, true: colors.primary }} thumbColor="#FFFFFF" />
        </View>
        <Text style={styles.status}>حالة الرمز: {tokenConfigured ? "محفوظ بأمان" : "غير مضاف"}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <TouchableOpacity disabled={saving} onPress={() => void save()} activeOpacity={0.7} style={[styles.button, saving && styles.disabled]}>
          {saving ? <ActivityIndicator color="#07120D" /> : <Text style={styles.buttonText}>حفظ إعدادات توليد الصور</Text>}
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
  hint: { color: colors.textMuted, fontSize: 10, lineHeight: 17, textAlign: "right" },
  input: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background, color: colors.textPrimary, textAlign: "left", fontSize: 13 },
  toggleRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },
  toggleLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: "700", textAlign: "right" },
  status: { color: colors.textMuted, fontSize: 10, textAlign: "right" },
  error: { color: colors.error, fontSize: 11, textAlign: "right" },
  notice: { color: colors.success, fontSize: 11, textAlign: "right" },
  button: { minHeight: 46, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  buttonText: { color: "#07120D", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.6 },
});
