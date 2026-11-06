import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../../theme/colors";

export interface ChatErrorBannerProps {
  error: string | null;
  onDismiss(): void;
}

export function ChatErrorBanner({ error, onDismiss }: ChatErrorBannerProps) {
  if (!error) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.message}>{error}</Text>
      <Pressable style={styles.dismiss} onPress={onDismiss} accessibilityRole="button"><Text style={styles.dismissText}>إغلاق</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12, marginTop: 8, borderRadius: 10, backgroundColor: "#451A25", borderWidth: 1, borderColor: colors.error },
  message: { flex: 1, color: colors.textPrimary, fontSize: 13, textAlign: "right" },
  dismiss: { padding: 4 },
  dismissText: { color: colors.accent },
});
