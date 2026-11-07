import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/auth-provider";
import { useIsAdmin } from "../admin/use-is-admin";
import { supabase } from "../../lib/supabase/client";
import { colors } from "../../theme/colors";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [himsActivated, setHimsActivated] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setHimsActivated(false);
    if (user?.id) {
      void (async () => {
        try {
          const { data, error: profileError } = await supabase.from("suly_profiles").select("hims_activated").eq("id", user.id).maybeSingle();
          if (active) setHimsActivated(!profileError && data?.hims_activated === true);
        } catch {
          if (active) setHimsActivated(false);
        }
      })();
    }
    return () => { active = false; };
  }, [user?.id]));
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
    {himsActivated && <View style={styles.badge} accessibilityRole="text"><Text style={styles.badgeTitle}>شارة HIMS المتميزة</Text><Text style={styles.badgeText}>نظام الدراسة الذكي مفعّل على حسابك</Text></View>}
    {isAdmin ? <Link href="/admin" asChild><Pressable style={styles.adminButton} accessibilityRole="button"><Text style={styles.adminButtonText}>لوحة التحكم</Text></Pressable></Link> : null}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable style={styles.button} onPress={() => void handleLogout()} disabled={busy}>{busy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>تسجيل الخروج</Text>}</Pressable>
    <Pressable style={styles.backButton} onPress={() => router.replace("/chat")}><Text style={styles.backButtonText}>العودة إلى الدردشة</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 24, color: colors.textPrimary, textAlign: "right" },
  label: { fontSize: 14, color: colors.textSecondary, marginBottom: 6, textAlign: "right" },
  value: { fontSize: 16, color: colors.textPrimary, marginBottom: 16, textAlign: "right" },
  badge: { borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 14, marginBottom: 16, alignItems: "flex-end" },
  badgeTitle: { color: colors.accent, fontSize: 16, fontWeight: "700", textAlign: "right" },
  badgeText: { color: colors.textSecondary, marginTop: 4, textAlign: "right" },
  error: { color: colors.error, marginBottom: 12, textAlign: "right" },
  adminButton: { minHeight: 48, borderRadius: 10, backgroundColor: colors.surfaceElevated, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  adminButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  button: { minHeight: 48, borderRadius: 10, backgroundColor: colors.error, justifyContent: "center", alignItems: "center", marginTop: 16 },
  buttonText: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  backButton: { minHeight: 48, justifyContent: "center", alignItems: "center", marginTop: 8 },
  backButtonText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
});
