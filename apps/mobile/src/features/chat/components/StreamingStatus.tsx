import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../../theme/colors";

export interface StreamingStatusProps {
  isStreaming: boolean;
  onCancel?(): void;
}

export function StreamingStatus({ isStreaming, onCancel }: StreamingStatusProps) {
  if (!isStreaming) return null;
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={colors.accent} />
      <Text style={styles.text}>جارٍ توليد الرد…</Text>
      <Pressable onPress={onCancel} accessibilityRole="button"><Text style={styles.cancel}>إلغاء</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 7 },
  text: { color: colors.textSecondary, fontSize: 12 },
  cancel: { color: colors.error, fontSize: 12, fontWeight: "700" },
});
