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
        {isStreaming && <Text style={styles.streaming}>جارٍ الكتابة…</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", marginVertical: 5, paddingHorizontal: 4 },
  userRow: { alignItems: "flex-end" },
  assistantRow: { alignItems: "flex-start" },
  bubble: { maxWidth: "88%", borderRadius: 16, paddingHorizontal: 15, paddingVertical: 12 },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  assistantBubble: { backgroundColor: colors.surface, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.divider },
  text: { fontSize: 15, lineHeight: 23, textAlign: "auto" },
  userText: { color: colors.textPrimary },
  assistantText: { color: colors.textPrimary },
  streaming: { color: colors.textMuted, fontSize: 11, marginTop: 6, textAlign: "right" },
});
