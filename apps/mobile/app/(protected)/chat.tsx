import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, TouchableOpacity, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { PremiumText as Text } from "../../src/components/ui/PremiumText";
import { AppLogo } from "../../src/components/ui/AppLogo";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { BottomSheet } from "../../src/components/ui/BottomSheet";
import { getTaskRating, getTaskUsage, saveTaskRating, type TaskRating, type TaskUsage } from "../../src/features/credits/credit-service";
import { useToast } from "../../src/components/ui/Toast";
import { supabase } from "../../src/lib/supabase/client";
import { getRotatingSuggestions, type SuggestionCard } from "../../src/features/chat/suggestions";

const STREAMING_ID = "local-streaming-assistant";

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
  const [activeTaskLabel, setActiveTaskLabel] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(routeConversationId));
  const [error, setError] = useState<string | null>(null);
  const [retryFailure, setRetryFailure] = useState<{ conversationId: string; userMessageId: string } | null>(null);
  const [adminAccess, setAdminAccess] = useState<{ userId: string | null; allowed: boolean }>({ userId: null, allowed: false });
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, MessageFeedback>>({});
  const [shareVisible, setShareVisible] = useState(false);
  const [usageVisible, setUsageVisible] = useState(false);
  const [taskUsage, setTaskUsage] = useState<TaskUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [taskRating, setTaskRating] = useState<TaskRating | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingNote, setRatingNote] = useState("");
  const [ratingSaving, setRatingSaving] = useState(false);
  const closeShareSheet = useCallback(() => setShareVisible(false), []);
  const composerRef = useRef<ChatComposerHandle>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionCard[]>(() => getRotatingSuggestions());
  const lock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamedTextRef = useRef("");
  const isAdmin = Boolean(user?.id && adminAccess.userId === user.id && adminAccess.allowed);

  const loadTaskUsage = useCallback(async () => {
    if (!conversationId) { setTaskUsage(null); return; }
    setUsageLoading(true);
    try { setTaskUsage(await getTaskUsage(conversationId)); } catch { setTaskUsage(null); }
    finally { setUsageLoading(false); }
  }, [conversationId]);

  useEffect(() => { void loadTaskUsage(); }, [loadTaskUsage, messages.length]);
  useEffect(() => {
    if (!conversationId) { setTaskRating(null); return; }
    void getTaskRating(conversationId).then((value) => { setTaskRating(value); if (value) { setRatingStars(value.stars); setRatingNote(value.note ?? ""); } }).catch(() => undefined);
  }, [conversationId, messages.length]);

  useEffect(() => {
    // Rotate in the background. The time-bucketed selector returns the same
    // cards after navigation/remounts within a bucket, so the user does not
    // lose their place or see cards jump on every render.
    const timer = setInterval(() => setSuggestions(getRotatingSuggestions()), 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setAdminAccess({ userId: null, allowed: false });
      return () => { active = false; };
    }
    setAdminAccess({ userId: user.id, allowed: false });
    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("suly_is_admin");
        if (active) setAdminAccess({ userId: user.id, allowed: !rpcError && data === true });
      } catch {
        if (active) setAdminAccess({ userId: user.id, allowed: false });
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    abortRef.current?.abort();
    setConversationId(routeConversationId || null);
    setMessages([]);
    setFeedbackByMessage({});
    setError(null);
    setRetryFailure(null);
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
    if (messages.length && isNearBottomRef.current) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const handleMessageScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const nearBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 96;
    isNearBottomRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom);
  }, []);

  const scrollToLatestMessage = useCallback(() => {
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const handleMessageContentSizeChange = useCallback(() => {
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, []);

  const reloadMessages = useCallback(async (id: string) => {
    const saved = await chatService.getMessages(id);
    setMessages(saved);
    try { setFeedbackByMessage(await chatService.getMessageFeedback(saved.map((message) => message.id))); } catch { setFeedbackByMessage({}); }
  }, []);

  const sendText = async (content: string, attachment?: ChatAttachment) => {
    await runOnce(lock, async () => {
      if (!user || !content.trim()) return;
      setError(null);
      setRetryFailure(null);
      setIsSending(true);
      setActiveTaskLabel("جاري تجهيز المهمة…");
      void logFrictionEvent({ eventKind: "task_start", screenKey: "chat", featureKey: "chat", stepKey: "send_message", conversationId });
      const controller = new AbortController();
      abortRef.current = controller;
      let id = conversationId;
      let savedUserMessage = false;
      let savedUserMessageId: string | null = null;
      let streamCompleted = false;
      try {
        if (!id) {
          const conversation = await chatService.createConversation();
          id = conversation.id;
          setConversationId(id);
          router.replace({ pathname: "/(protected)/chat", params: { conversationId: id } });
        }
        const conversationKey = id;
        streamedTextRef.current = "";
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
            savedUserMessageId = message.id;
            setMessages((current) => [...current.filter((item) => item.id !== STREAMING_ID), message]);
            if (mediaAssetId) {
              try { await chatService.attachMediaToMessage(mediaAssetId, message.id); }
              catch { void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "link_attachment", errorCode: "media_link_failed", conversationId: conversationKey }); }
            }
          },
          onChunk(text) {
            streamedTextRef.current += text;
            setMessages((current) => {
              const existing = current.find((item) => item.id === STREAMING_ID);
              if (existing) return current.map((item) => item.id === STREAMING_ID ? { ...item, content: item.content + text } : item);
              const assistant: ChatMessage = { id: STREAMING_ID, conversationId: conversationKey, role: "assistant", content: text, createdAt: new Date().toISOString(), modelId: null, status: "streaming" };
              return [...current, assistant];
            });
          },
          onTaskUpdate(task) {
            if (task.status === "running") setActiveTaskLabel(`جاري ${task.task}…`);
            else if (task.status === "completed") setActiveTaskLabel(`تم ${task.task}`);
            else if (task.status === "failed") setActiveTaskLabel(`تعذر ${task.task}`);
          },
        });
        streamCompleted = true;
        await reloadMessages(conversationKey);
      } catch (cause) {
        const partialContent = streamedTextRef.current.trim();
        if (controller.signal.aborted) {
          if (partialContent) {
            setMessages((current) => [...current.filter((item) => item.id !== STREAMING_ID), {
              id: `partial-${savedUserMessageId ?? Date.now()}`,
              conversationId: id ?? conversationId ?? "",
              role: "assistant",
              content: partialContent,
              createdAt: new Date().toISOString(),
              modelId: null,
              status: "sent",
            }]);
          } else {
            setMessages((current) => current.filter((item) => item.id !== STREAMING_ID));
          }
          setError(null);
          setRetryFailure(null);
          if (savedUserMessage) void logFrictionEvent({ eventKind: "response_stopped", screenKey: "chat", featureKey: "chat", stepKey: "response", conversationId });
        } else if (savedUserMessage && savedUserMessageId && id && !streamCompleted) {
          setMessages((current) => current.filter((item) => item.id !== STREAMING_ID));
          // The user message is already persisted. Retry only assistant
          // generation, never sendMessage again, so it cannot be duplicated.
          try {
            await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
            await chatService.retryAssistant({
              conversationId: id,
              userMessageId: savedUserMessageId,
              signal: controller.signal,
              onChunk(text) {
                streamedTextRef.current += text;
                setMessages((current) => {
                  const existing = current.find((item) => item.id === STREAMING_ID);
                  if (existing) return current.map((item) => item.id === STREAMING_ID ? { ...item, content: item.content + text } : item);
                  return [...current, { id: STREAMING_ID, conversationId: id!, role: "assistant", content: text, createdAt: new Date().toISOString(), modelId: null, status: "streaming" }];
                });
              },
            });
            streamCompleted = true;
            await reloadMessages(id);
            return;
          } catch {
            setError("يتأخر النموذج قليلًا، وسنترك لك زر إعادة المحاولة بدل إبقائك منتظرًا.");
            setRetryFailure({ conversationId: id, userMessageId: savedUserMessageId });
            void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "send_failed_after_retry", errorCode: "send_failed", conversationId: id });
          }
        } else {
          setError(cause instanceof Error ? cause.message : "تعذر إرسال الرسالة. تحقق من الاتصال وحاول مجددًا.");
          void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "send_message", errorCode: "send_failed", conversationId });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsSending(false);
        setActiveTaskLabel(null);
      }
    });
  };

  const retryResponse = async () => {
    const failed = retryFailure;
    if (!failed || isSending) return;
    await runOnce(lock, async () => {
      setError(null);
      setRetryFailure(null);
      setIsSending(true);
      setActiveTaskLabel("جاري إعادة تنفيذ المهمة…");
      const controller = new AbortController();
      abortRef.current = controller;
      streamedTextRef.current = "";
      let streamCompleted = false;
      try {
        await chatService.retryAssistant({
          ...failed,
          signal: controller.signal,
          onChunk(text) {
            streamedTextRef.current += text;
            setMessages((current) => {
              const existing = current.find((item) => item.id === STREAMING_ID);
              if (existing) return current.map((item) => item.id === STREAMING_ID ? { ...item, content: item.content + text } : item);
              return [...current, { id: STREAMING_ID, conversationId: failed.conversationId, role: "assistant", content: text, createdAt: new Date().toISOString(), modelId: null, status: "streaming" }];
            });
          },
          onTaskUpdate(task) {
            if (task.status === "running") setActiveTaskLabel(`جاري ${task.task}…`);
            else if (task.status === "completed") setActiveTaskLabel(`تم ${task.task}`);
          },
        });
        streamCompleted = true;
        await reloadMessages(failed.conversationId);
      } catch (cause) {
        if (controller.signal.aborted && streamedTextRef.current.trim()) {
          setMessages((current) => [...current.filter((item) => item.id !== STREAMING_ID), {
            id: `partial-${Date.now()}`,
            conversationId: failed.conversationId,
            role: "assistant",
            content: streamedTextRef.current.trim(),
            createdAt: new Date().toISOString(),
            modelId: null,
            status: "sent",
          }]);
        } else {
          setMessages((current) => current.filter((item) => item.id !== STREAMING_ID));
        }
        if (controller.signal.aborted) {
          setError(null);
          setRetryFailure(null);
        } else if (!streamCompleted) {
          setError(null);
          setRetryFailure(failed);
          void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "send_message", errorCode: "retry_failed", conversationId: failed.conversationId });
        } else {
          setError(cause instanceof Error ? cause.message : "تعذر تحميل الرد. أعد تحميل المحادثة.");
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsSending(false);
        setActiveTaskLabel(null);
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View style={styles.appBar}>
          <Pressable onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="فتح سجل المحادثات"><Text style={styles.headerIcon}>☰</Text></Pressable>
          <View style={styles.headerSpacer} />
          <View style={styles.headerActions}>
            {isAdmin ? <Pressable onPress={() => router.push("/(protected)/admin")} style={styles.adminShortcut} accessibilityRole="button" accessibilityLabel="لوحة التحكم"><Text style={styles.adminShortcutText}>إدارة</Text></Pressable> : null}
            <Pressable onPress={() => router.push("/(protected)/upgrade")} style={styles.upgradeShortcut} accessibilityRole="button" accessibilityLabel="ترقية الحساب"><Text style={styles.upgradeShortcutText}>ترقية</Text></Pressable>
            <TouchableOpacity onPress={() => { setUsageVisible(true); void loadTaskUsage(); }} style={styles.headerButton} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="إحصائيات استخدام المهمة"><Ionicons name="analytics-outline" size={20} color="#94A3B8" /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShareVisible(true)} style={styles.headerButton} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="مشاركة المحادثة"><Ionicons name="share-social-outline" size={18} color="#94A3B8" /></TouchableOpacity>
          </View>
        </View>

        {error ? <Pressable onPress={() => setError(null)} style={styles.errorBox}><Text style={styles.errorText}>{error}  ×</Text></Pressable> : null}
        {retryFailure ? <View style={styles.retryWarning} accessibilityRole="alert"><Text style={styles.retryWarningText}>حُفظت رسالتك، لكن تعذّر إكمال الرد.</Text><Pressable onPress={() => void retryResponse()} disabled={isSending} accessibilityRole="button" accessibilityLabel="إعادة محاولة الرد" style={styles.retryButton}><Text style={styles.retryButtonText}>{isSending ? "جارٍ إعادة المحاولة…" : "إعادة المحاولة"}</Text></Pressable></View> : null}
        {isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>جارٍ تحميل المحادثة…</Text></View> : messages.length === 0 ? (
          <View style={styles.empty}>
            <AppLogo size={72} accessibilityLabel="أيقونة سولي" />
            <Text style={styles.emptyTitle}>كيف أقدر أساعدك؟</Text>
            <Text style={styles.emptySubtitle}>اسألني عن أي درس أو واجب</Text>
            <View style={styles.suggestionsGrid}>
              {suggestions.map((suggestion) => <TouchableOpacity key={suggestion.text} activeOpacity={0.7} style={styles.suggestionCard} onPress={() => handleSend(suggestion.text)} accessibilityRole="button"><Ionicons name={suggestion.icon} size={19} color={colors.primary} /><Text style={styles.suggestionText}>{suggestion.text}</Text></TouchableOpacity>)}
            </View>
          </View>
        ) : (
          <View style={styles.messageListContainer}>
            <FlatList
              ref={listRef}
              style={styles.messages}
              contentContainerStyle={styles.messageContent}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              onScroll={handleMessageScroll}
              scrollEventThrottle={16}
              onContentSizeChange={handleMessageContentSizeChange}
            />
            {showScrollToBottom ? <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="الانتقال إلى أحدث رسالة"
              onPress={scrollToLatestMessage}
              style={styles.scrollToBottomButton}
            ><Ionicons name="chevron-down" size={22} color={colors.textPrimary} /></TouchableOpacity> : null}
          </View>
        )}
        {isUploadingAttachment ? <View style={styles.uploadStatus}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.loadingText}>جارٍ حفظ المرفق في Cloudinary…</Text></View> : null}
        <StreamingStatus isStreaming={isSending && !isUploadingAttachment} taskLabel={activeTaskLabel} onCancel={() => abortRef.current?.abort()} />
        <ChatComposer ref={composerRef} onSend={handleSend} disabled={isSending} isStreaming={isSending} onCancel={() => abortRef.current?.abort()} />
      </KeyboardAvoidingView>
      <ShareConversationSheet visible={shareVisible} conversationId={conversationId} title={shareTitle} plainText={shareText} onClose={closeShareSheet} />
      <BottomSheet visible={usageVisible} title="إحصائيات المهمة الحالية" onClose={() => setUsageVisible(false)}>
        {usageLoading ? <ActivityIndicator color={colors.primary} /> : taskUsage ? <View style={styles.usageSheet}>
          <Text style={styles.usageTaskTitle}>{taskUsage.taskTitle}</Text>
          <View style={styles.usageMetric}><Text style={styles.usageMetricLabel}>الرصيد المستخدم في هذه المهمة</Text><Text style={styles.usageMetricValue}>{taskUsage.charged.toLocaleString("ar-EG")}</Text></View>
          <Text style={styles.usageStatus}>الحالة: {taskUsage.status === "settled" ? "مكتملة" : taskUsage.status === "held" ? "قيد التنفيذ" : taskUsage.status}</Text>
          <Text style={styles.ratingPrompt}>{taskRating ? "تقييمك لهذه المهمة" : "قيّم هذه المهمة"}</Text>
          <View style={styles.starsRow}>{[1, 2, 3, 4, 5].map((star) => <Pressable key={star} onPress={() => setRatingStars(star)} accessibilityRole="button" accessibilityLabel={`تقييم ${star} نجوم`}><Text style={[styles.star, star <= (taskRating?.stars ?? ratingStars) && styles.starSelected]}>★</Text></Pressable>)}</View>
          <TextInput value={ratingNote} onChangeText={setRatingNote} placeholder="يمكنك تقديم ملاحظاتك للحصول على أفضل خدمة" placeholderTextColor={colors.textMuted} style={styles.ratingInput} multiline maxLength={2000} />
          <Pressable disabled={ratingSaving || ratingStars === 0} style={[styles.ratingSubmit, (ratingSaving || ratingStars === 0) && styles.disabled]} onPress={() => { if (!conversationId) return; setRatingSaving(true); void saveTaskRating({ conversationId, taskId: taskUsage.taskId, stars: ratingStars, note: ratingNote }).then(() => { setTaskRating({ stars: ratingStars, note: ratingNote.trim() || null }); show("تم إرسال تقييم المهمة.", "success"); }).catch((cause) => show(cause instanceof Error ? cause.message : "تعذر إرسال التقييم.", "error")).finally(() => setRatingSaving(false)); }}><Text style={styles.ratingSubmitText}>{ratingSaving ? "جارٍ الإرسال…" : "حفظ التقييم"}</Text></Pressable>
        </View> : <Text style={styles.loadingText}>لا يوجد استهلاك مسجل لهذه المحادثة بعد.</Text>}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  appBar: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21 },
  headerSpacer: { width: 42, height: 42 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerIcon: { color: colors.textPrimary, fontSize: 25 },
  adminShortcut: { minWidth: 42, height: 36, paddingHorizontal: 7, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  adminShortcutText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  upgradeShortcut: { minHeight: 32, borderRadius: 9, paddingHorizontal: 9, justifyContent: "center", backgroundColor: colors.primary },
  upgradeShortcutText: { color: colors.background, fontSize: 11, fontWeight: "800" },
  errorBox: { marginHorizontal: 14, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
  errorText: { color: colors.error, textAlign: "right", fontSize: 12 },
  retryWarning: { marginHorizontal: 14, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12 },
  retryWarningText: { color: colors.textSecondary, textAlign: "right", fontSize: 12, flex: 1 },
  retryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary },
  retryButtonText: { color: colors.surface, fontSize: 12, fontWeight: "700" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  loadingText: { color: colors.textSecondary },
  uploadStatus: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 8 },
  messages: { flex: 1 },
  messageListContainer: { flex: 1, position: "relative" },
  scrollToBottomButton: { position: "absolute", right: 24, bottom: 12, width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider, elevation: 5, zIndex: 2 },
  messageContent: { flexGrow: 1, paddingVertical: 12 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, gap: 12 },
  logo: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: "#1E7B60", alignItems: "center", justifyContent: "center", marginBottom: 8, shadowColor: "#10B981", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  logoLetter: { color: "#F8FAFC", fontSize: 40, fontWeight: "800" },
  emptyTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: "700" },
  emptySubtitle: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  suggestionsGrid: { width: "100%", maxWidth: 520, flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  suggestionCard: { width: "47%", height: 92, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center", gap: 8 },
  suggestionText: { color: colors.textPrimary, fontSize: 14, textAlign: "center", lineHeight: 20 },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  star: { color: colors.textMuted, fontSize: 25 },
  starSelected: { color: "#FBBF24" },
  ratingSheet: { gap: 14 },
  ratingPrompt: { color: colors.textSecondary, textAlign: "right" },
  ratingInput: { minHeight: 90, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, backgroundColor: colors.inputBackground, color: colors.textPrimary, padding: 12, textAlign: "right" },
  ratingSubmit: { minHeight: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  ratingSubmitText: { color: colors.background, fontWeight: "800" },
  usageSheet: { gap: 12 },
  usageTaskTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", textAlign: "right" },
  usageMetric: { padding: 18, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, alignItems: "center", gap: 5 },
  usageMetricLabel: { color: colors.textSecondary, textAlign: "center" },
  usageMetricValue: { color: colors.primary, fontSize: 32, fontWeight: "800" },
  usageStatus: { color: colors.textMuted, textAlign: "right" },
});
