import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../../src/features/auth/auth-provider";
import { chatService, type ChatMessage, type ChatModel } from "../../src/features/chat/chat-service";
import { runOnce } from "../../src/features/chat/submission-guard";
import { ChatComposer } from "../../src/features/chat/components/ChatComposer";
import { MessageBubble } from "../../src/features/chat/components/MessageBubble";
import { colors } from "../../src/theme/colors";

const suggestions = [
    { title: "اكتبلي كود لعبة بسيطة" },
    { title: "اشرحلي درس صعب بطريقة سهلة" },
    { title: "اعملي ملخص لدرس" },
    { title: "اكتبلي ايميل رسمي" },
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageBubble role={item.role === "user" ? "user" : "assistant"} content={item.content} isStreaming={item.status === "streaming"} />
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.appBar}>
        <Pressable onPress={() => console.log("Open Drawer")}><Text style={styles.icon}>☰</Text></Pressable>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Text style={styles.title}>Suly Agent AI</Text>
            <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success}} />
        </View>
        <Pressable><Text style={styles.icon}>＋</Text></Pressable>
      </View>

      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.logo}>🤖</Text>
          <Text style={styles.emptyTitle}>كيف أقدر أساعدك؟</Text>
          <View style={styles.suggestionsGrid}>
            {suggestions.map((s, i) => (
                <Pressable key={i} style={styles.suggestionCard}><Text style={styles.suggestionText}>{s.title}</Text></Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList ref={listRef} data={messages} renderItem={renderMessage} />
      )}
      <ChatComposer onSend={(text) => console.log(text)} isStreaming={isSending} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  appBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  icon: { color: colors.textPrimary, fontSize: 24 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  logo: { fontSize: 60, marginBottom: 20 },
  emptyTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 30 },
  suggestionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  suggestionCard: { padding: 16, borderRadius: 12, backgroundColor: colors.surface, width: "45%" },
  suggestionText: { color: colors.textPrimary, fontSize: 14 }
});
