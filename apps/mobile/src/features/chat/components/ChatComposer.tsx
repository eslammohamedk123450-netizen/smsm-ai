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
import { usePlusMenu } from "../../../components/navigation/MainNavigation";
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
  basicMode?: boolean;
}

const MIN_INPUT_HEIGHT = 42;
const MAX_INPUT_HEIGHT = 132;


export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  {
    onSend,
    disabled = false,
    isStreaming = false,
    onCancel,
    basicMode = false,
  },
  ref
) {
  const { isArabic } = useAppLocale();
  const { colors } = useSulyTheme();
  const openPlusMenu = usePlusMenu();
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
      <View style={styles.agentStatus} accessibilityRole="text">
        <Ionicons name="sparkles" size={13} color={colors.primary} />
        <Text style={styles.agentStatusText}>{isArabic ? "SULY AI · محادثة مباشرة" : "SULY AI · Direct chat"}</Text>
      </View>

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

      {/* Unified composer: connectors, attachments, message input, voice, and send/stop. */}
      <View style={styles.container}>
        {/* RTL: connectors (+), attachments (paperclip), input, microphone, send/stop. */}
        {!basicMode ? <TouchableOpacity
          onPress={openPlusMenu}
          disabled={disabled || isStreaming || isListening}
          activeOpacity={0.7}
          style={styles.plusButton}
          accessibilityRole="button"
          accessibilityLabel={isArabic ? "فتح الموصلات والأدوات" : "Open tools and connectors"}
        >
          <Ionicons name="add" size={22} color={colors.textMuted} />
        </TouchableOpacity> : null}

        {!basicMode ? <TouchableOpacity
          onPress={() => setAttachVisible(true)}
          disabled={disabled || isStreaming || isListening}
          activeOpacity={0.7}
          style={styles.attachmentButton}
          accessibilityRole="button"
          accessibilityLabel={isArabic ? "إرفاق صورة أو ملف" : "Attach an image or file"}
        >
          <Ionicons name="attach-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity> : null}

        {/* Center: multiline message input. */}
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
          selectionColor={colors.primary}
          underlineColorAndroid="transparent"
          keyboardAppearance="dark"
          style={[styles.input, { height: inputHeight }]}
          multiline
          scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
          maxLength={16000}
          textAlign={isArabic ? "right" : "left"}
          accessibilityLabel={isArabic ? "اسأل Suly" : "Ask SULY"}
        />

        {/* Compact voice, send and stop controls. */}
        <View style={styles.leftControls}>
          {isStreaming ? (
            <Pressable style={styles.blueButton} onPress={onCancel} disabled={!onCancel} accessibilityRole="button" accessibilityLabel={isArabic ? "إيقاف الرد" : "Stop response"}>
              <Ionicons name="stop" size={16} color={colors.onPrimary} />
            </Pressable>
          ) : !basicMode && isListening ? (
            <Pressable
              style={[styles.micButton, styles.micButtonActive]}
              onPress={() => void handleVoicePress()}
              accessibilityRole="button"
              accessibilityLabel={isArabic ? "إيقاف الإملاء الصوتي" : "Stop voice dictation"}
            >
              <Ionicons name="stop" size={17} color={colors.onPrimary} />
            </Pressable>
          ) : basicMode ? (
            text.trim() ? <Pressable style={[styles.blueButton, Platform.OS === "web" && styles.webSendButton]} onPress={submit} disabled={disabled}><Ionicons name="arrow-up" size={17} color={colors.onPrimary}/></Pressable> : <Pressable style={[styles.micButton, styles.controlDisabled]} disabled><Ionicons name="send-outline" size={17} color={colors.textMuted}/></Pressable>
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

      {!basicMode ? <AttachSheet visible={attachVisible} onClose={() => setAttachVisible(false)} onPicked={setAttachment} /> : null}
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
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: colors.background,
  },
  agentStatus: { minHeight: 28, alignSelf: "center", flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surfaceElevated },
  agentStatusText: { color: colors.textSecondary, fontSize: 10, fontWeight: "700" },
  voiceError: { color: colors.error, fontSize: 10, lineHeight: 15, textAlign: isArabic ? "right" : "left", paddingHorizontal: 4, marginBottom: 5 },
  voiceListening: { color: colors.textSecondary, fontSize: 10, lineHeight: 15, textAlign: isArabic ? "right" : "left", paddingHorizontal: 4, marginBottom: 5 },
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
    minHeight: 64,
    flexDirection: isArabic ? "row-reverse" : "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    gap: 7,
    shadowColor: "#000",
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  plusButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21 },
  attachmentButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21 },
  input: {
    flex: 1,
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
    color: colors.textPrimary,
    backgroundColor: "transparent",
    borderWidth: 0,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    textAlign: isArabic ? "right" : "left",
    textAlignVertical: "top",
    writingDirection: isArabic ? "rtl" : "ltr",
  },
  leftControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  blueButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  blueButtonIdle: { backgroundColor: colors.primary, opacity: 0.9 },
  micButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
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
