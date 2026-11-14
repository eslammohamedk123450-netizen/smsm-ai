import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Platform, Pressable, StyleSheet, TextInput, TouchableOpacity, View, Modal } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { colors } from "../../../theme/colors";
import { useToast } from "../../../components/ui/Toast";
import { MarkdownView } from "./MarkdownView";
import type { MediaAsset } from "../../media/media-service";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  messageId: string;
  attachments?: MediaAsset[];
  isStreaming?: boolean;
  generationState?: "pending" | "failed";
  feedback?: Feedback;
  onFeedback?(value: Feedback): void | Promise<void>;
  onEdit?(content: string): void;
  onEditSave?(content: string): void | Promise<void>;
  edited?: boolean;
  responseVariants?: Array<{ id: string; content: string }>;
  responseIndex?: number;
  onResponseIndexChange?(index: number): void;
}

export type Feedback = "like" | "dislike" | null;
export type MessageFeedback = Exclude<Feedback, null>;
const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|avif|heic|heif)(?:\?[^\s]*)?)/gi;

type ActionKind = "edit" | "copy" | "like" | "dislike";

function ReactionGlyph({ kind, selected, copied }: { kind: ActionKind; selected?: boolean; copied?: boolean }) {
  if (kind === "edit") return <Text style={styles.glyphText}>✎</Text>;
  const iconName = kind === "copy" ? (copied ? "checkmark-outline" : "copy-outline") : kind === "like" ? "thumbs-up-outline" : "thumbs-down-outline";
  return <Ionicons name={iconName} size={16} color={selected || copied ? "#0EA5E9" : "#A1A1AA"} />;
}

function MessageAction({
  kind,
  label,
  selected = false,
  copied = false,
  showLabel = false,
  onPress,
}: {
  kind: ActionKind;
  label: string;
  selected?: boolean;
  copied?: boolean;
  showLabel?: boolean;
  onPress(): void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const isFeedback = kind === "like" || kind === "dislike";
  const useNativeDriver = Platform.OS !== "web";
  const handlePress = () => {
    if (isFeedback) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 90, useNativeDriver }),
        Animated.timing(scale, { toValue: 1, duration: 110, useNativeDriver }),
      ]).start();
    }
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={handlePress}
        activeOpacity={0.7}
        style={styles.action}
      >
        <View style={styles.actionIcon}><ReactionGlyph kind={kind} selected={selected} copied={copied} /></View>
        {kind === "edit" || showLabel ? <Text style={styles.actionLabel}>{label}</Text> : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function MessageBubble({
  role,
  content,
  attachments = [],
  isStreaming = false,
  generationState,
  feedback = null,
  onFeedback,
  onEdit,
  onEditSave,
  edited = false,
  responseVariants = [],
  responseIndex = 0,
  onResponseIndexChange,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const { show } = useToast();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [draft, setDraft] = useState(content);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);
  useEffect(() => {
    if (!editing) setDraft(content);
  }, [content, editing]);

  const copyToClipboard = async (text: string, showCheck = false) => {
    try {
      await Clipboard.setStringAsync(text);
      show("تم النسخ", "success");
      if (showCheck) {
        setCopied(true);
        copiedTimer.current = setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      show("تعذّر النسخ", "error");
    }
  };

  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || !onEditSave || savingEdit) return;
    setSavingEdit(true);
    try {
      await onEditSave(trimmed);
      setEditing(false);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "تعذّر حفظ تعديل الرسالة. حاول مرة أخرى.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const [viewedImage, setViewedImage] = useState<string | null>(null);
  
  const renderContent = (content: string) => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    imagePattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = imagePattern.exec(content)) !== null) {
      const markdownUrl = match[2];
      const standaloneUrl = match[3];
      const candidateUrl = markdownUrl || standaloneUrl || "";
      const path = candidateUrl.toLowerCase().split(/[?#]/)[0];
      if (markdownUrl && !/\.(?:png|jpe?g|gif|webp|avif|heic|heif)$/.test(path)) continue;
      if (match.index > cursor) {
        const textPart = content.slice(cursor, match.index);
        nodes.push(<Text key={`${cursor}`} style={isUser ? styles.userText : styles.assistantText}>{textPart}</Text>);
      }
      const uri = candidateUrl;
      nodes.push(
        <TouchableOpacity key={`${match.index}`} onPress={() => setViewedImage(uri)}>
          <Image source={{ uri }} style={styles.imageThumbnail} resizeMode="cover" />
        </TouchableOpacity>
      );
      cursor = match.index + match[0].length;
    }
    if (cursor < content.length) {
      nodes.push(<Text key="tail" style={isUser ? styles.userText : styles.assistantText}>{content.slice(cursor)}</Text>);
    }
    return nodes;
  };

  const canShowActions = !isStreaming && content.length > 0;

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.messageColumn, isUser ? styles.userColumn : styles.assistantColumn]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {isUser ? (
            <>
              {editing ? (
                <>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    autoFocus
                    textAlign="right"
                    textAlignVertical="top"
                    style={styles.editInput}
                    accessibilityLabel="تعديل الرسالة"
                  />
                  <View style={styles.editButtons}>
                    <Pressable disabled={savingEdit} style={styles.cancelEditButton} onPress={() => { setDraft(content); setEditing(false); }} accessibilityRole="button"><Text style={styles.cancelEditText}>إلغاء</Text></Pressable>
                    <Pressable disabled={savingEdit} style={styles.saveEditButton} onPress={() => void saveEdit()} accessibilityRole="button"><Text style={styles.saveEditText}>{savingEdit ? "جارٍ الحفظ…" : "حفظ"}</Text></Pressable>
                  </View>
                </>
              ) : content.trim() ? <View style={styles.paragraph}>{renderContent(content)}</View> : null}
              {attachments.length ? <View style={styles.attachments}>{attachments.map((asset) => {
                const isImage = asset.kind === "image" || asset.mimeType?.toLowerCase().startsWith("image/");
                const isVideo = asset.kind === "video" || asset.mimeType?.toLowerCase().startsWith("video/");
                const label = asset.filename || (isImage ? "صورة مرفقة" : isVideo ? "فيديو مرفق" : "مستند مرفق");
                return isImage ? (
                  <Pressable key={asset.id} disabled={!asset.url} onPress={() => setViewedImage(asset.url)} accessibilityRole="button" accessibilityLabel={`فتح الصورة ${label}`}>
                    {asset.url ? <Image source={{ uri: asset.url }} style={styles.imageThumbnail} resizeMode="cover" /> : <View style={styles.missingAttachment}><Ionicons name="image-outline" size={26} color="#A1A1AA" /></View>}
                  </Pressable>
                ) : (
                  <View key={asset.id} style={styles.fileAttachment}>
                    <Ionicons name={isVideo ? "videocam-outline" : "document-text-outline"} size={24} color="#2563EB" />
                    <View style={styles.fileAttachmentText}><Text numberOfLines={1} style={styles.fileName}>{label}</Text><Text style={styles.fileKind}>{asset.mimeType || (isVideo ? "فيديو" : "مستند")}</Text></View>
                  </View>
                );
              })}</View> : null}
            </>
          ) : (
            <>
              {/* Header inside assistant bubble matching web */}
              <View style={styles.assistantHeader}>
                <View style={styles.assistantBrand}>
                  <Image source={require("../../../../assets/suly-icon.png")} style={styles.sulySmallIcon} resizeMode="cover" />
                  <Text style={styles.assistantTitle}>Suly</Text>
                </View>
                {content ? <TouchableOpacity onPress={() => void copyToClipboard(content, true)} style={styles.headerCopyBtn} accessibilityLabel="نسخ الرد">
                  <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={copied ? "#0EA5E9" : "#A1A1AA"} />
                </TouchableOpacity> : null}
              </View>
              {responseVariants.length > 1 ? (
                <View style={styles.variantNav} accessibilityLabel={`نسخة الرد ${responseIndex + 1} من ${responseVariants.length}`}>
                  <Pressable onPress={() => onResponseIndexChange?.(Math.max(0, responseIndex - 1))} disabled={responseIndex === 0} style={styles.variantArrow} accessibilityLabel="الرد القديم"><Text style={[styles.variantArrowText, responseIndex === 0 && styles.variantDisabled]}>&gt;</Text></Pressable>
                  <Text style={styles.variantCount}>{responseIndex + 1} / {responseVariants.length}</Text>
                  <Pressable onPress={() => onResponseIndexChange?.(Math.min(responseVariants.length - 1, responseIndex + 1))} disabled={responseIndex === responseVariants.length - 1} style={styles.variantArrow} accessibilityLabel="الرد الجديد"><Text style={[styles.variantArrowText, responseIndex === responseVariants.length - 1 && styles.variantDisabled]}>&lt;</Text></Pressable>
                </View>
              ) : null}

              {generationState ? (
                <View style={styles.generationCard} accessibilityRole="progressbar" accessibilityLabel={generationState === "pending" ? "جاري توليد الصورة" : "تعذر توليد الصورة"}>
                  {generationState === "pending" ? <ActivityIndicator size="large" color="#0EA5E9" /> : <Ionicons name="warning-outline" size={32} color="#F87171" />}
                  <Text style={styles.generationLabel}>{generationState === "pending" ? "جاري توليد الصورة…" : "تعذر توليد الصورة. أرسل الطلب مجددًا للمحاولة."}</Text>
                </View>
              ) : <>
                {!isStreaming ? (
                  <View style={styles.markdown}>
                    <MarkdownView content={content} onCopyCode={(code) => void copyToClipboard(code)} />
                  </View>
                ) : (
                  <Text style={styles.assistantText}>{content}</Text>
                )}
                {attachments.length ? <View style={styles.assistantAttachments}>{attachments.map((asset) => {
                  const isImage = asset.kind === "image" || asset.mimeType?.toLowerCase().startsWith("image/");
                  return isImage ? (
                    <Pressable key={asset.id} disabled={!asset.url} onPress={() => setViewedImage(asset.url)} accessibilityRole="button" accessibilityLabel="فتح الصورة المولدة">
                      {asset.url ? <Image source={{ uri: asset.url }} style={styles.generatedImage} resizeMode="cover" /> : <View style={styles.missingGeneratedImage}><Ionicons name="image-outline" size={28} color="#A1A1AA" /></View>}
                    </Pressable>
                  ) : null;
                })}</View> : null}
              </>}
            </>
          )}

          {isStreaming && <View style={styles.pulse} />}
        </View>

        <Modal visible={!!viewedImage} transparent={true} animationType="fade" onRequestClose={() => setViewedImage(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setViewedImage(null)}>
             <Image source={{ uri: viewedImage || "" }} style={styles.fullImage} resizeMode="contain" />
             <Pressable style={styles.modalClose} onPress={() => setViewedImage(null)} accessibilityRole="button" accessibilityLabel="إغلاق الصورة"><Ionicons name="close" size={24} color="#FFFFFF" /></Pressable>
          </Pressable>
        </Modal>

        {/* Action icons */}
        {canShowActions && !editing && (
          <View style={[styles.actions, isUser ? styles.userActions : styles.assistantActions]}>
            {isUser ? (
              <>
                {edited ? <Text style={styles.editedLabel}>تم التعديل</Text> : null}
                <MessageAction kind="copy" label="نسخ" copied={copied} showLabel onPress={() => void copyToClipboard(content, true)} />
                <MessageAction kind="edit" label="تعديل" onPress={() => { setDraft(content); setEditing(true); onEdit?.(content); }} />
              </>
            ) : (
              <>
                <MessageAction kind="copy" label="نسخ" copied={copied} onPress={() => void copyToClipboard(content, true)} />
                <MessageAction kind="like" label="إعجاب" selected={feedback === "like"} onPress={() => onFeedback?.(feedback === "like" ? null : "like")} />
                <MessageAction kind="dislike" label="عدم إعجاب" selected={feedback === "dislike"} onPress={() => onFeedback?.(feedback === "dislike" ? null : "dislike")} />
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", width: "100%", marginVertical: 6, paddingHorizontal: 16 },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  messageColumn: { maxWidth: "90%", minWidth: 0 },
  userColumn: { alignItems: "flex-end" },
  assistantColumn: { alignItems: "flex-start", width: "100%", maxWidth: "94%" },
  bubble: { borderRadius: 16, padding: 16, width: "100%" },
  userBubble: {
    backgroundColor: "#FFFFFF",
    maxWidth: "85%",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  assistantBubble: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#262626",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  assistantHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  assistantBrand: { flexDirection: "row", alignItems: "center", gap: 6 },
  sulySmallIcon: { width: 18, height: 18, borderRadius: 4 },
  assistantTitle: { color: "#F5F5F5", fontSize: 13, fontWeight: "700" },
  variantNav: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: 8 },
  variantArrow: { minWidth: 24, minHeight: 24, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: "#1F2937" },
  variantArrowText: { color: "#F5F5F5", fontSize: 18, lineHeight: 22, fontWeight: "700" },
  variantDisabled: { color: "#4B5563" },
  variantCount: { color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
  headerCopyBtn: { padding: 4, borderRadius: 6 },
  paragraph: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  userText: { fontSize: 16, lineHeight: 26, color: "#000000", fontWeight: "400", textAlign: "right", writingDirection: "rtl" },
  assistantText: { fontSize: 16, lineHeight: 26, color: "#F5F5F5", fontWeight: "400", textAlign: "right", writingDirection: "rtl" },
  imageThumbnail: { width: 96, height: 96, borderRadius: 12, marginVertical: 4, backgroundColor: "#E5E7EB" },
  attachments: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  assistantAttachments: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  generatedImage: { width: 240, height: 240, maxWidth: 260, borderRadius: 12, marginTop: 4, backgroundColor: "#1F1F1F" },
  missingGeneratedImage: { width: 240, height: 240, borderRadius: 12, marginTop: 4, backgroundColor: "#1F1F1F", justifyContent: "center", alignItems: "center" },
  generationCard: { width: 240, maxWidth: "100%", aspectRatio: 1, borderRadius: 14, borderWidth: 1, borderColor: "#262626", backgroundColor: "#0B0B0B", alignItems: "center", justifyContent: "center", padding: 20, gap: 14 },
  generationLabel: { color: "#A1A1AA", fontSize: 12, lineHeight: 18, fontWeight: "600", textAlign: "center" },
  missingAttachment: { width: 96, height: 96, borderRadius: 12, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" },
  fileAttachment: { maxWidth: 260, minWidth: 180, flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 10, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, backgroundColor: "#F8FAFC" },
  fileAttachmentText: { flex: 1, minWidth: 0, alignItems: "flex-end" },
  fileName: { color: "#111827", fontSize: 12, fontWeight: "600", textAlign: "right" },
  fileKind: { color: "#64748B", fontSize: 10, marginTop: 3, textAlign: "right" },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#0EA5E9", alignSelf: "flex-end", marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginHorizontal: 4 },
  userActions: { justifyContent: "flex-end" },
  assistantActions: { justifyContent: "flex-start" },
  action: { flexDirection: "row", alignItems: "center", minHeight: 28 },
  actionIcon: { alignItems: "center", justifyContent: "center" },
  actionLabel: { color: "#A1A1AA", fontSize: 11, marginRight: 4 },
  editInput: { minHeight: 96, maxHeight: 220, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: "#111827", backgroundColor: "#FFFFFF", fontSize: 16, lineHeight: 25, writingDirection: "rtl" },
  editButtons: { flexDirection: "row-reverse", justifyContent: "flex-start", gap: 8, marginTop: 10 },
  saveEditButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: "#2563EB" },
  saveEditText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  cancelEditButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#E5E7EB" },
  cancelEditText: { color: "#374151", fontSize: 13, fontWeight: "700" },
  editedLabel: { color: "#64748B", fontSize: 10, marginRight: 4 },
  glyphText: { color: "#A1A1AA", fontSize: 14, textAlign: "center" },
  markdown: { width: "100%" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.9)", justifyContent: "center", alignItems: "center" },
  fullImage: { width: "100%", height: "100%" },
  modalClose: { position: "absolute", top: Platform.OS === "ios" ? 56 : 32, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(45,45,45,0.9)", alignItems: "center", justifyContent: "center" },
});
