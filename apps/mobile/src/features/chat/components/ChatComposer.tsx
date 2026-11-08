import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ElementRef } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, TextInput, TouchableOpacity, View, useColorScheme } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { Ionicons } from "@expo/vector-icons";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { colors, getThemeColors } from "../../../theme/colors";
import { theme } from "../../../theme/theme";
import { useToast } from "../../../components/ui/Toast";
import { IconButton } from "../../../components/ui/IconButton";
import { BottomSheet } from "../../../components/ui/BottomSheet";
import { AttachSheet } from "./AttachSheet";
import type { PickedMedia } from "../../media/media-service";

export type ChatAttachment = PickedMedia;
export interface ChatComposerHandle {
  editMessage(content: string): void;
}
export interface ChatComposerProps {
  onSend(content: string, attachment?: ChatAttachment): void;
  disabled?: boolean;
  isStreaming?: boolean;
  onCancel?(): void;
}

function formatDictationDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer({ onSend, disabled = false, isStreaming = false, onCancel }, ref) {
  const [text, setText] = useState("");
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [permissionVisible, setPermissionVisible] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [attachVisible, setAttachVisible] = useState(false);
  const speechBase = useRef("");
  const recordingPulse = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<ElementRef<typeof TextInput>>(null);
  const voiceIntent = useRef(false);
  const ignoreRecognitionResults = useRef(false);
  const timerStartedAt = useRef(0);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRecognitionRef = useRef<() => void>(() => {});
  const scheduleRestartRef = useRef<() => void>(() => {});
  const { show } = useToast();
  const palette = getThemeColors(useColorScheme() === "light" ? "light" : "dark");
  const voiceSupported = Platform.OS !== "web" || ExpoSpeechRecognitionModule.isRecognitionAvailable();

  const clearRestart = () => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = null;
  };

  useImperativeHandle(ref, () => ({
    editMessage(content: string) {
      setText(content);
      setAttachment(null);
      speechBase.current = "";
      setSelection({ start: content.length, end: content.length });
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  }), []);

  startRecognitionRef.current = () => {
    if (!voiceIntent.current) return;
    try {
      ExpoSpeechRecognitionModule.start({ lang: "ar-EG", interimResults: true, continuous: true, maxAlternatives: 1 });
    } catch {
      voiceIntent.current = false;
      setVoiceActive(false);
      setVoiceListening(false);
      clearRestart();
      show("التعرّف الصوتي غير متاح على هذا الجهاز.", "error");
    }
  };
  scheduleRestartRef.current = () => {
    if (!voiceIntent.current || restartTimer.current) return;
    restartTimer.current = setTimeout(() => {
      restartTimer.current = null;
      if (voiceIntent.current) startRecognitionRef.current();
    }, 250);
  };

  useSpeechRecognitionEvent("start", () => {
    clearRestart();
    if (voiceIntent.current) setVoiceListening(true);
  });
  useSpeechRecognitionEvent("end", () => {
    setVoiceListening(false);
    // Some speech services end after a silence timeout even with continuous mode enabled.
    if (voiceIntent.current) scheduleRestartRef.current();
  });
  useSpeechRecognitionEvent("error", (event) => {
    setVoiceListening(false);
    if (event.error === "no-speech" || event.error === "aborted") {
      if (voiceIntent.current) scheduleRestartRef.current();
      return;
    }
    voiceIntent.current = false;
    clearRestart();
    setVoiceActive(false);
    show(event.message || "تعذّر التعرّف على الصوت. تحقق من إذن الميكروفون.", "error");
  });
  useSpeechRecognitionEvent("result", (event) => {
    if (ignoreRecognitionResults.current) return;
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    const next = [speechBase.current, transcript].filter(Boolean).join(" ");
    setText(next);
    if (event.isFinal) speechBase.current = next;
  });

  useEffect(() => {
    if (!voiceActive) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - timerStartedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [voiceActive]);

  useEffect(() => {
    if (!voiceActive) {
      recordingPulse.setValue(0);
      return;
    }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(recordingPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(recordingPulse, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [recordingPulse, voiceActive]);

  useEffect(() => () => {
    voiceIntent.current = false;
    clearRestart();
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* Recognition may already be unavailable. */ }
  }, []);

  const stopVoice = () => {
    voiceIntent.current = false;
    clearRestart();
    setVoiceActive(false);
    setVoiceListening(false);
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* Ignore a stop after the service has ended. */ }
  };

  const submit = () => {
    const content = text.trim();
    if (!content || disabled) return;
    if (voiceActive) stopVoice();
    ignoreRecognitionResults.current = true;
    onSend(content, attachment ?? undefined);
    setText(""); setSelection(undefined); setAttachment(null); speechBase.current = "";
  };

  const beginVoice = () => {
    setPermissionVisible(false);
    ignoreRecognitionResults.current = false;
    speechBase.current = text.trim();
    voiceIntent.current = true;
    timerStartedAt.current = Date.now();
    setElapsedSeconds(0);
    setVoiceActive(true);
    startRecognitionRef.current();
  };

  const requestVoicePermission = async () => {
    setPermissionBusy(true);
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setPermissionVisible(false);
      if (!permission.granted) {
        show("اسمح باستخدام الميكروفون والتعرّف على الكلام لإملاء رسالتك.", "info");
        return;
      }
      beginVoice();
    } catch {
      setPermissionVisible(false);
      show("تعذّر طلب إذن الميكروفون على هذا الجهاز.", "error");
    } finally {
      setPermissionBusy(false);
    }
  };

  const sendDictation = () => {
    const content = text.trim();
    if (!content || disabled) return;
    stopVoice();
    ignoreRecognitionResults.current = true;
    onSend(content, attachment ?? undefined);
    setText(""); setSelection(undefined); setAttachment(null); speechBase.current = "";
  };

  return (
    <View style={styles.wrapper}>
      {attachment ? <View style={styles.attachmentChip}>
        <Text numberOfLines={1} style={styles.attachmentText}>مرفق: {attachment.part.name}</Text>
        <Pressable onPress={() => setAttachment(null)} accessibilityRole="button" accessibilityLabel="إزالة المرفق"><Text style={styles.removeAttachment}>×</Text></Pressable>
      </View> : null}
      {voiceActive ? <View style={[styles.voiceToolbar, { borderColor: palette.divider, backgroundColor: palette.surface }]}>
        <View style={styles.voiceStatus} accessibilityLiveRegion="polite">
          <View style={[styles.recordingDot, { backgroundColor: palette.error }]} />
          <Text style={[styles.voiceTimer, { color: palette.textPrimary }]}>{formatDictationDuration(elapsedSeconds)}</Text>
          {!voiceListening ? <Text style={[styles.reconnecting, { color: palette.textMuted }]}>جارٍ إعادة الاتصال…</Text> : null}
        </View>
        <Pressable onPress={sendDictation} disabled={disabled || !text.trim()} accessibilityRole="button" accessibilityLabel="إرسال الصوت" style={({ pressed }) => [styles.voiceSendButton, { backgroundColor: palette.primary, opacity: disabled || !text.trim() ? 0.45 : pressed ? 0.8 : 1 }]}>
          <Text style={[styles.voiceSendText, { color: palette.background }]}>إرسال الصوت</Text>
        </Pressable>
        <Pressable onPress={stopVoice} accessibilityRole="button" accessibilityLabel="إلغاء الإملاء الصوتي" style={({ pressed }) => [styles.cancelVoiceButton, { borderColor: palette.divider, opacity: pressed ? 0.65 : 1 }]}>
          <Text style={[styles.cancelVoiceText, { color: palette.error }]}>×</Text>
        </Pressable>
      </View> : null}
      <View style={styles.container}>
        <IconButton icon="＋" label="إضافة صورة أو فيديو أو ملف" onPress={() => setAttachVisible(true)} disabled={disabled || isStreaming} />
        <TextInput ref={inputRef} value={text} onChangeText={setText} selection={selection} onSelectionChange={(event) => setSelection(event.nativeEvent.selection)} editable={!disabled && !isStreaming} placeholder="اكتب رسالة إلى Suly…" placeholderTextColor={colors.textMuted} style={styles.input} multiline maxLength={16000} textAlign="right" accessibilityLabel="نص الرسالة" />
        <TouchableOpacity onPress={() => voiceActive ? stopVoice() : setPermissionVisible(true)} disabled={disabled || isStreaming || !voiceSupported} activeOpacity={0.7} style={[styles.iconButton, !voiceSupported && styles.voiceUnavailable]} accessibilityRole="button" accessibilityLabel="إملاء صوتي" accessibilityState={{ disabled: disabled || isStreaming || !voiceSupported }}>
          <Ionicons name={voiceActive ? "mic" : "mic-outline"} size={20} color={voiceActive ? "#EF4444" : colors.textSecondary} />
          {voiceActive ? <Animated.View style={[styles.recordingPulse, { opacity: recordingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }), transform: [{ scale: recordingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) }] }]} /> : null}
        </TouchableOpacity>
        {isStreaming ? <Pressable style={[styles.sendButton, styles.stopButton]} onPress={onCancel} accessibilityRole="button" accessibilityLabel="إيقاف الرد"><ActivityIndicator size="small" color={colors.background} /></Pressable> : voiceActive ? null :
          <Pressable style={[styles.sendButton, (!text.trim() || disabled) && styles.sendDisabled]} onPress={submit} disabled={disabled || !text.trim()} accessibilityRole="button" accessibilityLabel="إرسال الرسالة"><Text style={styles.sendText}>↑</Text></Pressable>}
      </View>
      {!voiceSupported ? <Text style={[styles.voiceHint, { color: palette.textMuted }]}>الإملاء الصوتي غير مدعوم في هذا المتصفح.</Text> : null}
      {attachment ? <Text style={styles.attachmentNotice}>سيُحفظ الملف في سجل المحادثة. قد لا تتمكن النماذج الحالية من تحليل محتواه.</Text> : null}
      <AttachSheet visible={attachVisible} onClose={() => setAttachVisible(false)} onPicked={setAttachment} />
      <BottomSheet visible={permissionVisible} title="الإملاء الصوتي" onClose={() => setPermissionVisible(false)}>
        <Text style={[styles.permissionCopy, { color: palette.textSecondary }]}>لإملاء رسالتك، نحتاج إذنك لاستخدام الميكروفون والتعرّف على الكلام. لن تُرسل الرسالة تلقائيًا؛ يمكنك مراجعة النص وتعديله قبل الإرسال.</Text>
        <View style={styles.permissionActions}>
          <Pressable onPress={() => void requestVoicePermission()} disabled={permissionBusy} accessibilityRole="button" style={({ pressed }) => [styles.permissionPrimary, { backgroundColor: palette.primary, opacity: permissionBusy ? 0.65 : pressed ? 0.82 : 1 }]}>
            {permissionBusy ? <ActivityIndicator color={palette.background} /> : <Text style={[styles.permissionPrimaryText, { color: palette.background }]}>متابعة</Text>}
          </Pressable>
          <Pressable onPress={() => setPermissionVisible(false)} disabled={permissionBusy} accessibilityRole="button" style={({ pressed }) => [styles.permissionSecondary, { borderColor: palette.divider, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.permissionSecondaryText, { color: palette.textSecondary }]}>ليس الآن</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, backgroundColor: colors.background },
  container: { minHeight: 58, flexDirection: "row-reverse", alignItems: "flex-end", gap: 7, padding: 7, borderRadius: 28, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground },
  input: { flex: 1, minHeight: 42, maxHeight: 130, color: colors.textPrimary, paddingHorizontal: 7, paddingVertical: 10, textAlignVertical: "center", writingDirection: "rtl" },
  iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
  voiceUnavailable: { opacity: 0.4 },
  recordingPulse: { position: "absolute", top: 4, right: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  sendDisabled: { opacity: 0.42 },
  stopButton: { backgroundColor: colors.error },
  sendText: { color: colors.background, fontSize: 22, fontWeight: "800" },
  attachmentChip: { alignSelf: "flex-start", maxWidth: "90%", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, marginBottom: 6 },
  attachmentText: { color: colors.textPrimary, maxWidth: 240, fontSize: 12 },
  removeAttachment: { color: colors.textSecondary, fontSize: 19 },
  attachmentNotice: { color: colors.warning, fontSize: 11, lineHeight: 16, paddingHorizontal: 6, paddingTop: 3, textAlign: "right" },
  voiceToolbar: { minHeight: 48, flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.sm, borderWidth: 1, borderRadius: theme.borderRadius.lg, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, marginBottom: theme.spacing.xs },
  voiceStatus: { flex: 1, minWidth: 66, flexDirection: "row-reverse", alignItems: "center", gap: theme.spacing.xs },
  recordingDot: { width: 9, height: 9, borderRadius: theme.borderRadius.full },
  voiceTimer: { fontVariant: ["tabular-nums"], fontSize: theme.typography.body.fontSize, fontWeight: "700" },
  reconnecting: { fontSize: theme.typography.caption.fontSize },
  voiceSendButton: { minHeight: 38, justifyContent: "center", alignItems: "center", borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md },
  voiceSendText: { fontSize: theme.typography.caption.fontSize, fontWeight: "700" },
  cancelVoiceButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: theme.borderRadius.full },
  cancelVoiceText: { fontSize: 26, lineHeight: 29, fontWeight: "400" },
  voiceHint: { textAlign: "right", fontSize: theme.typography.caption.fontSize, paddingHorizontal: theme.spacing.sm, paddingTop: theme.spacing.xs },
  permissionCopy: { textAlign: "right", fontSize: theme.typography.body.fontSize, lineHeight: 23, marginBottom: theme.spacing.md },
  permissionActions: { flexDirection: "row-reverse", gap: theme.spacing.sm },
  permissionPrimary: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: theme.borderRadius.md },
  permissionPrimaryText: { fontSize: theme.typography.body.fontSize, fontWeight: "700" },
  permissionSecondary: { minWidth: 92, minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md },
  permissionSecondaryText: { fontSize: theme.typography.caption.fontSize, fontWeight: "600" },
});
