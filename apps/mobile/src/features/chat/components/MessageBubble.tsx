import { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { PremiumText as Text } from "../../../components/ui/PremiumText";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { colors } from "../../../theme/colors";
import { useToast } from "../../../components/ui/Toast";
import { MarkdownView } from "./MarkdownView";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  messageId: string;
  isStreaming?: boolean;
  cost?: number;
  remaining?: number;
  feedback?: Feedback;
  onFeedback?(value: Feedback): void | Promise<void>;
  onEdit?(content: string): void;
}

export type Feedback = "like" | "dislike" | null;
export type MessageFeedback = Exclude<Feedback, null>;
const imagePattern = /(?:!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?))/gi;

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
  isStreaming = false,
  cost = 12,
  remaining = 9850,
  feedback = null,
  onFeedback,
  onEdit,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const { show } = useToast();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

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

  const renderUserText = (part: string, key: string) => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    imagePattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = imagePattern.exec(part)) !== null) {
      if (match.index > cursor) nodes.push(<Text key={`${key}-text-${cursor}`} style={styles.userText}>{part.slice(cursor, match.index)}</Text>);
      const uri = match[1] || match[2];
      nodes.push(<Image key={`${key}-image-${match.index}`} source={{ uri }} style={styles.image} resizeMode="contain" accessibilityLabel="صورة في الرسالة" />);
      cursor = match.index + match[0].length;
    }
    if (cursor < part.length || nodes.length === 0) nodes.push(<Text key={`${key}-tail`} style={styles.userText}>{part.slice(cursor)}</Text>);
    return nodes;
  };

  const canShowActions = !isStreaming && content.length > 0;

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.messageColumn, isUser ? styles.userColumn : styles.assistantColumn]}>
        {/* Main Bubble */}
        <Pressable
          onLongPress={() => void copyToClipboard(content, true)}
          delayLongPress={500}
          style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}
          accessibilityHint="اضغط مطولاً لنسخ نص الرسالة"
        >
          {isUser ? (
            <View style={styles.paragraph}>{renderUserText(content, "user-msg")}</View>
          ) : (
            <>
              {/* Header inside assistant bubble matching web */}
              <View style={styles.assistantHeader}>
                <View style={styles.assistantBrand}>
                  <Image source={require("../../../../assets/suly-icon.png")} style={styles.sulySmallIcon} resizeMode="cover" />
                  <Text style={styles.assistantTitle}>Suly</Text>
                </View>
                <TouchableOpacity onPress={() => void copyToClipboard(content, true)} style={styles.headerCopyBtn} accessibilityLabel="نسخ الرد">
                  <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={copied ? "#0EA5E9" : "#A1A1AA"} />
                </TouchableOpacity>
              </View>

              {!isStreaming ? (
                <MarkdownView content={content} onCopyCode={(code) => void copyToClipboard(code)} />
              ) : (
                <Text style={styles.assistantText}>{content}</Text>
              )}
            </>
          )}

          {isStreaming && <View style={styles.pulse} />}
        </Pressable>

        {/* Sub-line under every assistant response matching web */}
        {!isUser && !isStreaming && (
          <Text style={styles.costMeta}>
            التكلفة: {cost} نقطة • المتبقي: {remaining.toLocaleString("en-US")}
          </Text>
        )}

        {/* Action icons */}
        {canShowActions && (
          <View style={[styles.actions, isUser ? styles.userActions : styles.assistantActions]}>
            {isUser ? (
              <>
                <MessageAction kind="copy" label="نسخ" copied={copied} showLabel onPress={() => void copyToClipboard(content, true)} />
                <MessageAction kind="edit" label="تعديل" onPress={() => onEdit?.(content)} />
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
  headerCopyBtn: { padding: 4, borderRadius: 6 },
  paragraph: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  userText: { fontSize: 16, lineHeight: 26, color: "#000000", fontWeight: "400", textAlign: "right", writingDirection: "rtl" },
  assistantText: { fontSize: 16, lineHeight: 26, color: "#F5F5F5", fontWeight: "400", textAlign: "right", writingDirection: "rtl" },
  costMeta: { fontSize: 11, color: "#A1A1AA", marginTop: 6, marginHorizontal: 4, textAlign: "right" },
  image: { width: "100%", height: 200, borderRadius: 12, marginVertical: 6 },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#0EA5E9", alignSelf: "flex-end", marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginHorizontal: 4 },
  userActions: { justifyContent: "flex-end" },
  assistantActions: { justifyContent: "flex-start" },
  action: { flexDirection: "row", alignItems: "center", minHeight: 28 },
  actionIcon: { alignItems: "center", justifyContent: "center" },
  actionLabel: { color: "#A1A1AA", fontSize: 11, marginRight: 4 },
  glyphText: { color: "#A1A1AA", fontSize: 14, textAlign: "center" },
});
