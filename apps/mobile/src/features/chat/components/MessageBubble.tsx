import { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors } from "../../../theme/colors";
import { useToast } from "../../../components/ui/Toast";
import { MarkdownView } from "./MarkdownView";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  messageId: string;
  isStreaming?: boolean;
  feedback?: Feedback;
  onFeedback?(value: Feedback): void | Promise<void>;
  onEdit?(content: string): void;
  onRegenerate?(): void;
}

export type Feedback = "like" | "dislike" | null;
export type MessageFeedback = Exclude<Feedback, null>;
const imagePattern = /(?:!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?))/gi;

type ActionKind = "edit" | "copy" | "like" | "dislike";

function ReactionGlyph({ kind, selected, copied }: { kind: ActionKind; selected?: boolean; copied?: boolean }) {
  if (kind === "like" || kind === "dislike") {
    const color = selected ? colors.background : colors.textSecondary;
    const fill = selected ? colors.background : colors.surfaceElevated;
    return (
      <View style={[styles.thumbGlyph, kind === "dislike" && styles.thumbDown]}>
        <View style={[styles.thumbPalm, { borderColor: color, backgroundColor: fill }]} />
        <View style={[styles.thumbFinger, { borderColor: color, backgroundColor: fill }]} />
        <View style={[styles.thumbWrist, { borderColor: color, backgroundColor: fill }]} />
      </View>
    );
  }
  const glyph = copied ? "✓" : kind === "edit" ? "✎" : "⧉";
  return <Text style={[styles.glyphText, copied && styles.copiedGlyph]}>{glyph}</Text>;
}

function MessageAction({
  kind,
  label,
  selected = false,
  copied = false,
  onPress,
}: {
  kind: ActionKind;
  label: string;
  selected?: boolean;
  copied?: boolean;
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
  const selectedStyle = selected ? (kind === "like" ? styles.likeSelected : styles.dislikeSelected) : null;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={handlePress}
        style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      >
        <View style={[styles.actionIcon, selectedStyle]}>
          <ReactionGlyph kind={kind} selected={selected} copied={copied} />
        </View>
        <Text style={[styles.actionLabel, selected && (kind === "like" ? styles.likeLabel : kind === "dislike" ? styles.dislikeLabel : null)]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function MessageBubble({ role, content, isStreaming = false, feedback = null, onFeedback, onEdit, onRegenerate }: MessageBubbleProps) {
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
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      show("تعذّر النسخ إلى الحافظة.", "error");
    }
  };

  const renderText = (part: string, key: string) => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    imagePattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = imagePattern.exec(part)) !== null) {
      if (match.index > cursor) nodes.push(<Text key={`${key}-text-${cursor}`} style={styles.text}>{part.slice(cursor, match.index)}</Text>);
      const uri = match[1] || match[2];
      nodes.push(<Image key={`${key}-image-${match.index}`} source={{ uri }} style={styles.image} resizeMode="contain" accessibilityLabel="صورة في الرسالة" />);
      cursor = match.index + match[0].length;
    }
    if (cursor < part.length || nodes.length === 0) nodes.push(<Text key={`${key}-tail`} style={styles.text}>{part.slice(cursor)}</Text>);
    return nodes;
  };

  const renderContent = () => content.split(/(```[\s\S]*?```)/g).map((part, index) => {
    if (part.startsWith("```")) {
      const code = part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "").trimEnd();
      return (
        <View key={`code-${index}`} style={styles.codeContainer}>
          <View style={styles.codeHeader}>
            <Text style={styles.codeHeaderText}>كود</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="نسخ الكود" onPress={() => void copyToClipboard(code)} style={styles.copyButton}>
              <Text style={styles.copyText}>نسخ</Text>
            </Pressable>
          </View>
          <Text selectable style={styles.codeText}>{code}</Text>
        </View>
      );
    }
    return <View key={`text-${index}`} style={styles.paragraph}>{renderText(part, `part-${index}`)}</View>;
  });

  const canShowActions = !isStreaming && content.length > 0;
  const canRegenerate = !isUser && canShowActions && Boolean(onRegenerate);

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      {!isUser && <View style={styles.avatar}><Text style={styles.avatarLetter}>S</Text></View>}
      <View style={[styles.messageColumn, isUser && styles.userColumn]}>
        <Pressable
          onLongPress={canRegenerate ? onRegenerate : undefined}
          delayLongPress={500}
          style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}
          accessibilityHint={canRegenerate ? "اضغط مطولًا لإعادة إنشاء الرد" : undefined}
        >
          {!isUser && !isStreaming
            ? <MarkdownView content={content} onCopyCode={(code) => void copyToClipboard(code)} />
            : isStreaming
              ? <Text style={styles.text}>{content}</Text>
              : renderContent()}
          {isStreaming && <View style={styles.pulse} />}
        </Pressable>
        {canShowActions && (
          <View style={styles.actions}>
            {isUser ? (
              <MessageAction kind="edit" label="تعديل" onPress={() => onEdit?.(content)} />
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
  row: { flexDirection: "row", width: "100%", marginVertical: 8, paddingHorizontal: 14, alignItems: "flex-start" },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, marginRight: 8, marginTop: 3, alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: colors.background, fontWeight: "800", fontSize: 15 },
  messageColumn: { maxWidth: "86%", minWidth: 0 },
  userColumn: { alignItems: "flex-end" },
  bubble: { borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, maxWidth: "100%" },
  userBubble: { backgroundColor: colors.primary },
  assistantBubble: { backgroundColor: colors.surface },
  paragraph: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  text: { fontSize: 16, lineHeight: 25, color: colors.textPrimary, textAlign: "right", writingDirection: "rtl" },
  codeContainer: { backgroundColor: colors.background, borderRadius: 12, padding: 12, marginVertical: 8, width: "100%", alignSelf: "stretch" },
  codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  codeHeaderText: { color: colors.textMuted, fontSize: 12 },
  copyButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, backgroundColor: colors.surfaceElevated },
  copyText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  codeText: { color: colors.textPrimary, fontFamily: "monospace", fontSize: 13, lineHeight: 20, textAlign: "left", writingDirection: "ltr" },
  image: { width: 250, height: 230, borderRadius: 10, marginVertical: 8, backgroundColor: colors.surfaceElevated },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 9, marginTop: 7 },
  action: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 34, opacity: 0.7 },
  actionPressed: { opacity: 1 },
  actionIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  actionLabel: { color: colors.textMuted, fontSize: 11 },
  likeSelected: { backgroundColor: colors.primary },
  dislikeSelected: { backgroundColor: colors.warning },
  likeLabel: { color: colors.primary, fontWeight: "700" },
  dislikeLabel: { color: colors.warning, fontWeight: "700" },
  glyphText: { color: colors.textSecondary, fontSize: 19, lineHeight: 22, textAlign: "center" },
  copiedGlyph: { color: colors.primary, fontSize: 17, fontWeight: "700" },
  thumbGlyph: { width: 18, height: 18 },
  thumbDown: { transform: [{ scaleY: -1 }] },
  thumbPalm: { position: "absolute", left: 7, top: 7, width: 9, height: 9, borderWidth: 1.4, borderRadius: 2 },
  thumbFinger: { position: "absolute", left: 2, top: 1, width: 6, height: 9, borderWidth: 1.4, borderTopLeftRadius: 5, borderTopRightRadius: 3, borderBottomLeftRadius: 2, transform: [{ rotate: "-12deg" }] },
  thumbWrist: { position: "absolute", left: 9, top: 15, width: 6, height: 3, borderWidth: 1.2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
});
