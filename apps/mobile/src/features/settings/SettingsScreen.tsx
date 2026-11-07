import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, Switch } from "react-native";
import { useAuth } from "../auth/auth-provider";
import { colors } from "../../theme/colors";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>الإعدادات</Text>
      
      <Text style={styles.sectionTitle}>الحساب</Text>
      <View style={styles.card}>
        <View style={styles.avatarPlaceholder} />
        <View>
            <Text style={styles.userName}>{user?.user_metadata?.full_name || "مستخدم"}</Text>
            <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>المظهر</Text>
      <View style={styles.card}>
        <Text style={styles.text}>الوضع الغامق</Text>
        <Switch value={isDarkMode} onValueChange={setIsDarkMode} trackColor={{true: colors.primary}} />
      </View>

      <Text style={styles.sectionTitle}>اللغة</Text>
      <View style={styles.card}>
        <Text style={styles.text}>العربية</Text>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => logout()}><Text style={styles.logoutText}>تسجيل الخروج</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  header: { fontSize: 24, fontWeight: "800", color: colors.textPrimary, marginBottom: 24 },
  sectionTitle: { color: colors.textSecondary, marginBottom: 12, marginTop: 24 },
  card: { padding: 16, borderRadius: 12, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surfaceElevated },
  userName: { color: colors.textPrimary, fontWeight: "700" },
  email: { color: colors.textSecondary },
  text: { color: colors.textPrimary, flex: 1 },
  logoutButton: { padding: 16, borderRadius: 12, backgroundColor: colors.error, marginTop: 40, alignItems: "center" },
  logoutText: { color: "#FFFFFF", fontWeight: "700" }
});
