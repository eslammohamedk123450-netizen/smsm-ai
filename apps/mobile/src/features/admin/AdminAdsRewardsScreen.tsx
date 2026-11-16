import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { PremiumText as Text } from "../../components/ui/PremiumText";
import { adminService } from "./admin-service";
import { useSulyTheme } from "../../theme/ThemeProvider";
import type { ThemePalette } from "../../theme/colors";

type AdSettings = { appId: string; rewardedUnitId: string; bannerUnitId: string };

export function AdminAdsRewardsScreen() {
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [settings, setSettings] = useState<AdSettings>({ appId: "", rewardedUnitId: "", bannerUnitId: "" });
  const [loading, setLoading] = useState(true);
  const [settingsAvailable, setSettingsAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setSettingsAvailable(false); setError(null);
    try { setSettings(await adminService.getAdMobSettings()); setSettingsAvailable(true); }
    catch (cause) { setSettingsAvailable(false); setError(cause instanceof Error ? cause.message : "تعذر تحميل إعدادات الإعلانات."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const update = (key: keyof AdSettings, value: string) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!settingsAvailable) { setError("لا يمكن حفظ الإعدادات قبل نجاح تحميل القيم الحالية."); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      await adminService.updateAdMobSettings(settings);
      setNotice("تم حفظ معرفات AdMob فقط. لم يتم تغيير الباقات أو أرصدة المستخدمين.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ إعدادات الإعلانات."); }
    finally { setSaving(false); }
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.heading}>
      <Text style={styles.title}>الإعلانات والمكافآت</Text>
      <Text style={styles.subtitle}>إدارة معرفات AdMob بصورة مستقلة عن تعديل الباقات والأسعار.</Text>
    </View>
    <View style={styles.noticeCard}>
      <Text style={styles.noticeTitle}>حدود البيانات الحالية</Text>
      <Text style={styles.noticeText}>هذه الصفحة تحفظ إعدادات التطبيق فقط. لا توجد حاليًا بيانات مؤكدة عن مرات الظهور أو الأرباح أو تسويات شبكة الإعلانات؛ لذلك لن تعرض إيرادات تقديرية على أنها أرباح فعلية.</Text>
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {notice ? <Text style={styles.success}>{notice}</Text> : null}
    {loading ? <ActivityIndicator color={colors.primary} /> : <View style={styles.card}>
      <Text style={styles.sectionTitle}>معرفات AdMob</Text>
      <Text style={styles.label}>AdMob App ID</Text>
      <TextInput value={settings.appId} onChangeText={(value) => update("appId", value)} editable={settingsAvailable && !saving} placeholder="ca-app-pub-…" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} style={styles.input} />
      <Text style={styles.label}>Rewarded Ad Unit ID</Text>
      <TextInput value={settings.rewardedUnitId} onChangeText={(value) => update("rewardedUnitId", value)} editable={settingsAvailable && !saving} placeholder="ca-app-pub-…/…" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} style={styles.input} />
      <Text style={styles.label}>Banner Ad Unit ID</Text>
      <TextInput value={settings.bannerUnitId} onChangeText={(value) => update("bannerUnitId", value)} editable={settingsAvailable && !saving} placeholder="ca-app-pub-…/…" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} style={styles.input} />
      <Pressable accessibilityRole="button" disabled={saving || loading || !settingsAvailable} onPress={() => void save()} style={[styles.button, (saving || loading || !settingsAvailable) && styles.disabled]}>
        <Text style={styles.buttonText}>{saving ? "جارٍ الحفظ…" : "حفظ إعدادات الإعلانات"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void load()} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>إعادة تحميل الإعدادات</Text>
      </Pressable>
    </View>}
  </ScrollView>;
}

const createStyles = (c: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12, maxWidth: 900, width: "100%", alignSelf: "center" },
  heading: { alignItems: "flex-end", gap: 4 },
  title: { color: c.textPrimary, fontSize: 21, fontWeight: "900", textAlign: "right" },
  subtitle: { color: c.textMuted, fontSize: 11, textAlign: "right" },
  noticeCard: { borderWidth: 1, borderColor: c.warning, borderRadius: 11, backgroundColor: c.surface, padding: 13, gap: 5 },
  noticeTitle: { color: c.warning, fontSize: 12, fontWeight: "900", textAlign: "right" },
  noticeText: { color: c.textSecondary, fontSize: 10, lineHeight: 18, textAlign: "right" },
  card: { borderWidth: 1, borderColor: c.divider, borderRadius: 12, backgroundColor: c.surface, padding: 14, gap: 9 },
  sectionTitle: { color: c.textPrimary, fontSize: 14, fontWeight: "900", textAlign: "right" },
  label: { color: c.textSecondary, fontSize: 11, fontWeight: "700", textAlign: "right" },
  input: { borderWidth: 1, borderColor: c.divider, borderRadius: 9, backgroundColor: c.background, color: c.textPrimary, padding: 11, fontSize: 12, textAlign: "left" },
  button: { minHeight: 42, borderRadius: 9, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  buttonText: { color: c.onPrimary, fontSize: 12, fontWeight: "800" },
  secondaryButton: { minHeight: 38, borderRadius: 9, borderWidth: 1, borderColor: c.divider, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: c.textPrimary, fontSize: 11, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  error: { color: c.error, fontSize: 11, textAlign: "right" },
  success: { color: c.success, fontSize: 11, textAlign: "right" },
});
