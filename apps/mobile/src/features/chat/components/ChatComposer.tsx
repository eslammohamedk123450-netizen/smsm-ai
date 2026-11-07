import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, Text } from "react-native";
import { colors } from "../../../theme/colors";

export interface ChatComposerProps {
  onSend(content: string): void;
  disabled?: boolean;
  isStreaming?: boolean;
  onCancel?(): void;
}

export function ChatComposer({ onSend, disabled = false, isStreaming = false, onCancel }: ChatComposerProps) {
  const [text, setText] = useState("");
  const submit = () => {
    const content = text.trim();
    if (!content || disabled) return;
    onSend(content);
    setText("");
  };
  return (
    <View style={styles.container}>
      <Pressable style={styles.iconButton}><Text style={styles.icon}>📎</Text></Pressable>
      <TextInput
        value={text}
        onChangeText={setText}
        editable={!disabled}
        placeholder="رسالة لـ Suly…"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
      />
      <Pressable style={styles.iconButton}><Text style={styles.icon}>🎤</Text></Pressable>
      {isStreaming ? (
        <Pressable style={[styles.button, styles.cancel]} onPress={onCancel}><Text style={styles.buttonText}>■</Text></Pressable>
      ) : (
        <Pressable style={[styles.button, { backgroundColor: text.trim() ? colors.primary : colors.surfaceElevated }]} onPress={submit} disabled={disabled || !text.trim()}><Text style={styles.buttonText}>➤</Text></Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: colors.background },
  input: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary, paddingHorizontal: 20, paddingVertical: 12 },
  iconButton: { padding: 8 },
  icon: { fontSize: 20, color: colors.textSecondary },
  button: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  cancel: { backgroundColor: colors.error },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
});
