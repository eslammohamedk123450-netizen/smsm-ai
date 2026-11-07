import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
      <TextInput
        value={text}
        onChangeText={setText}
        editable={!disabled}
        placeholder="اكتب رسالتك…"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
        maxLength={16000}
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={submit}
        accessibilityLabel="رسالة الدردشة"
      />
      {isStreaming ? (
        <Pressable style={[styles.button, styles.cancel]} onPress={onCancel} accessibilityRole="button"><Text style={styles.buttonText}>إيقاف</Text></Pressable>
      ) : (
        <Pressable style={[styles.button, disabled && styles.disabled]} onPress={submit} disabled={disabled || !text.trim()} accessibilityRole="button"><Text style={styles.buttonText}>إرسال</Text></Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.background },
  input: { flex: 1, minHeight: 48, maxHeight: 140, borderRadius: 999, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.textPrimary, paddingHorizontal: 20, paddingVertical: 12, textAlignVertical: "center" },
  button: { height: 48, paddingHorizontal: 20, borderRadius: 999, justifyContent: "center", alignItems: "center", backgroundColor: colors.primary },
  cancel: { backgroundColor: colors.error },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.textPrimary, fontWeight: "700" },
});
