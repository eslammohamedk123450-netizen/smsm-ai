import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../../src/features/auth/auth-provider";
import { chatService, titleFromMessage, type ChatMessage, type ChatModel, type Conversation } from "../../src/features/chat/chat-service";
import { runOnce } from "../../src/features/chat/submission-guard";
import { useIsAdmin } from "../../src/features/admin/use-is-admin";
import { ChatComposer } from "../../src/features/chat/components/ChatComposer";
import { ChatErrorBanner } from "../../src/features/chat/components/ChatErrorBanner";
import { MessageBubble } from "../../src/features/chat/components/MessageBubble";
import { StreamingStatus } from "../../src/features/chat/components/StreamingStatus";
import { RewardAdButton } from "../../src/features/ads/RewardAdButton";
import { BannerAdSlot } from "../../src/features/ads/BannerAdSlot";
import { colors } from "../../src/theme/colors";

const STREAMING_ID = "local-streaming-assistant";
const WIDE_BREAKPOINT = 900;

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMinutes = Math.floor((Date.now() - then) / 60000);
  if (diffMinutes < 1) return "الآن";
  if (diffMinutes < 60) return `منذ ${diffMinutes} د`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `منذ ${diffHours} س`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  return new Date(then).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

export default function ChatPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<ChatModel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const openedInitial = useRef(false);

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

  const openConversation = useCallback(async (id: string) => {
    abortRef.current?.abort();
    setConversationId(id);
    setHistoryOpen(false);
    setError(null);
    try {
      await reloadMessages(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل هذه المحادثة.");
    }
  }, [reloadMessages]);

  const refreshHistory = useCallback(async (openLatest = false) => {
    try {
      const list = await chatService.listConversations();
      setConversations(list);
      if (openLatest && !openedInitial.current && list.length > 0) {
        openedInitial.current = true;
        await openConversation(list[0].id);
      }
    } catch {
      // The list is a convenience; a failure must not block the composer.
    } finally {
      setIsLoadingHistory(false);
    }
  }, [openConversation]);

  useEffect(() => {
    if (!user) return;
    void refreshHistory(true);
  }, [user, refreshHistory]);

  const startNewChat = () => {
    abortRef.current?.abort();
    openedInitial.current = true;
    setConversationId(null);
    setMessages([]);
    setError(null);
    setHistoryOpen(false);
  };

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
          // The first message becomes the conversation title, so history reads
          // like a list of requests instead of identical placeholders.
          const conversation = await chatService.createConversation(titleFromMessage(content));
          id = conversation.id;
          setConversationId(id);
          setConversations((current) => [conversation, ...current]);
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
        void refreshHistory();
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

  const sidebar = (
    <View style={styles.sidebar}>
      <View style={styles.sidebarBrand}>
        <Text style={styles.brandName}>Suly Agent AI</Text>
        <Text style={styles.brandSub}>رفيقك الذكي</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={startNewChat} style={styles.newChatButton}>
        <Text style={styles.newChatText}>+ محادثة جديدة</Text>
      </Pressable>

      <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyContent}>
        <Text style={styles.historyLabel}>سجل المحادثات</Text>
        {isLoadingHistory ? (
          <Text style={styles.historyEmpty}>جارٍ التحميل…</Text>
        ) : conversations.length === 0 ? (
          <Text style={styles.historyEmpty}>لا توجد محادثات محفوظة بعد.</Text>
        ) : conversations.map((item) => {
          const active = item.id === conversationId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => void openConversation(item.id)}
              style={StyleSheet.flatten([styles.historyItem, active && styles.historyItemActive])}
            >
              <Text numberOfLines={1} style={StyleSheet.flatten([styles.historyTitle, active && styles.historyTitleActive])}>{item.title}</Text>
              <Text style={styles.historyDate}>{formatWhen(item.updatedAt)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sidebarFooter}>
        {isAdmin ? (
          <Pressable accessibilityRole="button" onPress={() => router.push("/admin")} style={styles.sideLink}>
            <Text style={styles.sideLinkText}>لوحة التحكم</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.push("/settings")} style={styles.sideLink}>
          <Text style={styles.sideLinkText}>الإعدادات</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}>
        <View style={styles.shell}>
          {wide ? sidebar : null}

          {!wide && historyOpen ? (
            <View style={styles.overlay}>
              <Pressable accessibilityRole="button" accessibilityLabel="إغلاق السجل" onPress={() => setHistoryOpen(false)} style={styles.backdrop} />
              <View style={styles.overlayPanel}>{sidebar}</View>
            </View>
          ) : null}

          <View style={styles.main}>
            <View style={styles.header}>
              {!wide ? (
                <Pressable accessibilityRole="button" onPress={() => setHistoryOpen(true)} style={styles.headerButton}>
                  <Text style={styles.headerButtonText}>السجل</Text>
                </Pressable>
              ) : null}
              <View style={styles.headerTitle}>
                <Text style={styles.title}>{conversations.find((item) => item.id === conversationId)?.title ?? "Suly Agent AI"}</Text>
                <Text style={styles.subtitle}>رفيقك الذكي · التوجيه التلقائي بين النماذج</Text>
              </View>
              {isAdmin ? (
                <Link href="/admin" asChild>
                  <Pressable style={StyleSheet.flatten([styles.headerButton, styles.headerButtonPrimary])} accessibilityRole="button">
                    <Text style={styles.headerButtonPrimaryText}>لوحة التحكم</Text>
                  </Pressable>
                </Link>
              ) : null}
            </View>

            <View style={styles.modelStatus}>
              {isLoadingModels ? <ActivityIndicator size="small" color={colors.accent} /> : null}
              <Text style={styles.modelStatusText}>
                {isLoadingModels ? "جارٍ تحميل النماذج…" : models.length ? `${models.length} نموذجًا مهيأً · يتم اختيار الأنسب تلقائيًا` : "التوجيه التلقائي متاح عند إعداد النماذج في الخادم"}
              </Text>
            </View>

            <ChatErrorBanner error={error} onDismiss={() => setError(null)} />

            {messages.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>كيف أقدر أساعدك؟</Text>
                <Text style={styles.emptyText}>اكتب طلبك وسأختار النموذج المناسب وأحفظ المحادثة في سجلك تلقائيًا.</Text>
              </View>
            ) : (
              <FlatList ref={listRef} style={styles.messages} contentContainerStyle={styles.messageContent} data={messages} renderItem={renderMessage} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" />
            )}

            <StreamingStatus isStreaming={isSending} onCancel={() => abortRef.current?.abort()} />
            <ChatComposer onSend={(text) => void handleSend(text)} disabled={isSending} isStreaming={isSending} onCancel={() => abortRef.current?.abort()} />
            <RewardAdButton />
            <BannerAdSlot />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  shell: { flex: 1, flexDirection: "row-reverse", width: "100%", maxWidth: 1240, alignSelf: "center" },
  main: { flex: 1, paddingHorizontal: 16, minWidth: 0 },
  sidebar: { width: 268, borderLeftWidth: 1, borderLeftColor: colors.divider, backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 12, gap: 12 },
  sidebarBrand: { paddingHorizontal: 4, gap: 2 },
  brandName: { color: colors.textPrimary, fontSize: 17, fontWeight: "800", textAlign: "right" },
  brandSub: { color: colors.textMuted, fontSize: 11, textAlign: "right" },
  newChatButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  newChatText: { color: colors.accent, fontWeight: "700" },
  historyScroll: { flex: 1 },
  historyContent: { gap: 6, paddingBottom: 10 },
  historyLabel: { color: colors.textMuted, fontSize: 11, textAlign: "right", marginBottom: 4, paddingHorizontal: 4 },
  historyEmpty: { color: colors.textSecondary, fontSize: 12, textAlign: "right", paddingHorizontal: 4 },
  historyItem: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: "transparent", gap: 2 },
  historyItemActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.divider },
  historyTitle: { color: colors.textSecondary, fontSize: 13, textAlign: "right" },
  historyTitleActive: { color: colors.textPrimary, fontWeight: "700" },
  historyDate: { color: colors.textMuted, fontSize: 10, textAlign: "right" },
  sidebarFooter: { gap: 6, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10 },
  sideLink: { minHeight: 38, borderRadius: 9, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
  sideLinkText: { color: colors.textPrimary, fontSize: 13 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row-reverse", zIndex: 20 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  overlayPanel: { width: 268, maxWidth: "85%" },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "800", textAlign: "right" },
  subtitle: { color: colors.textSecondary, fontSize: 11, marginTop: 3, textAlign: "right" },
  headerButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  headerButtonText: { color: colors.textPrimary, fontSize: 13 },
  headerButtonPrimary: { backgroundColor: colors.primary, marginRight: 8 },
  headerButtonPrimaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  modelStatus: { minHeight: 38, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 4 },
  modelStatusText: { color: colors.textMuted, fontSize: 11, textAlign: "right", flexShrink: 1 },
  messages: { flex: 1 },
  messageContent: { flexGrow: 1, paddingVertical: 12 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  emptyTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  emptyText: { maxWidth: 520, color: colors.textSecondary, textAlign: "center", lineHeight: 23 },
});
