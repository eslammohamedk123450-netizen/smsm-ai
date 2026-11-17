import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
  creditBalance?: number | null;
  onOpenRecharge?(): void;
  onOpenConnectors?(): void;
}

const MIN_INPUT_HEIGHT = 42;
const MAX_INPUT_HEIGHT = 132;


export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  {
    onSend,
    disabled = false,
    isStreaming = false,
    onCancel,
    creditBalance = null,
    onOpenRecharge,
    onOpenConnectors,
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

  const submit = () => {
    const content = text.trim();
    if ((!content && !attachment) || disabled) return;
    Keyboard.dismiss();
    onSend(content, attachment ?? undefined);
    setText(""); setInputHeight(MIN_INPUT_HEIGHT); setSelection(undefined); setAttachment(null);
  };

  const hasLowBalance = creditBalance !== null && creditBalance < 500;

  return (
    <View style={styles.wrapper}>
      {/* Low Balance Warning Banner */}
      {hasLowBalance && (
        <View style={styles.lowBalanceBanner}>
          <View style={styles.bannerTextRow}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.bannerText}>
              {isArabic ? `رصيدك أوشك على النفاد (المتبقي: ${creditBalance?.toLocaleString("en-US")} نقطة)` : `Your credits are running low (${creditBalance?.toLocaleString("en-US")} remaining).`}
            </Text>
          </View>
          <TouchableOpacity onPress={onOpenRecharge} style={styles.bannerRechargeBtn} activeOpacity={0.8}>
            <Text style={styles.bannerRechargeText}>{isArabic ? "اشحن الآن" : "Recharge"}</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* Main Bar: Height 56, #1F1F1F, r: 999 */}
      <View style={styles.container}>
        {/* Right side (RTL start): + Button */}
        <TouchableOpacity
          onPress={() => setAttachVisible(true)}
          disabled={disabled || isStreaming}
          activeOpacity={0.7}
          style={styles.plusButton}
          accessibilityLabel={isArabic ? "إضافة ملف" : "Add attachment"}
        >
          <Ionicons name="add" size={22} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Center: TextInput with placeholder "اسأل Suly" */}
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onContentSizeChange={(event) => {
            const measuredHeight = Math.ceil(event.nativeEvent.contentSize.height) + 16;
            setInputHeight(Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, measuredHeight)));
          }}
          selection={selection}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          editable={!disabled && !isStreaming}
          placeholder={isArabic ? "اسأل Suly" : "Ask SULY"}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { height: inputHeight }]}
          multiline
          scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
          maxLength={16000}
          textAlign="right"
          accessibilityLabel={isArabic ? "اسأل Suly" : "Ask SULY"}
        />

        {/* Connectors shortcut replaces voice input; voice capture is not part of this chat UI. */}
        <View style={styles.leftControls}>
          <TouchableOpacity
            onPress={onOpenConnectors}
            disabled={disabled || isStreaming}
            activeOpacity={0.7}
            style={styles.micButton}
            accessibilityLabel={isArabic ? "فتح الموصلات" : "Open connectors"}
          >
            <Ionicons name="git-network-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {isStreaming ? (
            <Pressable style={styles.blueButton} onPress={onCancel} accessibilityLabel={isArabic ? "إيقاف الرد" : "Stop response"}>
              <ActivityIndicator size="small" color={colors.onPrimary} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.blueButton, Platform.OS === "web" && styles.webSendButton, (!text.trim() && !attachment) && styles.blueButtonIdle]}
              onPress={submit}
              disabled={disabled || (!text.trim() && !attachment)}
              accessibilityLabel={isArabic ? "إرسال" : "Send"}
            >
              {text.trim() || attachment ? (
                <><Ionicons name="arrow-up" size={18} color={colors.onPrimary} />{Platform.OS === "web" ? <Text style={styles.webSendLabel}>{isArabic ? "إرسال" : "Send"}</Text> : null}</>
              ) : (
                <Ionicons name="radio-outline" size={18} color={colors.onPrimary} />
              )}
            </Pressable>
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
  micButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  blueButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  blueButtonIdle: { backgroundColor: colors.primary, opacity: 0.9 },
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
