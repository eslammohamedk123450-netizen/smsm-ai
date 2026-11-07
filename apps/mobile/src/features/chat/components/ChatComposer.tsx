import { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { colors } from "../../../theme/colors";
import { pickMedia, type PickedMedia } from "../../media/media-service";

export type ChatAttachment = PickedMedia;
export interface ChatComposerProps {
  onSend(content: string, attachment?: ChatAttachment): void;
  disabled?: boolean;
  isStreaming?: boolean;
  onCancel?(): void;
}

export function ChatComposer({ onSend, disabled = false, isStreaming = false, onCancel }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [isListening, setIsListening] = useState(false);
  const speechBase = useRef("");

  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    if (event.error !== "no-speech" && event.error !== "aborted") Alert.alert("تعذر التعرف على الصوت", event.message || "تحقق من إذن الميكروفون وخدمة التعرف على الكلام.");
  });
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    const next = [speechBase.current, transcript].filter(Boolean).join(" ");
    setText(next);
    if (event.isFinal) speechBase.current = next;
  });

  const submit = () => {
    const content = text.trim();
    if (!content || disabled) return;
    onSend(content, attachment ?? undefined);
    setText("");
    setAttachment(null);
    speechBase.current = "";
  };

  const startOrStopVoice = async () => {
    if (isListening) { ExpoSpeechRecognitionModule.stop(); return; }
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) { Alert.alert("إذن الميكروفون مطلوب", "اسمح باستخدام الميكروفون والتعرف على الكلام لإملاء رسالتك."); return; }
      speechBase.current = text.trim();
      ExpoSpeechRecognitionModule.start({ lang: "ar-EG", interimResults: true, continuous: false, maxAlternatives: 1 });
    } catch { Alert.alert("التعرف الصوتي غير متاح", "تحقق من توفر خدمة التعرف على الكلام على هذا الجهاز."); }
  };

  const choose = async (kind: "image" | "document") => {
    try {
      const picked = await pickMedia(kind);
      if (picked) setAttachment(picked);
    } catch (cause) {
      Alert.alert("تعذر اختيار الملف", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
    }
  };
  const pickAttachment = () => Alert.alert("إضافة مرفق", "اختر نوع الملف", [
    { text: "صورة", onPress: () => void choose("image") },
    { text: "ملف", onPress: () => void choose("document") },
    { text: "إلغاء", style: "cancel" },
  ]);

  return (
    <View style={styles.wrapper}>
      {attachment && <View style={styles.attachmentChip}>
        <Text numberOfLines={1} style={styles.attachmentText}>مرفق: {attachment.part.name}</Text>
        <Pressable onPress={() => setAttachment(null)} accessibilityRole="button" accessibilityLabel="إزالة المرفق"><Text style={styles.removeAttachment}>×</Text></Pressable>
      </View>}
      <View style={styles.container}>
        <Pressable onPress={pickAttachment} disabled={disabled || isStreaming} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="إرفاق صورة أو ملف"><Text style={styles.icon}>＋</Text></Pressable>
        <TextInput value={text} onChangeText={setText} editable={!disabled && !isStreaming} placeholder="اكتب رسالة إلى Suly…" placeholderTextColor={colors.textMuted} style={styles.input} multiline maxLength={16000} textAlign="right" accessibilityLabel="نص الرسالة" />
        <Pressable onPress={() => void startOrStopVoice()} disabled={disabled || isStreaming} style={[styles.iconButton, isListening && styles.listeningButton]} accessibilityRole="button" accessibilityLabel={isListening ? "إيقاف الإملاء الصوتي" : "إملاء صوتي"}>
          <Text style={[styles.icon, isListening && styles.listeningIcon]}>{isListening ? "■" : "🎙"}</Text>
        </Pressable>
        {isStreaming ? <Pressable style={[styles.sendButton, styles.stopButton]} onPress={onCancel} accessibilityRole="button" accessibilityLabel="إيقاف الرد"><Text style={styles.sendText}>■</Text></Pressable> :
          <Pressable style={[styles.sendButton, (!text.trim() || disabled) && styles.sendDisabled]} onPress={submit} disabled={disabled || !text.trim()} accessibilityRole="button" accessibilityLabel="إرسال الرسالة"><Text style={styles.sendText}>↑</Text></Pressable>}
      </View>
      {attachment && <Text style={styles.attachmentNotice}>سيُحفظ الملف داخل سجل المحادثة. واجهة الذكاء الاصطناعي الحالية تستقبل النص فقط ولا تحلل محتوى الملف بعد.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, backgroundColor: colors.background },
  container: { minHeight: 58, flexDirection: "row", alignItems: "flex-end", gap: 7, padding: 7, borderRadius: 28, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 42, maxHeight: 130, color: colors.textPrimary, paddingHorizontal: 7, paddingVertical: 10, textAlignVertical: "center" },
  iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
  icon: { fontSize: 21, color: colors.textSecondary },
  listeningButton: { backgroundColor: "#EF444422" },
  listeningIcon: { color: colors.error },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  sendDisabled: { opacity: 0.42 },
  stopButton: { backgroundColor: colors.error },
  sendText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  attachmentChip: { alignSelf: "flex-start", maxWidth: "90%", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, marginBottom: 6 },
  attachmentText: { color: colors.textPrimary, maxWidth: 240, fontSize: 12 },
  removeAttachment: { color: colors.textSecondary, fontSize: 19 },
  attachmentNotice: { color: colors.warning, fontSize: 11, lineHeight: 16, paddingHorizontal: 6, paddingTop: 3, textAlign: "right" },
});
