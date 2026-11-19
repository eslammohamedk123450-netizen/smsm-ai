import { useMemo, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";
import { AdminMobileBreadcrumb } from "./AdminMobileBreadcrumb";
import { useAppLocale } from "../../theme/LocaleProvider";

export function ComposioAdminScreen() {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [configured, setConfigured] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusAvailable, setStatusAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true); setStatusAvailable(false); setError(null);
    try { const status = await adminService.getComposioStatus(); setConfigured(status.configured); setStatusAvailable(true); }
    catch (cause) { setStatusAvailable(false); setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر قراءة حالة Composio." : "Could not read Composio status.")); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadStatus(); }, []);

  const save = async () => {
    if (!statusAvailable) { setError((isArabic ? "أعد التحقق من الحالة الحالية قبل استبدال المفتاح." : "Refresh the current status before replacing the key.")); return; }
    if (!apiKey.trim()) { setError((isArabic ? "أدخل مفتاح Composio أولاً." : "Enter a Composio key first.")); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      await adminService.saveComposioApiKey(apiKey);
      setApiKey(""); setConfigured(true); setNotice((isArabic ? "تم حفظ المفتاح داخل Supabase Vault. لن يتم عرضه مرة أخرى." : "Key saved in Supabase Vault. It will not be shown again."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : (isArabic ? "تعذر حفظ مفتاح Composio." : "Could not save the Composio key.")); }
    finally { setSaving(false); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <AdminMobileBreadcrumb />
    <Text style={styles.title}>Composio Platform</Text>
    <Text style={styles.explainer}>{isArabic ? "أضف مفتاح Composio من لوحة الإدارة. لا يُحفظ المفتاح داخل التطبيق ولا يظهر بعد الحفظ، ويُستخدم لاحقًا لإنشاء جلسات أدوات المستخدمين." : "Add the Composio key from the admin panel. It is never stored in the client or shown after saving, and is used to create user tool sessions."}</Text>
    <View style={styles.card}>
      <View style={styles.headerRow}><View style={styles.badge}><Text style={styles.badgeText}>C</Text></View><View style={styles.headerCopy}><Text style={styles.sectionTitle}>{isArabic ? "مفتاح API" : "API key"}</Text><Text style={styles.detail}>{loading ? (isArabic ? "جارٍ التحقق…" : "Checking…") : !statusAvailable ? (isArabic ? "تعذر التحقق من الحالة" : "Could not verify status") : configured ? (isArabic ? "مفتاح محفوظ وآمن" : "Key saved securely") : (isArabic ? "لم تتم الإضافة بعد" : "Not configured yet")}</Text></View>{loading ? <ActivityIndicator color={colors.primary} /> : <Text style={statusAvailable ? (configured ? styles.ready : styles.pending) : styles.pending}>{!statusAvailable ? (isArabic ? "غير معروف" : "Unknown") : configured ? (isArabic ? "مُضاف" : "Added") : (isArabic ? "غير مُضاف" : "Not added")}</Text>}</View>
      <Text style={styles.label}>{isArabic ? "المفتاح الجديد" : "New key"}</Text>
      <TextInput value={apiKey} onChangeText={setApiKey} style={styles.input} placeholder={configured ? (isArabic ? "أدخل مفتاحًا جديدًا للاستبدال" : "Enter a new key to replace it") : "ak_…"} placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="password" />
      <Text style={styles.detail}>{isArabic ? "لن يتم عرض القيمة الحالية أو إرسالها إلى الواجهة بعد الحفظ." : "The current value will never be displayed or sent to the client after saving."}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.success}>{notice}</Text> : null}
      <Pressable onPress={() => void save()} disabled={saving || loading || !statusAvailable || !apiKey.trim()} style={[styles.button, (saving || loading || !statusAvailable || !apiKey.trim()) && styles.disabled]}><Text style={styles.buttonText}>{saving ? (isArabic ? "جارٍ الحفظ…" : "Saving…") : (isArabic ? "حفظ المفتاح بأمان" : "Save key securely")}</Text></Pressable>
      <Pressable onPress={() => void loadStatus()} disabled={loading || saving} style={styles.secondaryButton}><Text style={styles.secondaryText}>{isArabic ? "إعادة التحقق من الحالة" : "Refresh status"}</Text></Pressable>
    </View>
  </ScrollView>;
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, gap: 14 }, title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800", textAlign: isArabic ? "right" : "left" }, explainer: { color: colors.textSecondary, textAlign: "right", lineHeight: 22, fontSize: 13 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 14, gap: 12 }, headerRow: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10 }, badge: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#082F49", borderWidth: 1, borderColor: "#164E63", alignItems: "center", justifyContent: "center" }, badgeText: { color: "#38BDF8", fontSize: 20, fontWeight: "900" }, headerCopy: { flex: 1, alignItems: "flex-end", gap: 3 }, sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", textAlign: "right" }, detail: { color: colors.textMuted, fontSize: 12, lineHeight: 19, textAlign: "right" }, ready: { color: colors.success, fontSize: 12, fontWeight: "700" }, pending: { color: colors.warning, fontSize: 12, fontWeight: "700" }, label: { color: colors.textSecondary, fontSize: 13, textAlign: "right" }, input: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background, color: colors.textPrimary, paddingHorizontal: 12, textAlign: "left", fontSize: 14 }, button: { minHeight: 46, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 4 }, secondaryButton: { minHeight: 38, borderRadius: 9, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" }, secondaryText: { color: colors.textPrimary, fontSize: 11, fontWeight: "700" }, disabled: { opacity: 0.55 }, buttonText: { color: colors.onPrimary, fontWeight: "800", fontSize: 14 }, error: { color: colors.error, textAlign: "right", lineHeight: 20 }, success: { color: colors.success, textAlign: "right", lineHeight: 20 },
});
