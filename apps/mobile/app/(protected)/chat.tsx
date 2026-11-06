import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useAuth } from "../../src/features/auth/auth-provider";
import { chatService, type ChatMessage, type ChatModel } from "../../src/features/chat/chat-service";
import { runOnce } from "../../src/features/chat/submission-guard";
import { useIsAdmin } from "../../src/features/admin/use-is-admin";
import { ChatComposer } from "../../src/features/chat/components/ChatComposer";
import { ChatErrorBanner } from "../../src/features/chat/components/ChatErrorBanner";
import { MessageBubble } from "../../src/features/chat/components/MessageBubble";
import { StreamingStatus } from "../../src/features/chat/components/StreamingStatus";
import { colors } from "../../src/theme/colors";

const STREAMING_ID = "local-streaming-assistant";

export default function ChatPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<ChatModel[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void chatService.getAvailableModels().then((available) => {
      if (active) setModels(available);
    }).catch(() => {
      if (active) setModels([]);
    }).finally(() => {
      if (active) setIsLoadingModels(false);
    });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const reloadMessages = useCallback(async (id: string) => {
    const saved = await chatService.getMessages(id);
    setMessages(saved);
  }, []);

  const handleSend = async (content: string) => {
    await runOnce(lock, async () => {
      if (!user || !content.trim()) return;
      setError(null);
      setIsSending(true);
      const controller = new AbortController();
      abortRef.current = controller;
      let id = conversationId;
      let savedUserMessage = false;
      try {
        if (!id) {
          const conversation = await chatService.createConversation();
          id = conversation.id;
          setConversationId(id);
        }
        await chatService.sendMessage({
          conversationId: id,
          content,
          signal: controller.signal,
          onUserSaved(message) {
            savedUserMessage = true;
            setMessages((current) => [...current, message]);
          },
          onChunk(text) {
            setMessages((current) => {
              const existing = current.find((item) => item.id === STREAMING_ID);
              if (existing) return current.map((item) => item.id === STREAMING_ID ? { ...item, content: item.content + text } : item);
              const assistant: ChatMessage = {
                id: STREAMING_ID,
                conversationId: id ?? "",
                role: "assistant",
                content: text,
                createdAt: new Date().toISOString(),
                modelId: null,
                status: "streaming",
              };
              return [...current, assistant];
            });
          },
        });
        await reloadMessages(id);
      } catch (cause) {
        setMessages((current) => current.filter((item) => item.id !== STREAMING_ID));
        if (controller.signal.aborted) setError(savedUserMessage ? "أُلغي تدفق الرد. بقيت رسالة المستخدم محفوظة." : "أُلغي الطلب قبل حفظ الرسالة.");
        else setError(cause instanceof Error ? cause.message : "تعذر إرسال الرسالة. تحقق من الاتصال وحاول مجددًا.");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsSending(false);
      }
    });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageBubble role={item.role === "user" ? "user" : "assistant"} content={item.content} isStreaming={item.status === "streaming"} />
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
        <View style={styles.shell}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Text style={styles.title}>SMSM AI</Text>
              <Text style={styles.subtitle}>دردشة نصية · توجيه تلقائي</Text>
            </View>
            {isAdmin ? (
              <Link href="/admin" asChild>
                <Pressable style={[styles.headerButton, styles.headerButtonPrimary]} accessibilityRole="button">
                  <Text style={styles.headerButtonPrimaryText}>لوحة التحكم</Text>
                </Pressable>
              </Link>
            ) : null}
            <Link href="/settings" asChild><Pressable style={styles.headerButton}><Text style={styles.headerButtonText}>الإعدادات</Text></Pressable></Link>
          </View>
          <View style={styles.modelStatus}>
            {isLoadingModels ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            <Text style={styles.modelStatusText}>{isLoadingModels ? "جارٍ تحميل النماذج…" : models.length ? `${models.length} نموذجًا مهيأً · اختيار النموذج الفردي غير متاح في مسار Flutter الحالي` : "التوجيه التلقائي متاح عند إعداد النماذج في الخادم"}</Text>
          </View>
          <ChatErrorBanner error={error} onDismiss={() => setError(null)} />
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>ابدأ محادثة نصية</Text>
              <Text style={styles.emptyText}>أرسل رسالة لاستخدام النماذج المهيأة في الخادم. لن تظهر هنا أدوات أو صور أو بحث غير مكتمل.</Text>
            </View>
          ) : (
            <FlatList ref={listRef} style={styles.messages} contentContainerStyle={styles.messageContent} data={messages} renderItem={renderMessage} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" />
          )}
          <StreamingStatus isStreaming={isSending} onCancel={() => abortRef.current?.abort()} />
          <ChatComposer onSend={(text) => void handleSend(text)} disabled={isSending} isStreaming={isSending} onCancel={() => abortRef.current?.abort()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  shell: { flex: 1, width: "100%", maxWidth: 980, alignSelf: "center", paddingHorizontal: 16 },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: "800", textAlign: "left" },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 3, textAlign: "left" },
  headerButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  headerButtonText: { color: colors.textPrimary, fontSize: 13 },
  headerButtonPrimary: { backgroundColor: colors.primary, marginRight: 8 },
  headerButtonPrimaryText: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  modelStatus: { minHeight: 38, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 4 },
  modelStatusText: { color: colors.textMuted, fontSize: 11, textAlign: "right", flexShrink: 1 },
  messages: { flex: 1 },
  messageContent: { flexGrow: 1, paddingVertical: 12 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  emptyTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  emptyText: { maxWidth: 560, color: colors.textSecondary, textAlign: "center", lineHeight: 23 },
});
