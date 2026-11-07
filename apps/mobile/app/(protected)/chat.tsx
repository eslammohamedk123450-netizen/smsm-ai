import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DrawerActions } from "@react-navigation/native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useAuth } from "../../src/features/auth/auth-provider";
import { chatService, type ChatMessage } from "../../src/features/chat/chat-service";
import { runOnce } from "../../src/features/chat/submission-guard";
import { ChatComposer, type ChatAttachment, type ChatComposerHandle } from "../../src/features/chat/components/ChatComposer";
import { MessageBubble, type MessageFeedback } from "../../src/features/chat/components/MessageBubble";
import { StreamingStatus } from "../../src/features/chat/components/StreamingStatus";
import { uploadMediaFile } from "../../src/features/media/media-service";
import { logFrictionEvent } from "../../src/features/telemetry/friction";
import { colors } from "../../src/theme/colors";
import { ShareConversationSheet } from "../../src/features/chat/components/ShareConversationSheet";
import { useToast } from "../../src/components/ui/Toast";

const STREAMING_ID = "local-streaming-assistant";
const suggestions = ["اكتبلي كود لعبة بسيطة", "اشرحلي درس صعب بطريقة سهلة", "اعملي ملخص لدرس", "اكتبلي ايميل رسمي"];

export default function ChatPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const routeConversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(routeConversationId || null);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(routeConversationId));
  const [error, setError] = useState<string | null>(null);
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, MessageFeedback>>({});
  const [shareVisible, setShareVisible] = useState(false);
  const closeShareSheet = useCallback(() => setShareVisible(false), []);
  const composerRef = useRef<ChatComposerHandle>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    abortRef.current?.abort();
    setConversationId(routeConversationId || null);
    setMessages([]);
    setFeedbackByMessage({});
    setError(null);
    if (!routeConversationId) {
      setIsLoading(false);
      return () => { active = false; };
    }
    setIsLoading(true);
    void chatService.getMessages(routeConversationId).then(async (saved) => {
      if (!active) return;
      setMessages(saved);
      try { const feedback = await chatService.getMessageFeedback(saved.map((message) => message.id)); if (active) setFeedbackByMessage(feedback); } catch { /* feedback is optional to rendering */ }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل المحادثة.");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [routeConversationId]);

  useEffect(() => {
    if (messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const reloadMessages = useCallback(async (id: string) => {
    const saved = await chatService.getMessages(id);
    setMessages(saved);
    try { setFeedbackByMessage(await chatService.getMessageFeedback(saved.map((message) => message.id))); } catch { setFeedbackByMessage({}); }
  }, []);

  const sendText = async (content: string, attachment?: ChatAttachment) => {
    await runOnce(lock, async () => {
      if (!user || !content.trim()) return;
      setError(null);
      setIsSending(true);
      void logFrictionEvent({ eventKind: "task_start", screenKey: "chat", featureKey: "chat", stepKey: "send_message", conversationId });
      const controller = new AbortController();
      abortRef.current = controller;
      let id = conversationId;
      let savedUserMessage = false;
      try {
        if (!id) {
          const conversation = await chatService.createConversation();
          id = conversation.id;
          setConversationId(id);
          router.replace({ pathname: "/(protected)/chat", params: { conversationId: id } });
        }
        const conversationKey = id;
        let mediaAssetId: string | null = null;
        if (attachment) {
          setIsUploadingAttachment(true);
          try {
            const asset = await uploadMediaFile({ picked: attachment, featureKey: "chat", conversationId: conversationKey });
            mediaAssetId = asset.id;
          } catch (cause) {
            void logFrictionEvent({ eventKind: "upload_failed", screenKey: "chat", featureKey: "chat", stepKey: "chat_attachment", errorCode: "upload_failed", conversationId: conversationKey });
            throw cause;
          } finally { setIsUploadingAttachment(false); }
        }
        await chatService.sendMessage({
          conversationId: conversationKey,
          content,
          signal: controller.signal,
          async onUserSaved(message) {
            savedUserMessage = true;
            setMessages((current) => [...current.filter((item) => item.id !== STREAMING_ID), message]);
            if (mediaAssetId) {
              try { await chatService.attachMediaToMessage(mediaAssetId, message.id); }
              catch { void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "link_attachment", errorCode: "media_link_failed", conversationId: conversationKey }); }
            }
          },
          onChunk(text) {
            setMessages((current) => {
              const existing = current.find((item) => item.id === STREAMING_ID);
              if (existing) return current.map((item) => item.id === STREAMING_ID ? { ...item, content: item.content + text } : item);
              const assistant: ChatMessage = { id: STREAMING_ID, conversationId: conversationKey, role: "assistant", content: text, createdAt: new Date().toISOString(), modelId: null, status: "streaming" };
              return [...current, assistant];
            });
          },
        });
        await reloadMessages(conversationKey);
      } catch (cause) {
        setMessages((current) => current.filter((item) => item.id !== STREAMING_ID));
        if (controller.signal.aborted) {
          setError(savedUserMessage ? "أُوقف الرد. رسالة المستخدم محفوظة ويمكن إعادة المحاولة." : "تم إيقاف الطلب قبل حفظ الرسالة.");
          if (savedUserMessage) void logFrictionEvent({ eventKind: "response_stopped", screenKey: "chat", featureKey: "chat", stepKey: "response", conversationId });
        } else {
          setError(cause instanceof Error ? cause.message : "تعذر إرسال الرسالة. تحقق من الاتصال وحاول مجددًا.");
          void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "send_message", errorCode: "send_failed", conversationId });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsSending(false);
      }
    });
  };

  const handleSend = (content: string, attachment?: ChatAttachment) => { void sendText(content, attachment); };

  const updateFeedback = async (messageId: string, value: MessageFeedback | null) => {
    const previous = feedbackByMessage[messageId] ?? null;
    setFeedbackByMessage((current) => {
      const next = { ...current };
      if (value) next[messageId] = value; else delete next[messageId];
      return next;
    });
    try { await chatService.setMessageFeedback(messageId, value); }
    catch (cause) {
      setFeedbackByMessage((current) => { const next = { ...current }; if (previous) next[messageId] = previous; else delete next[messageId]; return next; });
      show(cause instanceof Error ? cause.message : "تعذّر حفظ التقييم. حاول مرة أخرى.", "error");
    }
  };

  const startNewChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setError(null);
    router.replace("/(protected)/chat");
  };

  const regenerate = async (messageId: string) => {
    if (!conversationId || isSending) return;
    const answerIndex = messages.findIndex((message) => message.id === messageId);
    if (answerIndex < 0) return;
    let userIndex = answerIndex - 1;
    while (userIndex >= 0 && messages[userIndex].role !== "user") userIndex -= 1;
    if (userIndex < 0) {
      show("تعذّر العثور على رسالة المستخدم المرتبطة بهذا الرد.", "error");
      return;
    }
    const history = messages.slice(0, userIndex + 1);
    setMessages(history);
    setIsSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await chatService.regenerateAssistant({
        conversationId,
        history,
        signal: controller.signal,
        onChunk(text) {
          setMessages((current) => {
            const existing = current.find((item) => item.id === STREAMING_ID);
            if (existing) return current.map((item) => item.id === STREAMING_ID ? { ...item, content: item.content + text } : item);
            return [...current, { id: STREAMING_ID, conversationId, role: "assistant", content: text, createdAt: new Date().toISOString(), modelId: null, status: "streaming" }];
          });
        },
      });
      await reloadMessages(conversationId);
    } catch (cause) {
      setMessages((current) => current.filter((item) => item.id !== STREAMING_ID));
      setError(cause instanceof Error ? cause.message : "تعذرت إعادة توليد الرد.");
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageBubble
      messageId={item.id}
      role={item.role === "user" ? "user" : "assistant"}
      content={item.content}
      isStreaming={item.status === "streaming"}
      feedback={feedbackByMessage[item.id] ?? null}
      onEdit={item.role === "user" ? (content) => composerRef.current?.editMessage(content) : undefined}
      onFeedback={item.role === "assistant" && item.status !== "streaming" ? (value) => updateFeedback(item.id, value) : undefined}
      onRegenerate={item.role === "assistant" ? () => void regenerate(item.id) : undefined}
    />
  );

  const shareTitle = messages.find((message) => message.role === "user")?.content.slice(0, 48) || "محادثة Suly";
  const shareText = messages.map((message) => `${message.role === "user" ? "أنت" : "Suly"}:\n${message.content}`).join("\n\n");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.appBar}>
          <Pressable onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="فتح سجل المحادثات"><Text style={styles.headerIcon}>☰</Text></Pressable>
          <View style={styles.brand}>
            <Text style={styles.title}>Suly Agent AI</Text>
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setShareVisible(true)} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="مشاركة المحادثة"><Text style={styles.headerIcon}>↗</Text></Pressable>
            <Pressable onPress={startNewChat} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="محادثة جديدة"><Text style={styles.headerIcon}>＋</Text></Pressable>
          </View>
        </View>

        {error ? <Pressable onPress={() => setError(null)} style={styles.errorBox}><Text style={styles.errorText}>{error}  ×</Text></Pressable> : null}
        {isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>جارٍ تحميل المحادثة…</Text></View> : messages.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.logo}><Text style={styles.logoLetter}>S</Text></View>
            <Text style={styles.emptyTitle}>كيف أقدر أساعدك؟</Text>
            <View style={styles.suggestionsGrid}>
              {suggestions.map((suggestion) => <Pressable key={suggestion} style={styles.suggestionCard} onPress={() => handleSend(suggestion)} accessibilityRole="button"><Text style={styles.suggestionText}>{suggestion}</Text></Pressable>)}
            </View>
          </View>
        ) : (
          <FlatList ref={listRef} style={styles.messages} contentContainerStyle={styles.messageContent} data={messages} renderItem={renderMessage} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" />
        )}
        {isUploadingAttachment ? <View style={styles.uploadStatus}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.loadingText}>جارٍ حفظ المرفق في Cloudinary…</Text></View> : null}
        <StreamingStatus isStreaming={isSending && !isUploadingAttachment} onCancel={() => abortRef.current?.abort()} />
        <ChatComposer ref={composerRef} onSend={handleSend} disabled={isSending} isStreaming={isSending} onCancel={() => abortRef.current?.abort()} />
      </KeyboardAvoidingView>
      <ShareConversationSheet visible={shareVisible} conversationId={conversationId} title={shareTitle} plainText={shareText} onClose={closeShareSheet} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  appBar: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerIcon: { color: colors.textPrimary, fontSize: 25 },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  errorBox: { marginHorizontal: 14, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
  errorText: { color: colors.error, textAlign: "right", fontSize: 12 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  loadingText: { color: colors.textSecondary },
  uploadStatus: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 8 },
  messages: { flex: 1 },
  messageContent: { flexGrow: 1, paddingVertical: 12 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  logo: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logoLetter: { color: colors.primary, fontSize: 48, fontWeight: "800" },
  emptyTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: "700", marginBottom: 24 },
  suggestionsGrid: { width: "100%", maxWidth: 520, flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  suggestionCard: { width: "47%", minHeight: 68, padding: 13, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, justifyContent: "center" },
  suggestionText: { color: colors.textPrimary, fontSize: 14, textAlign: "right", lineHeight: 20 },
});
