import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/features/auth/auth-provider";
import { colors } from "../../src/theme/colors";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doLogout = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await logout(); router.replace("/login"); }
    catch { setError("تعذر تسجيل الخروج. حاول مجددًا."); }
    finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title}>الإعدادات</Text>
        <View style={styles.card}>
          <Text style={styles.label}>الحساب</Text>
          <Text selectable style={styles.value}>{user?.email ?? ""}</Text>
          {typeof user?.user_metadata?.full_name === "string" && <><Text style={styles.label}>الاسم</Text><Text style={styles.value}>{user.user_metadata.full_name}</Text></>}
        </View>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable style={styles.button} onPress={() => void doLogout()} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>تسجيل الخروج</Text>}
        </Pressable>
        <Pressable style={styles.back} onPress={() => router.replace("/chat")}><Text style={styles.link}>العودة إلى الدردشة</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 20 },
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "700", textAlign: "right", marginBottom: 18 },
  card: { padding: 20, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  label: { color: colors.textSecondary, marginBottom: 6, textAlign: "right" },
  value: { color: colors.textPrimary, fontSize: 16, marginBottom: 18, textAlign: "right" },
  error: { color: colors.error, marginTop: 12, textAlign: "right" },
  button: { minHeight: 48, backgroundColor: colors.error, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 18 },
  buttonText: { color: colors.textPrimary, fontWeight: "700" },
  back: { alignItems: "center", padding: 16 },
  link: { color: colors.accent },
});
