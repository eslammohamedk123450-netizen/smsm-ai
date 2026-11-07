import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/auth-provider";
import { useIsAdmin } from "../admin/use-is-admin";
import { ACTIVATION_HINT, getMyFeatures, type FeatureEntry } from "../features/feature-service";
import { colors } from "../../theme/colors";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureEntry[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await getMyFeatures();
        if (active) setFeatures(list);
      } finally {
        if (active) setFeaturesLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await logout(); router.replace("/login"); }
    catch { setError("تعذر تسجيل الخروج. حاول مرة أخرى."); }
    finally { setBusy(false); }
  };
  return <View style={styles.container}>
    <Text style={styles.title}>الإعدادات</Text>
    <Text style={styles.label}>الحساب</Text>
    <Text selectable style={styles.value}>{user?.email ?? ""}</Text>
    {typeof user?.user_metadata?.full_name === "string" && <Text style={styles.value}>{user.user_metadata.full_name}</Text>}
    <Text style={styles.label}>الميزات</Text>
    {featuresLoading
      ? <ActivityIndicator color={colors.textPrimary} style={styles.loading} />
      : features.length === 0
        ? <Text style={styles.hint}>{ACTIVATION_HINT}</Text>
        : <>
          {features.map((feature) => <View key={feature.key} style={styles.featureRow}>
            <Text style={styles.featureLabel}>{feature.label}</Text>
            <Text style={[styles.featureState, feature.activated ? styles.featureOn : styles.featureOff]}>
              {feature.activated ? "مفعّلة" : "غير مفعّلة"}
            </Text>
          </View>)}
          {features.some((feature) => !feature.activated) && <Text style={styles.hint}>{ACTIVATION_HINT}</Text>}
        </>}
    {isAdmin ? <Link href="/admin" asChild><Pressable style={styles.adminButton} accessibilityRole="button"><Text style={styles.adminButtonText}>لوحة التحكم</Text></Pressable></Link> : null}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable style={styles.button} onPress={() => void handleLogout()} disabled={busy}>{busy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>تسجيل الخروج</Text>}</Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 24, color: colors.textPrimary, textAlign: "right" },
  label: { fontSize: 14, color: colors.textSecondary, marginBottom: 6, textAlign: "right" },
  value: { fontSize: 16, color: colors.textPrimary, marginBottom: 16, textAlign: "right" },
  loading: { marginBottom: 16 },
  featureRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  featureLabel: { fontSize: 15, color: colors.textPrimary, flexShrink: 1, textAlign: "right" },
  featureState: { fontSize: 14, fontWeight: "600" },
  featureOn: { color: colors.accent },
  featureOff: { color: colors.textSecondary },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 12, marginBottom: 8, textAlign: "right" },
  error: { color: colors.error, marginBottom: 12, textAlign: "right" },
  adminButton: { minHeight: 48, borderRadius: 10, backgroundColor: colors.surfaceElevated, justifyContent: "center", alignItems: "center", marginBottom: 12, marginTop: 12 },
  adminButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  button: { minHeight: 48, borderRadius: 10, backgroundColor: colors.error, justifyContent: "center", alignItems: "center", marginTop: 16 },
  buttonText: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
});
