import { Pressable, StyleSheet, Text, View, Image, Alert } from "react-native";
import { colors } from "../../../theme/colors";
import * as Clipboard from 'expo-clipboard';

export interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming = false }: MessageBubbleProps) {
  const isUser = role === "user";

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("تم النسخ", "تم نسخ الكود للحافظة");
  };

  const renderContent = (text: string) => {
    const imageRegex = /(?:!\[.*?\]\((https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))\))|(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/gi;
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        const code = part.replace(/```/g, "").trim();
        return (
          <View key={index} style={styles.codeContainer}>
            <View style={styles.codeHeader}>
              <Text style={styles.codeHeaderText}>Code</Text>
              <Pressable onPress={() => copyToClipboard(code)}><Text style={styles.copyText}>نسخ</Text></Pressable>
            </View>
            <Text style={styles.codeText}>{code}</Text>
          </View>
        );
      }
      
      if (part.match(imageRegex)) {
        const match = imageRegex.exec(part);
        const url = match ? (match[1] || match[2]) : part;
        return <Image key={index} source={{ uri: url }} style={styles.image} resizeMode="contain" />;
      }

      return <Text key={index} style={styles.text}>{part}</Text>;
    });
  };

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.assistantRow]}>
      {!isUser && <View style={styles.avatar} />}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {renderContent(content)}
        {isStreaming && <View style={styles.pulse} />}
        {!isUser && !isStreaming && (
            <View style={styles.footer}>
                <Pressable style={styles.iconButton} onPress={() => copyToClipboard(content)}><Text style={styles.icon}>📋</Text></Pressable>
                <Pressable style={styles.iconButton}><Text style={styles.icon}>🔄</Text></Pressable>
                <Pressable style={styles.iconButton}><Text style={styles.icon}>👍</Text></Pressable>
                <Pressable style={styles.iconButton}><Text style={styles.icon}>👎</Text></Pressable>
            </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", width: "100%", marginVertical: 8, paddingHorizontal: 16 },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceElevated, marginRight: 8, marginTop: 4 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 16 },
  userBubble: { backgroundColor: colors.primary },
  assistantBubble: { backgroundColor: colors.surface },
  text: { fontSize: 16, lineHeight: 24, color: colors.textPrimary, textAlign: "right" },
  codeContainer: { backgroundColor: "#000000", borderRadius: 8, padding: 12, marginVertical: 8, direction: "ltr" },
  codeHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  codeHeaderText: { color: colors.textMuted, fontSize: 12 },
  copyText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  codeText: { color: "#FFFFFF", fontFamily: "monospace" },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 8 },
  image: { width: 250, height: 250, borderRadius: 8, marginVertical: 8, backgroundColor: colors.surfaceElevated },
  footer: { flexDirection: "row", marginTop: 12, gap: 16 },
  iconButton: { padding: 4 },
  icon: { fontSize: 16 }
});
