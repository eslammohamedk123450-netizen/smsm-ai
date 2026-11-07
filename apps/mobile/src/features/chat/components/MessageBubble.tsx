import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../../theme/colors";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming = false }: MessageBubbleProps) {
  const isUser = role === "user";
  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text selectable style={[styles.text, isUser ? styles.userText : styles.assistantText]}>{content || (isStreaming ? "…" : "")}</Text>
        {isStreaming && <View style={styles.pulse} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", marginVertical: 6, paddingHorizontal: 16 },
  userRow: { alignItems: "flex-end" },
  assistantRow: { alignItems: "flex-start" },
  bubble: { maxWidth: "85%", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  userBubble: { backgroundColor: colors.primary },
  assistantBubble: { backgroundColor: colors.surface },
  text: { fontSize: 16, lineHeight: 24 },
  userText: { color: "#FFFFFF" },
  assistantText: { color: colors.textPrimary },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 8 },
});
