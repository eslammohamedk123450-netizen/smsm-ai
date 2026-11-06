import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../../src/features/auth/auth-provider";
import { colors } from "../../src/theme/colors";

export default function ProtectedLayout() {
  const { user, status } = useAuth();
  if (status === "loading") {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (status === "misconfigured") return <Redirect href="/" />;
  if (!user) return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background } });
