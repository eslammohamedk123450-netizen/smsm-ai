import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/auth-provider";
import { useIsAdmin } from "../admin/use-is-admin";
import { colors } from "../../theme/colors";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Assume HIMS status is enabled for this UI update
  const isHimsEnabled = true; 

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await logout(); router.replace("/login"); }
    catch { setError("تعذر تسجيل الخروج. حاول مرة أخرى."); }
    finally { setBusy(false); }
  };
  return <View style={styles.container}>
    <Text style={styles.title}>الإعدادات</Text>
    
    <View style={styles.section}>
      <Text style={styles.label}>حالة النظام (HIMS)</Text>
      <View style={[styles.badge, { backgroundColor: isHimsEnabled ? colors.primary + "20" : "#334155" }]}>
        <Text style={[styles.badgeText, { color: isHimsEnabled ? colors.primary : colors.textSecondary }]}>
            {isHimsEnabled ? "مفعل (Active)" : "معطل (Inactive)"}
        </Text>
      </View>
    </View>

    <Text style={styles.label}>الحساب</Text>
    <Text selectable style={styles.value}>{user?.email ?? ""}</Text>
    {typeof user?.user_metadata?.full_name === "string" && <Text style={styles.value}>{user.user_metadata.full_name}</Text>}
    {isAdmin ? <Link href="/admin" asChild><Pressable style={styles.adminButton} accessibilityRole="button"><Text style={styles.adminButtonText}>لوحة التحكم</Text></Pressable></Link> : null}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable style={styles.button} onPress={() => void handleLogout()} disabled={busy}>{busy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>تسجيل الخروج</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 24, color: colors.textPrimary, textAlign: "right" },
  section: { marginBottom: 24, alignItems: "flex-end" },
  label: { fontSize: 14, color: colors.textSecondary, marginBottom: 8, textAlign: "right" },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.primary },
  badgeText: { fontWeight: "700", fontSize: 12 },
  value: { fontSize: 16, color: colors.textPrimary, marginBottom: 16, textAlign: "right" },
  error: { color: colors.error, marginBottom: 12, textAlign: "right" },
  adminButton: { minHeight: 48, borderRadius: 10, backgroundColor: colors.surfaceElevated, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  adminButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  button: { minHeight: 48, borderRadius: 10, backgroundColor: colors.error, justifyContent: "center", alignItems: "center", marginTop: 16 },
  buttonText: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
});
