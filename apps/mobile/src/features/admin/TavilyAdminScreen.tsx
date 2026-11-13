import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { adminService } from "./admin-service";
import { colors } from "../../theme/colors";

export function TavilyAdminScreen() {
  const [configured, setConfigured] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void adminService.getTavilyStatus().then((status) => setConfigured(status.configured)).catch((cause) => setError(cause instanceof Error ? cause.message : "تعذر قراءة حالة Tavily.")).finally(() => setLoading(false)); }, []);
  const save = async () => {
    const value = apiKey.trim();
    if (!/^tvly\S+$/i.test(value)) { setError("مفتاح Tavily يجب أن يبدأ بـ tvly."); return; }
    setSaving(true); setError(null); setNotice(null);
    try { await adminService.saveTavilyApiKey(value); setApiKey(""); setConfigured(true); setNotice("تم حفظ مفتاح Tavily داخل Supabase Vault. لن يظهر مرة أخرى."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ مفتاح Tavily."); }
    finally { setSaving(false); }
  };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Tavily Web Search</Text>
    <Text style={styles.explainer}>يُستخدم هذا المفتاح فقط عندما يطلب المستخدم بحثًا على الإنترنت من وضع Agent. لا يُرسل إلى التطبيق ولا يُستخدم في المحادثة العادية.</Text>
    <View style={styles.card}><View style={styles.headerRow}><View style={styles.badge}><Text style={styles.badgeText}>T</Text></View><View style={styles.headerCopy}><Text style={styles.sectionTitle}>مفتاح API</Text><Text style={styles.detail}>{loading ? "جارٍ التحقق…" : configured ? "مفتاح محفوظ وآمن" : "لم تتم الإضافة بعد"}</Text></View>{loading ? <ActivityIndicator color={colors.primary} /> : <Text style={configured ? styles.ready : styles.pending}>{configured ? "مُضاف" : "غير مُضاف"}</Text>}</View>
      <Text style={styles.label}>المفتاح الجديد</Text><TextInput value={apiKey} onChangeText={setApiKey} style={styles.input} placeholder={configured ? "tvly… للاستبدال" : "tvly…"} placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="password" />
      <Text style={styles.detail}>يُقبل فقط مفتاح يبدأ بـ tvly، وتُحفظ قيمته داخل Vault المشفّر.</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.success}>{notice}</Text> : null}
      <Pressable onPress={() => void save()} disabled={saving || !apiKey.trim()} style={[styles.button, (saving || !apiKey.trim()) && styles.disabled]}><Text style={styles.buttonText}>{saving ? "جارٍ الحفظ…" : "حفظ المفتاح بأمان"}</Text></Pressable>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, gap: 14 }, title: { color: colors.textPrimary, fontSize: 24, fontWeight: "800", textAlign: "right" }, explainer: { color: colors.textSecondary, textAlign: "right", lineHeight: 22, fontSize: 13 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 14, gap: 12 }, headerRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 }, badge: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#082F49", borderWidth: 1, borderColor: "#164E63", alignItems: "center", justifyContent: "center" }, badgeText: { color: "#38BDF8", fontSize: 20, fontWeight: "900" }, headerCopy: { flex: 1, alignItems: "flex-end", gap: 3 }, sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", textAlign: "right" }, detail: { color: colors.textMuted, fontSize: 12, lineHeight: 19, textAlign: "right" }, ready: { color: colors.success, fontSize: 12, fontWeight: "700" }, pending: { color: colors.warning, fontSize: 12, fontWeight: "700" }, label: { color: colors.textSecondary, fontSize: 13, textAlign: "right" }, input: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background, color: colors.textPrimary, paddingHorizontal: 12, textAlign: "left", fontSize: 14 }, button: { minHeight: 46, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 4 }, disabled: { opacity: 0.55 }, buttonText: { color: "#06110D", fontWeight: "800", fontSize: 14 }, error: { color: colors.error, textAlign: "right", lineHeight: 20 }, success: { color: colors.success, textAlign: "right", lineHeight: 20 } });
