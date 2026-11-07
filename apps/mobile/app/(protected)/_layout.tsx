import { Redirect, Drawer } from "expo-router/drawer";
import { ActivityIndicator, StyleSheet, View, Text, TextInput, Pressable } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { colors } from "../../src/theme/colors";

function CustomDrawerContent() {
  return (
    <View style={styles.drawerContainer}>
      <Pressable style={styles.newChatButton}><Text style={styles.newChatText}>＋ محادثة جديدة</Text></Pressable>
      <TextInput placeholder="بحث في المحادثات…" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
      {/* Conversation List will go here */}
      <View style={styles.drawerFooter}>
        <Pressable><Text style={styles.footerText}>الإعدادات</Text></Pressable>
        <Text style={styles.userName}>اسم المستخدم</Text>
      </View>
    </View>
  );
}

export default function ProtectedLayout() {
  const { user, status } = useAuth();
  if (status === "loading") {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <Drawer drawerContent={() => <CustomDrawerContent />} screenOptions={{ headerShown: false, drawerStyle: { backgroundColor: colors.background } }} />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  drawerContainer: { flex: 1, padding: 16, backgroundColor: colors.background },
  newChatButton: { padding: 16, borderRadius: 12, backgroundColor: colors.primary, marginBottom: 16 },
  newChatText: { color: "#FFFFFF", fontWeight: "700", textAlign: "center" },
  searchInput: { padding: 12, borderRadius: 8, backgroundColor: colors.surface, color: colors.textPrimary, marginBottom: 16 },
  drawerFooter: { marginTop: "auto", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 },
  footerText: { color: colors.textPrimary, marginBottom: 8 },
  userName: { color: colors.textSecondary }
});
