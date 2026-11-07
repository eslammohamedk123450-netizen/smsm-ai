import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors } from "../../../theme/colors";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  messageId: string;
  isStreaming?: boolean;
  feedback?: Feedback;
  onFeedback?(value: Feedback): void | Promise<void>;
  onRegenerate?(): void;
}

export type Feedback = "like" | "dislike" | null;
export type MessageFeedback = Exclude<Feedback, null>;
const imagePattern = /(?:!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|avif)(?:\?[^\s]*)?))/gi;

export function MessageBubble({ role, content, isStreaming = false, feedback = null, onFeedback, onRegenerate }: MessageBubbleProps) {
  const isUser = role === "user";

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("تم النسخ", "نُسخت الرسالة إلى الحافظة.");
    } catch {
      Alert.alert("تعذر النسخ", "لم يتمكن التطبيق من الوصول إلى الحافظة.");
    }
  };

  const shareMessage = async () => {
    try {
      await Share.share({ message: content });
    } catch {
      Alert.alert("تعذرت المشاركة", "لم يتمكن الجهاز من فتح قائمة المشاركة.");
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

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      {!isUser && <View style={styles.avatar}><Text style={styles.avatarLetter}>S</Text></View>}
      <View style={[styles.messageColumn, isUser && styles.userColumn]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {renderContent()}
          {isStreaming && <View style={styles.pulse} />}
        </View>
        {!isStreaming && content.length > 0 && (
          <View style={styles.actions}>
            <Pressable onPress={() => void copyToClipboard(content)} style={styles.action} accessibilityRole="button" accessibilityLabel="نسخ الرسالة">
              <Text style={styles.actionText}>نسخ</Text>
            </Pressable>
            <Pressable onPress={() => void shareMessage()} style={styles.action} accessibilityRole="button" accessibilityLabel="مشاركة الرسالة">
              <Text style={styles.actionText}>مشاركة</Text>
            </Pressable>
            {!isUser && <>
              <Pressable onPress={onRegenerate} style={styles.action} accessibilityRole="button" accessibilityLabel="إعادة إنشاء الرد">
                <Text style={styles.actionText}>إعادة</Text>
              </Pressable>
              <Pressable onPress={() => onFeedback?.(feedback === "like" ? null : "like")} style={[styles.action, feedback === "like" && styles.selectedAction]} accessibilityRole="button" accessibilityLabel="أعجبني">
                <Text style={[styles.actionText, feedback === "like" && styles.selectedText]}>إعجاب</Text>
              </Pressable>
              <Pressable onPress={() => onFeedback?.(feedback === "dislike" ? null : "dislike")} style={[styles.action, feedback === "dislike" && styles.selectedAction]} accessibilityRole="button" accessibilityLabel="لم يعجبني">
                <Text style={[styles.actionText, feedback === "dislike" && styles.selectedText]}>عدم إعجاب</Text>
              </Pressable>
            </>}
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
  avatarLetter: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  messageColumn: { maxWidth: "86%", minWidth: 0 },
  userColumn: { alignItems: "flex-end" },
  bubble: { borderRadius: 18, paddingHorizontal: 15, paddingVertical: 12, maxWidth: "100%" },
  userBubble: { backgroundColor: colors.primary },
  assistantBubble: { backgroundColor: colors.surface },
  paragraph: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  text: { fontSize: 16, lineHeight: 25, color: colors.textPrimary, textAlign: "right", writingDirection: "rtl" },
  codeContainer: { backgroundColor: "#030712", borderRadius: 12, padding: 12, marginVertical: 8, width: "100%", alignSelf: "stretch" },
  codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  codeHeaderText: { color: colors.textMuted, fontSize: 12 },
  copyButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, backgroundColor: colors.surfaceElevated },
  copyText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  codeText: { color: "#E2E8F0", fontFamily: "monospace", fontSize: 13, lineHeight: 20, textAlign: "left", writingDirection: "ltr" },
  image: { width: 250, height: 230, borderRadius: 10, marginVertical: 8, backgroundColor: colors.surfaceElevated },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  action: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "transparent" },
  actionText: { fontSize: 11, color: colors.textMuted },
  selectedAction: { backgroundColor: "#10B98122" },
  selectedText: { color: colors.primary, fontWeight: "700" },
});
