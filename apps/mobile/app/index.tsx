import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { PremiumText as Text } from "../src/components/ui/PremiumText";
import { useAuth } from "../src/features/auth/auth-provider";
import { colors } from "../src/theme/colors";

export default function HomeRoute() {
  const { user, status, configurationError } = useAuth();
  if (status === "loading") {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (status === "misconfigured") {
    return <View style={styles.center}><Text style={styles.errorTitle}>إعداد التطبيق غير مكتمل</Text><Text style={styles.text}>{configurationError}</Text></View>;
  }
  return <Redirect href={user ? "/chat" : "/login"} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: colors.background },
  errorTitle: { color: colors.error, fontSize: 20, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  text: { color: colors.textSecondary, textAlign: "center", maxWidth: 500 },
});
