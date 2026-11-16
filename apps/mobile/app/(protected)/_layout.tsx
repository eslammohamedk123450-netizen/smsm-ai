import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../../src/components/ui/PremiumText";
import { MainNavigation } from "../../src/components/navigation/MainNavigation";
import { useAuth } from "../../src/features/auth/auth-provider";
import { useSulyTheme } from "../../src/theme/ThemeProvider";

export default function ProtectedLayout() {
  const { user, status, configurationError } = useAuth();
  const { colors } = useSulyTheme();

  if (status === "loading") {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.textPrimary} /></View>;
  }
  if (status === "misconfigured") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.error }]}>إعداد التطبيق غير مكتمل</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>{configurationError}</Text>
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  return <MainNavigation><Slot /></MainNavigation>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 10 },
  errorTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  message: { textAlign: "center", maxWidth: 500, lineHeight: 22 },
});
