import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useSulyTheme } from "../../../theme/ThemeProvider";
import type { ThemePalette } from "../../../theme/colors";
import type { ElementRef } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { Ionicons } from "@expo/vector-icons";
import { useAppLocale } from "../../../theme/LocaleProvider";
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
  isAgentMode?: boolean;
  onToggleAgent?(): void;
  modelLabel?: string;
  onOpenModelPicker?(): void;
  modelPickerDisabled?: boolean;
}

const MIN_INPUT_HEIGHT = 42;
const MAX_INPUT_HEIGHT = 132;


export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  {
    onSend,
    disabled = false,
    isStreaming = false,
    onCancel,
    isAgentMode = false,
    onToggleAgent,
    modelLabel,
    onOpenModelPicker,
    modelPickerDisabled = false,
  },
  ref
) {
  const { isArabic } = useAppLocale();
  const { colors } = useSulyTheme();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const [text, setText] = useState("");
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachmentPreviewUri, setAttachmentPreviewUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [attachVisible, setAttachVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceBaseTextRef = useRef("");
  const inputRef = useRef<ElementRef<typeof TextInput>>(null);
  useImperativeHandle(ref, () => ({
    editMessage(content: string) {
      setText(content);
      setInputHeight(MIN_INPUT_HEIGHT);
      setAttachment(null);
      setSelection({ start: content.length, end: content.length });
      requestAnimationFrame(() => inputRef.current?.focus());
    },
  }), []);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (attachment?.kind === "image") {
      if (attachment.part.uri) setAttachmentPreviewUri(attachment.part.uri);
      else if (Platform.OS === "web" && attachment.part.blob && typeof URL !== "undefined") {
        objectUrl = URL.createObjectURL(attachment.part.blob);
        setAttachmentPreviewUri(objectUrl);
      } else setAttachmentPreviewUri(null);
    } else setAttachmentPreviewUri(null);
    setPreviewVisible(false);
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment]);


  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setVoiceError(null);
  });
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    const nextText = [voiceBaseTextRef.current, transcript].filter(Boolean).join(" ");
    setText(nextText);
    if (event.isFinal) voiceBaseTextRef.current = nextText;
  });
  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    if (event.error === "aborted") return;
    setVoiceError(event.error === "not-allowed"
      ? (isArabic ? "اسمح لـ SULY باستخدام الميكروفون والتعرّف على الكلام." : "Allow microphone and speech recognition access for SULY.")
      : event.error === "service-not-allowed" || event.error === "language-not-supported"
        ? (isArabic ? "التعرّف الصوتي غير متاح لهذا الجهاز أو اللغة." : "Speech recognition is unavailable for this device or language.")
        : event.error === "no-speech"
          ? (isArabic ? "لم أسمع كلامًا واضحًا. حاول مرة أخرى." : "No clear speech was detected. Try again.")
          : (isArabic ? "تعذّر التعرّف على الكلام. حاول مرة أخرى." : "Speech recognition failed. Please try again."));
  });

  const handleVoicePress = async () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (disabled || isStreaming) return;
    setVoiceError(null);
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setVoiceError(isArabic ? "التعرّف الصوتي غير متاح حاليًا على هذا الجهاز أو المتصفح." : "Speech recognition is not available on this device or browser.");
        return;
      }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceError(isArabic ? "لم يتم منح إذن الميكروفون والتعرّف على الكلام." : "Microphone and speech recognition permission was not granted.");
        return;
      }
      voiceBaseTextRef.current = text.trim();
      ExpoSpeechRecognitionModule.start({
        lang: isArabic ? "ar-EG" : "en-US",
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
      });
    } catch {
      setIsListening(false);
      setVoiceError(isArabic ? "تعذّر تشغيل الميكروفون. تحقق من الأذونات وحاول مرة أخرى." : "Could not start the microphone. Check permissions and try again.");
    }
  };

  const submit = () => {
    const content = text.trim();
    if ((!content && !attachment) || disabled) return;
    Keyboard.dismiss();
    onSend(content, attachment ?? undefined);
    setText(""); setInputHeight(MIN_INPUT_HEIGHT); setSelection(undefined); setAttachment(null);
  };

  return (
    <View style={styles.wrapper}>
      {modelLabel && onOpenModelPicker ? (
        <View style={styles.modelRow}>
          <TouchableOpacity
            onPress={onOpenModelPicker}
            disabled={modelPickerDisabled || isListening}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={isArabic ? "اختيار مستوى SULY" : "Choose SULY model profile"}
            accessibilityState={{ disabled: modelPickerDisabled }}
            style={[styles.modelPickerButton, modelPickerDisabled && styles.controlDisabled]}
          >
            <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.modelPickerText}>{modelLabel}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {isListening ? <Text style={styles.voiceListening}>{isArabic ? "جارٍ الاستماع… اضغط إيقاف عند الانتهاء." : "Listening… tap stop when finished."}</Text> : null}
      {voiceError ? <Text accessibilityRole="alert" style={styles.voiceError}>{voiceError}</Text> : null}

      {attachment ? attachment.kind === "image" && attachmentPreviewUri ? (
        <View style={styles.imageAttachmentPreview}>
          <Pressable onPress={() => setPreviewVisible(true)} accessibilityRole="button" accessibilityLabel={isArabic ? "عرض معاينة الصورة" : "Preview image"}>
            <Image source={{ uri: attachmentPreviewUri }} style={styles.attachmentThumbnail} resizeMode="cover" />
          </Pressable>
          <View style={styles.attachmentInfo}>
            <Text numberOfLines={1} style={styles.attachmentText}>{attachment.part.name}</Text>
            <Text style={styles.attachmentHint}>{isArabic ? "اضغط على الصورة للتكبير" : "Tap the image to enlarge"}</Text>
          </View>
          <Pressable onPress={() => setAttachment(null)} accessibilityRole="button" accessibilityLabel={isArabic ? "إزالة المرفق" : "Remove attachment"} style={styles.removeAttachmentButton}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.attachmentChip}>
          <Text numberOfLines={1} style={styles.attachmentText}>{isArabic ? `مرفق: ${attachment.part.name}` : `Attachment: ${attachment.part.name}`}</Text>
          <Pressable onPress={() => setAttachment(null)} accessibilityRole="button" accessibilityLabel="إزالة المرفق">
            <Text style={styles.removeAttachment}>×</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Compact composer: one attachment entry point, Agent toggle, message field and send. */}
      <View style={styles.container}>
        {/* Right side (RTL start): + Button */}
        <TouchableOpacity
          onPress={() => setAttachVisible(true)}
          disabled={disabled || isStreaming || isListening}
          activeOpacity={0.7}
          style={styles.plusButton}
          accessibilityRole="button"
          accessibilityLabel={isArabic ? "إرفاق صورة أو ملف" : "Attach an image or file"}
        >
          <Ionicons name="add" size={22} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onToggleAgent}
          disabled={disabled || isStreaming || isListening || !onToggleAgent}
          activeOpacity={0.7}
          style={[styles.agentToggle, isAgentMode && styles.agentToggleActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: isAgentMode, disabled: disabled || isStreaming || isListening || !onToggleAgent }}
          accessibilityLabel={isArabic ? (isAgentMode ? "إيقاف وضع الوكيل" : "تفعيل وضع الوكيل") : (isAgentMode ? "Turn Agent mode off" : "Turn Agent mode on")}
        >
          <Ionicons name="sparkles-outline" size={15} color={isAgentMode ? colors.onPrimary : colors.textMuted} />
          <Text style={[styles.agentToggleLabel, isAgentMode && styles.agentToggleLabelActive]}>{isArabic ? "وكيل" : "Agent"}</Text>
        </TouchableOpacity>

        {/* Center: TextInput with placeholder "اسأل Suly" */}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={(value) => { setText(value); if (voiceError) setVoiceError(null); }}
          onContentSizeChange={(event) => {
            const measuredHeight = Math.ceil(event.nativeEvent.contentSize.height) + 16;
            setInputHeight(Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, measuredHeight)));
          }}
          selection={selection}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          editable={!disabled && !isStreaming && !isListening}
          placeholder={isArabic ? "اسأل Suly" : "Ask SULY"}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { height: inputHeight }]}
          multiline
          scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
          maxLength={16000}
          textAlign="right"
          accessibilityLabel={isArabic ? "اسأل Suly" : "Ask SULY"}
        />

        {/* Compact voice, send and stop controls. */}
        <View style={styles.leftControls}>
          {isStreaming ? (
            <Pressable style={styles.blueButton} onPress={onCancel} accessibilityLabel={isArabic ? "إيقاف الرد" : "Stop response"}>
              <ActivityIndicator size="small" color={colors.onPrimary} />
            </Pressable>
          ) : isListening ? (
            <Pressable
              style={[styles.micButton, styles.micButtonActive]}
              onPress={() => void handleVoicePress()}
              accessibilityRole="button"
              accessibilityLabel={isArabic ? "إيقاف الإملاء الصوتي" : "Stop voice dictation"}
            >
              <Ionicons name="stop" size={17} color={colors.onPrimary} />
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[styles.micButton, disabled && styles.controlDisabled]}
                onPress={() => void handleVoicePress()}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={isArabic ? "إملاء رسالة صوتيًا" : "Dictate a message"}
              >
                <Ionicons name="mic-outline" size={19} color={colors.textPrimary} />
              </Pressable>
              {text.trim() || attachment ? (
                <Pressable
                  style={[styles.blueButton, Platform.OS === "web" && styles.webSendButton]}
                  onPress={submit}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={isArabic ? "إرسال" : "Send"}
                >
                  <><Ionicons name="arrow-up" size={18} color={colors.onPrimary} />{Platform.OS === "web" ? <Text style={styles.webSendLabel}>{isArabic ? "إرسال" : "Send"}</Text> : null}</>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>

      <AttachSheet visible={attachVisible} onClose={() => setAttachVisible(false)} onPicked={setAttachment} />
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewVisible(false)} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق معاينة الصورة" : "Close image preview"}>
          <Pressable style={styles.previewClose} onPress={() => setPreviewVisible(false)} accessibilityRole="button" accessibilityLabel={isArabic ? "إغلاق" : "Close"}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          {attachmentPreviewUri ? <Image source={{ uri: attachmentPreviewUri }} style={styles.previewImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
});

const createStyles = (colors: ThemePalette, isArabic: boolean) => StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  voiceError: { color: colors.error, fontSize: 10, lineHeight: 15, textAlign: isArabic ? "right" : "left", paddingHorizontal: 4, marginBottom: 5 },
  voiceListening: { color: colors.textSecondary, fontSize: 10, lineHeight: 15, textAlign: isArabic ? "right" : "left", paddingHorizontal: 4, marginBottom: 5 },
  modelRow: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", marginBottom: 7 },
  modelPickerButton: { minHeight: 30, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  modelPickerText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  controlDisabled: { opacity: 0.45 },
  lowBalanceBanner: {
    flexDirection: isArabic ? "row-reverse" : "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 8,
  },
  bannerTextRow: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6, flex: 1 },
  bannerText: { color: colors.textPrimary, fontSize: 13, fontWeight: "400", textAlign: isArabic ? "right" : "left" },
  bannerRechargeBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  bannerRechargeText: { color: colors.onPrimary, fontSize: 11, fontWeight: "700" },
  container: {
    minHeight: 56,
    flexDirection: isArabic ? "row-reverse" : "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  plusButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  input: {
    flex: 1,
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    textAlign: isArabic ? "right" : "left",
    textAlignVertical: "top",
    writingDirection: "rtl",
  },
  leftControls: { flexDirection: "row", alignItems: "center", gap: 4 },
  agentToggle: { minWidth: 58, height: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  agentToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  agentToggleLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  agentToggleLabelActive: { color: colors.onPrimary },
  blueButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  blueButtonIdle: { backgroundColor: colors.primary, opacity: 0.9 },
  micButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  micButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  webSendButton: { width: "auto", minWidth: 72, paddingHorizontal: 12, flexDirection: "row", gap: 5, borderRadius: 20 },
  webSendLabel: { color: colors.onPrimary, fontSize: 12, fontWeight: "700" },
  attachmentChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 6,
  },
  imageAttachmentPreview: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "100%", marginBottom: 8, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  attachmentThumbnail: { width: 66, height: 66, borderRadius: 9, backgroundColor: colors.surfaceElevated },
  attachmentInfo: { flex: 1, minWidth: 0 },
  attachmentHint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  removeAttachmentButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.surfaceElevated },
  attachmentText: { color: colors.textPrimary, fontSize: 12 },
  removeAttachment: { color: colors.textMuted, fontSize: 18 },
  previewOverlay: { flex: 1, backgroundColor: colors.modalOverlay, justifyContent: "center", alignItems: "center" },
  previewImage: { width: "100%", height: "85%" },
  previewClose: { position: "absolute", top: 44, right: 20, zIndex: 1, width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.surfaceElevated },
});
