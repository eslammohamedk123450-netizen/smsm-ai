import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useSulyTheme } from "../../../theme/ThemeProvider";
import type { ThemePalette } from "../../../theme/colors";
import type { ElementRef } from "react";
import {
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
  basicMode?: boolean;
}

const MIN_INPUT_HEIGHT = 38;
const MAX_INPUT_HEIGHT = 136;

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  {
    onSend,
    disabled = false,
    isStreaming = false,
    onCancel,
  },
  ref
) {
  const { isArabic } = useAppLocale();
  const { colors } = useSulyTheme();
  const canvasBackground = colors.background === "#0A0A0A" ? "#000000" : colors.background;
  const styles = useMemo(() => createStyles(colors, isArabic, canvasBackground), [colors, isArabic, canvasBackground]);
  const [text, setText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
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

  const canSend = Boolean(text.trim() || attachment) && !disabled && !isStreaming;

  const submit = () => {
    const content = text.trim();
    if ((!content && !attachment) || disabled) return;
    Keyboard.dismiss();
    onSend(content, attachment ?? undefined);
    setText("");
    setInputHeight(MIN_INPUT_HEIGHT);
    setSelection(undefined);
    setAttachment(null);
  };

  return (
    <View style={styles.wrapper}>
      {isListening ? <Text style={styles.voiceListening}>{isArabic ? "جارٍ الاستماع… اضغط إيقاف عند الانتهاء." : "Listening… tap stop when finished."}</Text> : null}
      {voiceError ? <Text accessibilityRole="alert" style={styles.voiceError}>{voiceError}</Text> : null}

      <View style={styles.container}>
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
            <Pressable onPress={() => setAttachment(null)} accessibilityRole="button" accessibilityLabel={isArabic ? "إزالة المرفق" : "Remove attachment"}>
              <Text style={styles.removeAttachment}>×</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composerRow}>
          <TextInput
          ref={inputRef}
          value={text}
          onChangeText={(value) => { setText(value); if (voiceError) setVoiceError(null); }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onContentSizeChange={(event) => {
            const measuredHeight = Math.ceil(event.nativeEvent.contentSize.height) + 12;
            setInputHeight(Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, measuredHeight)));
          }}
          selection={selection}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          editable={!disabled && !isStreaming && !isListening}
          placeholder={isFocused ? (isArabic ? "اسأل SULY..." : "Ask SULY...") : ""}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          underlineColorAndroid="transparent"
          keyboardAppearance="dark"
          style={[
            styles.input,
            Platform.OS === "web" ? ({
              outlineStyle: "none",
              outlineWidth: 0,
              boxShadow: "none",
              appearance: "none",
            } as any) : null,
            { height: inputHeight },
          ]}
          multiline
          scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
          maxLength={16000}
          textAlign={isArabic ? "right" : "left"}
          accessibilityLabel={isArabic ? "اسأل Suly" : "Ask SULY"}
        />

        {/* Keep the attachment action on the physical right and send/mic on the left. */}
        <View style={styles.actionsRow}>

          <View style={styles.leftControls}>
            {isStreaming ? (
              <Pressable
                style={[styles.circleButton, styles.circleButtonFilled]}
                onPress={onCancel}
                disabled={!onCancel}
                accessibilityRole="button"
                accessibilityLabel={isArabic ? "إيقاف الرد" : "Stop response"}
              >
                <Ionicons name="stop" size={16} color={colors.onPrimary} />
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.circleButton,
                  canSend ? styles.circleButtonFilled : styles.circleButtonOutlined,
                ]}
                onPress={submit}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={isArabic ? "إرسال" : "Send"}
              >
                <Ionicons
                  name="paper-plane-outline"
                  size={17}
                  color={canSend ? colors.onPrimary : colors.textPrimary}
                />
              </Pressable>
            )}

            <Pressable
              style={[
                styles.circleButton,
                isListening ? styles.circleButtonFilled : styles.circleButtonOutlined,
                disabled && styles.controlDisabled,
              ]}
              onPress={() => void handleVoicePress()}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={
                isListening
                  ? (isArabic ? "إيقاف الإملاء الصوتي" : "Stop voice dictation")
                  : (isArabic ? "إملاء رسالة صوتيًا" : "Dictate a message")
              }
            >
              <Ionicons
                name={isListening ? "stop" : "mic-outline"}
                size={18}
                color={isListening ? colors.onPrimary : colors.textPrimary}
              />
            </Pressable>
          </View>

          <TouchableOpacity
            onPress={() => setAttachVisible(true)}
            disabled={disabled || isStreaming || isListening}
            activeOpacity={0.8}
            style={[styles.plusCircleButton, (disabled || isStreaming || isListening) && styles.controlDisabled]}
            accessibilityRole="button"
            accessibilityLabel={isArabic ? "إضافة مرفق" : "Add attachment"}
          >
            <Ionicons name="add" size={24} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
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

const createStyles = (colors: ThemePalette, isArabic: boolean, canvasBackground: string) => StyleSheet.create({
  wrapper: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    paddingHorizontal: Platform.OS === "web" ? 24 : 16,
    paddingTop: 6,
    paddingBottom: 16,
    backgroundColor: canvasBackground,
  },
  voiceError: { color: colors.error, fontSize: 10, lineHeight: 15, textAlign: isArabic ? "right" : "left", paddingHorizontal: 4, marginBottom: 5 },
  voiceListening: { color: colors.textSecondary, fontSize: 10, lineHeight: 15, textAlign: isArabic ? "right" : "left", paddingHorizontal: 4, marginBottom: 5 },
  controlDisabled: { opacity: 0.45 },
  container: {
    minHeight: 56,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.background === "#0A0A0A" ? "#262626" : colors.inputBorder,
    backgroundColor: colors.surface,
    justifyContent: "center",
    gap: 4,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    width: "100%",
  },
  input: {
    flex: 1,
    minWidth: 0,
    width: "100%",
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
    color: colors.textPrimary,
    backgroundColor: "transparent",
    borderWidth: 0,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 4,
    textAlign: isArabic ? "right" : "left",
    textAlignVertical: "top",
    writingDirection: isArabic ? "rtl" : "ltr",
  },
  actionsRow: {
    width: 122,
    flexShrink: 0,
    flexDirection: "row",
    direction: "ltr",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 0,
  },
  leftControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  circleButtonOutlined: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
  circleButtonFilled: {
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  plusCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  attachmentChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 4,
  },
  imageAttachmentPreview: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: "100%",
    marginBottom: 4,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
  },
  attachmentThumbnail: { width: 56, height: 56, borderRadius: 9, backgroundColor: colors.surface },
  attachmentInfo: { flex: 1, minWidth: 0 },
  attachmentHint: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  removeAttachmentButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.surface },
  attachmentText: { color: colors.textPrimary, fontSize: 12 },
  removeAttachment: { color: colors.textMuted, fontSize: 18 },
  previewOverlay: { flex: 1, backgroundColor: colors.modalOverlay, justifyContent: "center", alignItems: "center" },
  previewImage: { width: "100%", height: "85%" },
  previewClose: { position: "absolute", top: 44, right: 20, zIndex: 1, width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.surfaceElevated },
});
