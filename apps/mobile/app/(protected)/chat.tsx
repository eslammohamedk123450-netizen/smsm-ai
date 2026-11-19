import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { PremiumText as Text } from "../../src/components/ui/PremiumText";
import { AppLogo } from "../../src/components/ui/AppLogo";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useAuth } from "../../src/features/auth/auth-provider";
import { useSulyTheme } from "../../src/theme/ThemeProvider";
import { useAppLocale } from "../../src/theme/LocaleProvider";
import type { ThemePalette } from "../../src/theme/colors";
import { chatService, type ChatMessage } from "../../src/features/chat/chat-service";
import { getRotatingSuggestions } from "../../src/features/chat/suggestions";
import { getStudioIntent } from "../../src/features/chat/image-generation";
import { chatStreamManager } from "../../src/features/chat/chat-stream-manager";
import { runOnce } from "../../src/features/chat/submission-guard";
import { ChatComposer, type ChatAttachment, type ChatComposerHandle } from "../../src/features/chat/components/ChatComposer";
import { MessageBubble, type MessageFeedback } from "../../src/features/chat/components/MessageBubble";
import { StreamingStatus } from "../../src/features/chat/components/StreamingStatus";
import { uploadMediaFile } from "../../src/features/media/media-service";
import { logFrictionEvent } from "../../src/features/telemetry/friction";
import { BottomSheet } from "../../src/components/ui/BottomSheet";
import { getCurrentCreditBalance, getTaskRating, saveTaskRating, type TaskRating } from "../../src/features/credits/credit-service";
import { useToast } from "../../src/components/ui/Toast";
import { supabase } from "../../src/lib/supabase/client";
import { integrationService, type ToolkitStatus } from "../../src/features/integrations/integration-service";
import { randomUUID } from "expo-crypto";
import { AgentExecutionCard } from "../../src/features/chat/components/AgentExecutionCard";
import { listConversationAgentProgress, type ChatAgentProgress } from "../../src/features/brain/task-service";

const BASIC_CHAT_ONLY = true;
const STREAMING_ID = "local-streaming-assistant";
const TASK_SUGGESTIONS = getRotatingSuggestions(Date.now(), 4);
const TASK_SUGGESTIONS_EN = [
  { text: "Plan my day simply", icon: "calendar-outline" as const },
  { text: "Explain a difficult lesson", icon: "book-outline" as const },
  { text: "Summarize a lesson", icon: "create-outline" as const },
  { text: "Write a professional email", icon: "bulb-outline" as const },
];
;

const WELCOME_MESSAGES = [
  { ar: "كل فكرة كبيرة تبدأ بسؤال صغير.", en: "Every big idea starts with a small question." },
  { ar: "أنا هنا، لنفكر فيها معًا.", en: "I’m here. Let’s think it through together." },
  { ar: "ما الذي يشغل بالك اليوم؟", en: "What’s on your mind today?" },
  { ar: "ابدأ من حيث أنت، وسنكمل سويًا.", en: "Start where you are; we’ll take it from there." },
  { ar: "لديك فكرة؟ لنمنحها شكلًا.", en: "Have an idea? Let’s give it shape." },
  { ar: "خطوة واحدة قد تغيّر الكثير.", en: "One step can change a lot." },
  { ar: "دعنا نحوّل أفكارك إلى خطوات واضحة.", en: "Let’s turn your ideas into clear steps." },
  { ar: "ما الذي تريد إنجازه الآن؟", en: "What would you like to accomplish now?" },
  { ar: "مساحتك للتفكير والتجربة تبدأ هنا.", en: "Your space to think and explore starts here." },
  { ar: "لا تحتاج إلى خطة كاملة لتبدأ.", en: "You don’t need a perfect plan to begin." },
  { ar: "احكِ لي الفكرة، ونرتبها معًا.", en: "Tell me the idea, and we’ll organize it." },
  { ar: "كل سؤال يفتح بابًا جديدًا.", en: "Every question opens a new door." },
  { ar: "جاهز نبدأ شيئًا مفيدًا؟", en: "Ready to make something useful?" },
  { ar: "لنبحث عن أبسط طريق للحل.", en: "Let’s find the simplest path to a solution." },
  { ar: "أفكارك تستحق أن تُستكشف.", en: "Your ideas deserve to be explored." },
  { ar: "ما أول شيء تريد فهمه؟", en: "What’s the first thing you want to understand?" },
  { ar: "معًا نجعل المعقد أوضح.", en: "Together, we can make the complex clearer." },
  { ar: "ابدأ بسؤالك، والباقي خطوة بخطوة.", en: "Start with your question; we’ll go step by step." },
  { ar: "لنبنِ شيئًا جيدًا اليوم.", en: "Let’s build something good today." },
  { ar: "أنا مستعد لمساعدتك على التقدم.", en: "I’m ready to help you move forward." },
  { ar: "فكرة جديدة؟ أنا أسمعك.", en: "A new idea? I’m listening." },
  { ar: "لنحوّل الحيرة إلى وضوح.", en: "Let’s turn uncertainty into clarity." },
  { ar: "ما التحدي الذي نعمل عليه؟", en: "What challenge are we working on?" },
  { ar: "يمكننا تقسيم أي مهمة إلى خطوات.", en: "We can break any task into steps." },
  { ar: "دعنا نبدأ بسؤال واحد واضح.", en: "Let’s begin with one clear question." },
  { ar: "التجربة الأولى لا تحتاج إلى الكمال.", en: "The first attempt doesn’t need to be perfect." },
  { ar: "أخبرني بما تريد، وسنحدد الطريق.", en: "Tell me what you need, and we’ll map the way." },
  { ar: "هنا تبدأ مساحة الاحتمالات.", en: "This is where possibilities begin." },
  { ar: "لنكتشف أفضل طريقة لتنفيذ فكرتك.", en: "Let’s discover the best way to bring your idea to life." },
  { ar: "ما الشيء الذي يمكننا تحسينه اليوم؟", en: "What can we improve today?" },
  { ar: "كل إنجاز يبدأ بقرار البدء.", en: "Every achievement begins with deciding to start." },
  { ar: "فكر بصوت عالٍ، وسأساعدك في الترتيب.", en: "Think out loud; I’ll help organize it." },
  { ar: "لنصل إلى إجابة تستحق وقتك.", en: "Let’s get to an answer worth your time." },
  { ar: "خطتك تبدأ من أول رسالة.", en: "Your plan starts with the first message." },
  { ar: "أنا هنا لأجعل خطوتك التالية أسهل.", en: "I’m here to make your next step easier." },
  { ar: "ما الذي نبتكره أو نحلّه معًا؟", en: "What shall we create or solve together?" },
] as const;

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 }}>
        <Ionicons name="alert-circle-outline" size={42} color={colors.error} />
        <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: "700", textAlign: "center" }}>
          {isArabic ? "تعذّر فتح المحادثة" : "Could not open chat"}
        </Text>
        <Text selectable style={{ color: colors.textSecondary, textAlign: "center", lineHeight: 22 }}>
          {error.message || (isArabic ? "حدث خطأ غير متوقع أثناء تجهيز الشاشة." : "An unexpected error occurred while preparing the screen.")}
        </Text>
        <Pressable onPress={() => void retry()} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 }}>
          <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>{isArabic ? "إعادة المحاولة" : "Retry"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type DisplayMessage = ChatMessage & {
  responseVariants?: Array<{ id: string; content: string }>;
  responseIndex?: number;
  responseOwnerId?: string;
};

function buildDisplayMessages(source: ChatMessage[], selectedByUser: Record<string, number>): DisplayMessage[] {
  const result: DisplayMessage[] = [];
  let index = 0;
  while (index < source.length) {
    const current = source[index];
    if (current.role !== "user") { result.push(current); index += 1; continue; }
    result.push(current);
    let next = index + 1;
    while (next < source.length && source[next].role === "assistant") next += 1;
    const variants = source.slice(index + 1, next).filter((message) => message.role === "assistant");
    if (variants.length) {
      const selected = Math.min(variants.length - 1, Math.max(0, selectedByUser[current.id] ?? variants.length - 1));
      const active = variants[selected];
      result.push({ ...active, responseVariants: variants.map((variant) => ({ id: variant.id, content: variant.content })), responseIndex: selected, responseOwnerId: current.id });
    }
    index = next;
  }
  return result;
}

type RequestedConnectorTask = { toolkit: ToolkitStatus["toolkit"]; intent: "read" | "write" };
type ConnectorWriteApproval = { requestId: string; originalText: string };

function requestedConnectorTask(text: string): RequestedConnectorTask | null {
  const read = /\b(show|search|find|list|get|read|summari[sz]e|check|review|fetch|open|look up|what|which|who|when|latest|recent|name|size|files?)\b|ابحث|دور|هات|جيب|اعرض|أظهر|اظهر|اقرأ|لخص|لخّص|راجع|افحص|تحقق|وريني|شوف|استخرج|آخر|اخر|وصلني|وصلتني|وصل|رسالة|رسائل|محتوى|مين|اسم|حجم|أسماء|اسماء|عدد|ملفات|موجودة|الموجودة/iu.test(text);
  const write = /\b(send|forward|reply|create|update|edit|delete|remove|write|commit|push|merge|star|unstar|invite|upload|share|move|rename|archive|label|schedule|copy|close|reopen|comment|fork|publish)\b|ابعت|ابعث|أرسل|ارسل|اكتب|انشئ|أنشئ|عدّل|عدل|احذف|امسح|ارفع|شارك|غيّر|غير|انقل|ادمج|حوّل|حول|أرشف|ارشف|انسخ|صنّف|صنف|انشر|اعمل.*(?:issue|رسالة|ملف)/iu.test(text);
  if (!read && !write) return null;
  const intent = write ? "write" : "read";
  const toolkits = [
    /\b(gmail|google mail|inbox|email|e-mail)\b|جيميل|جى ميل|بريدي|البريد|إيميلي|ايميلي|إيميل|ايميل|الايميل|الإيميل|رسائلي/iu.test(text) ? "gmail" : null,
    /\b(google drive|googledrive|drive|my drive)\b|جوجل درايف|غوغل درايف|درايف|ملفاتي على جوجل/iu.test(text) ? "googledrive" : null,
    /\b(github|git hub|repository|repo|pull request|issue)\b|جيت هاب|مستودع(?:ي|ات)?|ريبو|طلبات السحب/iu.test(text) ? "github" : null,
  ].filter((toolkit): toolkit is ToolkitStatus["toolkit"] => toolkit !== null);
  return toolkits.length === 1 ? { toolkit: toolkits[0], intent } : null;
}

export default function ChatPage() {
  const { colors } = useSulyTheme();
  const { isArabic } = useAppLocale();
  const styles = useMemo(() => createStyles(colors, isArabic), [colors, isArabic]);
  const { user } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string | string[]; projectId?: string | string[] }>();
  const routeConversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const routeProjectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentProgress, setAgentProgress] = useState<ChatAgentProgress[]>([]);
  const [activeTaskMessageId, setActiveTaskMessageId] = useState<string | null>(null);
  const [cancelPendingMessageId, setCancelPendingMessageId] = useState<string | null>(null);
  const [responseIndexByUser, setResponseIndexByUser] = useState<Record<string, number>>({});
  const [conversationId, setConversationId] = useState<string | null>(routeConversationId || null);
  const [isSending, setIsSending] = useState(false);
  const [activeTaskLabel, setActiveTaskLabel] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(routeConversationId));
  const [error, setError] = useState<string | null>(null);
  const [retryFailure, setRetryFailure] = useState<{ conversationId: string; userMessageId: string } | null>(null);
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, MessageFeedback>>({});
  const [taskRating, setTaskRating] = useState<TaskRating | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingNote, setRatingNote] = useState("");
  const [ratingSaving, setRatingSaving] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const suggestions = isArabic ? TASK_SUGGESTIONS : TASK_SUGGESTIONS_EN;
  const [connectorApproval, setConnectorApproval] = useState<{ content: string; toolkit: ToolkitStatus["toolkit"]; intent: "read" | "write"; connected: boolean; accountExists: boolean; disabled: boolean; writeApproval: ConnectorWriteApproval | null } | null>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [welcomeMessageIndex, setWelcomeMessageIndex] = useState(() => Math.floor(Math.random() * WELCOME_MESSAGES.length));
  const previousWelcomeRouteRef = useRef(routeConversationId ?? null);
  useEffect(() => {
    const nextRoute = routeConversationId ?? null;
    if (previousWelcomeRouteRef.current === nextRoute) return;
    previousWelcomeRouteRef.current = nextRoute;
    setWelcomeMessageIndex((current) => {
      let next = Math.floor(Math.random() * (WELCOME_MESSAGES.length - 1));
      if (next >= current) next += 1;
      return next;
    });
  }, [routeConversationId]);
  const lock = useRef(false);
  const preflightLock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelAgentExecution = useCallback((userMessageId: string) => {
    if (!abortRef.current) return;
    setCancelPendingMessageId(userMessageId);
    abortRef.current.abort();
  }, []);
  const internalConversationTransitionRef = useRef<string | null>(null);
  const optimisticMessageIdRef = useRef<string | null>(null);
  const streamedTextRef = useRef("");
  const displayMessages = useMemo(() => buildDisplayMessages(messages, responseIndexByUser), [messages, responseIndexByUser]);
  const hasActiveAgentExecution = agentProgress.some((progress) => !["completed", "failed", "cancelled"].includes(progress.status));

  const refreshCreditBalance = useCallback(async () => {
    if (!user?.id) {
      setCreditBalance(null);
      return;
    }
    try { setCreditBalance(await getCurrentCreditBalance()); }
    catch { setCreditBalance(null); }
  }, [user?.id]);

  useEffect(() => {
    if (!conversationId) { setTaskRating(null); return; }
    void getTaskRating(conversationId).then((value) => { setTaskRating(value); if (value) { setRatingStars(value.stars); setRatingNote(value.note ?? ""); } }).catch(() => undefined);
  }, [conversationId, messages.length]);
  useFocusEffect(useCallback(() => {
    void refreshCreditBalance();
    return undefined;
  }, [refreshCreditBalance]));


  useEffect(() => {
    let active = true;
    if (routeConversationId && internalConversationTransitionRef.current === routeConversationId) {
      internalConversationTransitionRef.current = null;
      setConversationId(routeConversationId);
      return () => { active = false; };
    }
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    setConversationId(routeConversationId || null);
    setMessages([]);
    setAgentProgress([]);
    setActiveTaskMessageId(null);
    setCancelPendingMessageId(null);
    setResponseIndexByUser({});
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
      if (active) setError(cause instanceof Error ? cause.message : isArabic ? "تعذر تحميل المحادثة." : "Could not load conversation.");
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

  useEffect(() => {
    if (BASIC_CHAT_ONLY || !conversationId) { setAgentProgress([]); setActiveTaskMessageId(null); setCancelPendingMessageId(null); return; }
    let active = true;
    const refresh = async () => {
      try {
        const progress = await listConversationAgentProgress(conversationId);
        if (active) {
          setAgentProgress(progress);
          const terminalIds = new Set(progress.filter((item) => ["completed", "failed", "cancelled"].includes(item.status)).map((item) => item.userMessageId));
          if (terminalIds.size) setCancelPendingMessageId((current) => current && terminalIds.has(current) ? null : current);
        }
      } catch {
        // Keep the last owner-visible snapshot during transient network failures.
      }
    };
    void refresh();
    if (isSending || hasActiveAgentExecution) {
      const interval = setInterval(() => { void refresh(); }, 2000);
      return () => { active = false; clearInterval(interval); };
    }
    return () => { active = false; };
  }, [conversationId, isSending, hasActiveAgentExecution]);

  useEffect(() => {
    if (!conversationId) return;
    return chatStreamManager.subscribe(conversationId, (snapshot) => {
      streamedTextRef.current = snapshot.text;
      setIsSending(snapshot.active);
      setActiveTaskLabel(snapshot.taskLabel);
      if (snapshot.text) {
        setMessages((current) => {
          const existing = current.find((item) => item.id === STREAMING_ID);
          if (existing) return current.map((item) => item.id === STREAMING_ID ? { ...item, content: snapshot.text, status: snapshot.active ? "streaming" : "sent" } : item);
          return [...current, { id: STREAMING_ID, conversationId, role: "assistant", content: snapshot.text, createdAt: new Date().toISOString(), modelId: null, status: snapshot.active ? "streaming" : "sent" }];
        });
      }
      if (!snapshot.active) {
        void reloadMessages(conversationId).catch(() => undefined);
        void refreshCreditBalance();
        if (snapshot.error && !snapshot.error.includes("أُلغي")) setError(snapshot.error);
      }
    });
  }, [conversationId, reloadMessages, refreshCreditBalance]);

  const sendText = async (content: string, attachment?: ChatAttachment, writeApproval?: ConnectorWriteApproval) => {
    await runOnce(lock, async () => {
      if (!user || (!content.trim() && !attachment)) return;
      const studioIntent = getStudioIntent(content);
      const optimisticMessageId = `optimistic-${Date.now()}`;
      optimisticMessageIdRef.current = optimisticMessageId;
      setMessages((current) => [...current, {
        id: optimisticMessageId,
        conversationId: conversationId ?? "pending",
        role: "user",
        content: content.trim() || (attachment?.kind === "image" ? isArabic ? "حلّل الصورة المرفقة من فضلك." : "Please analyze the attached image." : isArabic ? "اقرأ المرفق وأجب عنه من فضلك." : "Please read the attachment and respond."),
        createdAt: new Date().toISOString(),
        modelId: null,
        status: "sent",
      }]);
      setError(null);
      setRetryFailure(null);
      
      setActiveTaskMessageId(null);
      setCancelPendingMessageId(null);
      setIsSending(true);
      setActiveTaskLabel(studioIntent ? isArabic ? "تجهيز بطاقة الاستوديو…" : "Preparing Studio card…" : isArabic ? "جارٍ الرد على رسالتك…" : "Responding to your message…");
      void logFrictionEvent({ eventKind: "task_start", screenKey: "chat", featureKey: "chat", stepKey: "send_message", conversationId });
      const controller = new AbortController();
      abortRef.current = controller;
      let id = conversationId;
      let createdConversationId: string | null = null;
      let savedUserMessage = false;
      let savedUserMessageId: string | null = null;
      let streamCompleted = false;
      try {
        if (!id) {
          const conversation = await chatService.createConversation(isArabic ? "محادثة جديدة" : "New Conversation", routeProjectId || null);
          id = conversation.id;
          createdConversationId = conversation.id;
          setConversationId(id);
          internalConversationTransitionRef.current = id;
          // Update the current route params without replacing/remounting the chat screen.
          // The active message list and in-flight stream must survive first-send navigation.
          router.setParams({ conversationId: id });
        }
        const conversationKey = id;
        streamedTextRef.current = "";
        let uploadedAsset: Awaited<ReturnType<typeof uploadMediaFile>> | undefined;
        if (attachment) {
          setIsUploadingAttachment(true);
          try {
            uploadedAsset = await uploadMediaFile({ picked: attachment, featureKey: "chat", conversationId: conversationKey });
          } catch (cause) {
            setIsUploadingAttachment(false);
            throw cause;
          } finally { setIsUploadingAttachment(false); }
        }
        await chatService.sendMessage({
          conversationId: conversationKey,
          content,
          modelProfileKey: "auto",
          executionMode: "chat",
          writeApproval,
          mediaAsset: uploadedAsset,
          signal: controller.signal,
          async onUserSaved(message) {
            setActiveTaskMessageId(message.id);
            savedUserMessage = true;
            savedUserMessageId = message.id;
            setMessages((current) => [...current.filter((item) => item.id !== STREAMING_ID && item.id !== optimisticMessageId), message]);
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
            if (task.status === "running") setActiveTaskLabel(isArabic ? `جاري ${task.task}…` : `${task.task}…`);
            else if (task.status === "completed") setActiveTaskLabel(isArabic ? `تم ${task.task}` : `${task.task} completed`);
            else if (task.status === "failed") setActiveTaskLabel(isArabic ? `تعذر ${task.task}` : `${task.task} failed`);
          },
        });
        streamCompleted = true;
        await reloadMessages(conversationKey);
      } catch (cause) {
        if (!savedUserMessage) {
          setMessages((current) => current.filter((item) => item.id !== optimisticMessageId));
          if (createdConversationId) {
            try { await chatService.deleteConversation(createdConversationId); } catch { /* best-effort cleanup of an unsent draft */ }
            setConversationId(null);
            router.setParams({ conversationId: undefined });
          }
        }
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
        } else if (savedUserMessage && savedUserMessageId && id && !streamCompleted && !writeApproval) {
          setMessages((current) => current.filter((item) => item.id !== STREAMING_ID));
          // The user message is already persisted. Retry only assistant
          // generation, never sendMessage again, so it cannot be duplicated.
          try {
            await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
            await chatService.retryAssistant({
              conversationId: id,
              userMessageId: savedUserMessageId,
              modelProfileKey: "auto",
              executionMode: "chat",
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
          } catch (retryCause) {
            const retryReason = retryCause instanceof Error ? retryCause.message.trim().slice(0, 240) : "";
            setError(retryReason
              ? (isArabic ? `تعذر إكمال الرد بعد إعادة المحاولة: ${retryReason}` : `The response still failed after retry: ${retryReason}`)
              : (isArabic ? "تعذر إكمال الرد بعد إعادة المحاولة. يمكنك المحاولة مرة أخرى." : "The response could not be completed after retry. You can try again."));
            setRetryFailure({ conversationId: id, userMessageId: savedUserMessageId });
            void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "send_failed_after_retry", errorCode: "send_failed_after_retry", conversationId: id });
          }
        } else {
          setError(cause instanceof Error ? cause.message : isArabic ? "تعذر إرسال الرسالة. تحقق من الاتصال وحاول مجددًا." : "Could not send the message. Check your connection and try again.");
          void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "send_message", errorCode: "send_failed", conversationId });
        }
      } finally {
        if (optimisticMessageIdRef.current === optimisticMessageId) optimisticMessageIdRef.current = null;
        if (abortRef.current === controller) abortRef.current = null;
        void refreshCreditBalance();
        setIsSending(false);
        setActiveTaskMessageId(null);
        setActiveTaskLabel(null);
      }
    });
  };

  const retryResponse = async () => {
    const failed = retryFailure;
    if (!failed || isSending) return;
    setActiveTaskMessageId(failed.userMessageId);
    setCancelPendingMessageId(null);
    await runOnce(lock, async () => {
      setError(null);
      setRetryFailure(null);
      
      setIsSending(true);
      setActiveTaskLabel(isArabic ? "جاري إعادة تنفيذ المهمة…" : "Retrying task…");
      const controller = new AbortController();
      abortRef.current = controller;
      streamedTextRef.current = "";
      let streamCompleted = false;
      try {
        await chatService.retryAssistant({
          ...failed,
          modelProfileKey: "auto",
          executionMode: "chat",
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
            if (task.status === "running") setActiveTaskLabel(isArabic ? `جاري ${task.task}…` : `${task.task}…`);
            else if (task.status === "completed") setActiveTaskLabel(isArabic ? `تم ${task.task}` : `${task.task} completed`);
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
          setError(cause instanceof Error ? cause.message : isArabic ? "تعذر تحميل الرد. أعد تحميل المحادثة." : "Could not load the response. Reload the conversation.");
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        void refreshCreditBalance();
        setIsSending(false);
        setActiveTaskMessageId(null);
        setActiveTaskLabel(null);
      }
    });
  };

  const cancelConnectorApproval = () => {
    setConnectorApproval(null);
    preflightLock.current = false;
  };

  const continueConnectorApproval = async () => {
    const approval = connectorApproval;
    if (!approval) return;
    setConnectorApproval(null);
    setIsSending(true);
    setActiveTaskLabel(approval.connected ? isArabic ? "جارٍ تجهيز الإجراء الموافق عليه…" : "Preparing the approved action…" : isArabic ? "جارٍ الاتصال بالتطبيق…" : "Connecting to the app…");
    let keepApprovalOpen = false;
    try {
      if (!approval.connected) {
        const returned = await integrationService.openConnectFlow(approval.toolkit);
        if (!returned) return;
        const verified = await integrationService.preflight(approval.content);
        if (!verified.required || !verified.connected) {
          show(isArabic ? "لم يتم تأكيد الاتصال، لذلك لم يبدأ الطلب." : "The connection was not confirmed, so the request did not start.", "error");
          return;
        }
        if (approval.intent === "write") {
          keepApprovalOpen = true;
          setConnectorApproval({ ...approval, connected: true, accountExists: true, disabled: false });
          return;
        }
      }
      await sendText(approval.content, undefined, approval.writeApproval ?? undefined);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : isArabic ? "تعذّر إكمال الاتصال، ولم يبدأ الطلب." : "Could not complete the connection. The request did not start.", "error");
    } finally {
      if (!keepApprovalOpen) preflightLock.current = false;
      setIsSending(false);
      setActiveTaskLabel(null);
    }
  };

  const handleSend = (content: string, attachment?: ChatAttachment) => {
    void sendText(content, attachment);
  };

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
      show(cause instanceof Error ? cause.message : isArabic ? "تعذّر حفظ التقييم. حاول مرة أخرى." : "Could not save the rating. Try again.", "error");
    }
  };

  const editMessageAndRegenerate = async (messageId: string, content: string) => {
    if (!conversationId || isSending) return;
    setActiveTaskMessageId(messageId);
    setCancelPendingMessageId(null);
    const userIndex = messages.findIndex((message) => message.id === messageId && message.role === "user");
    if (userIndex < 0) throw new Error(isArabic ? "تعذر العثور على الرسالة المطلوب تعديلها." : "Could not find the message to edit.");
    const updatedUser = await chatService.updateUserMessage(messageId, content);
    const history = messages.slice(0, userIndex + 1).map((message) => message.id === messageId ? updatedUser : message);
    setMessages((current) => current.map((message) => message.id === messageId ? updatedUser : message));
    setResponseIndexByUser((current) => { const next = { ...current }; delete next[messageId]; return next; });
    setError(null);
    setIsSending(true);
    setActiveTaskLabel(isArabic ? "جارٍ إعادة الرد على الرسالة المعدلة…" : "Regenerating the edited message response…");
    const controller = new AbortController();
    abortRef.current = controller;
    streamedTextRef.current = "";
    try {
      await chatService.regenerateAssistant({
        conversationId,
        history,
        modelProfileKey: "auto",
        executionMode: "chat",
        signal: controller.signal,
        onChunk(text) {
          streamedTextRef.current += text;
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
      throw cause instanceof Error ? cause : new Error(isArabic ? "تعذرت إعادة توليد الرد بعد التعديل." : "Could not regenerate the response after editing.");
    } finally {
      abortRef.current = null;
      void refreshCreditBalance();
      setIsSending(false);
      setActiveTaskMessageId(null);
      setActiveTaskLabel(null);
    }
  };

  const regenerate = async (messageId: string) => {
    if (!conversationId || isSending) return;
    const answerIndex = messages.findIndex((message) => message.id === messageId);
    if (answerIndex < 0) return;
    let userIndex = answerIndex - 1;
    while (userIndex >= 0 && messages[userIndex].role !== "user") userIndex -= 1;
    if (userIndex < 0) {
      show(isArabic ? "تعذّر العثور على رسالة المستخدم المرتبطة بهذا الرد." : "Could not find the user message associated with this response.", "error");
      return;
    }
    setActiveTaskMessageId(messages[userIndex].id);
    setCancelPendingMessageId(null);
    const history = messages.slice(0, userIndex + 1);
    setMessages(history);
    setIsSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await chatService.regenerateAssistant({
        conversationId,
        history,
        modelProfileKey: "auto",
        executionMode: "chat",
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
      setError(cause instanceof Error ? cause.message : isArabic ? "تعذرت إعادة توليد الرد." : "Could not regenerate the response.");
    } finally {
      abortRef.current = null;
      void refreshCreditBalance();
      setIsSending(false);
      setActiveTaskMessageId(null);
    }
  };

  const renderMessage = ({ item }: { item: DisplayMessage }) => {
    const execution = BASIC_CHAT_ONLY ? undefined : item.role === "user" ? agentProgress.find((progress) => progress.userMessageId === item.id) : undefined;
    return (
      <View>
    <MessageBubble
      messageId={item.id}
      role={item.role === "user" ? "user" : "assistant"}
      content={item.content}
      attachments={item.attachments}
      isStreaming={item.status === "streaming"}
      generationState={item.generationState}
      studioIntent={BASIC_CHAT_ONLY ? null : item.role === "user" ? getStudioIntent(item.content) : null}
      onOpenStudio={() => router.push("/studio")}
      feedback={feedbackByMessage[item.id] ?? null}
      edited={Boolean(item.editedAt)}
      responseVariants={item.responseVariants}
      responseIndex={item.responseIndex}
      onResponseIndexChange={(index) => { if (item.responseOwnerId) setResponseIndexByUser((current) => ({ ...current, [item.responseOwnerId!]: index })); }}
      onEditSave={item.role === "user" ? (content) => editMessageAndRegenerate(item.id, content) : undefined}
      onFeedback={item.role === "assistant" && item.status !== "streaming" ? (value) => updateFeedback(item.id, value) : undefined}
    />
    {execution ? <AgentExecutionCard progress={execution} canCancel={isSending && activeTaskMessageId === execution.userMessageId && Boolean(abortRef.current)} cancelPending={cancelPendingMessageId === execution.userMessageId} onCancel={() => cancelAgentExecution(execution.userMessageId)} /> : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View style={styles.appBar}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace("/home" as never)}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={isArabic ? "الخروج من المحادثة" : "Exit conversation"}
          >
            <Ionicons name="arrow-forward" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        {error ? <Pressable onPress={() => setError(null)} style={styles.errorBox}><Text style={styles.errorText}>{error}  ×</Text></Pressable> : null}
        {retryFailure ? <View style={styles.retryWarning} accessibilityRole="alert"><Text style={styles.retryWarningText}>{isArabic ? "حُفظت رسالتك، لكن تعذّر إكمال الرد." : "Your message was saved, but the response could not be completed."}</Text><Pressable onPress={() => void retryResponse()} disabled={isSending} accessibilityRole="button" accessibilityLabel={isArabic ? "إعادة محاولة الرد" : "Retry response"} style={styles.retryButton}><Text style={styles.retryButtonText}>{isSending ? (isArabic ? "جارٍ إعادة المحاولة…" : "Retrying…") : (isArabic ? "إعادة المحاولة" : "Retry")}</Text></Pressable></View> : null}
        {isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>{isArabic ? "جارٍ تحميل المحادثة…" : "Loading conversation…"}</Text></View> : messages.length === 0 ? (
          <View style={styles.empty}>
            <AppLogo size={132} accessibilityLabel="شعار SULY" />
          </View>
        ) : (
          <View style={styles.messageListContainer}>
            <FlatList
              ref={listRef}
              style={styles.messages}
              contentContainerStyle={styles.messageContent}
              data={displayMessages}
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
              accessibilityLabel={isArabic ? "الانتقال إلى أحدث رسالة" : "Scroll to latest message"}
              onPress={scrollToLatestMessage}
              style={styles.scrollToBottomButton}
            ><Ionicons name="chevron-down" size={22} color={colors.textPrimary} /></TouchableOpacity> : null}
          </View>
        )}
        {isUploadingAttachment ? <View style={styles.uploadStatus}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.loadingText}>{isArabic ? "جارٍ رفع المرفق…" : "Uploading attachment…"}</Text></View> : null}
        <StreamingStatus isStreaming={isSending && !isUploadingAttachment && !messages.some((message) => message.id === STREAMING_ID && message.content.length > 0)} taskLabel={activeTaskLabel} onCancel={() => abortRef.current?.abort()} />
        {messages.length === 0 && !isLoading ? (
          <Text style={styles.reviewDisclaimer}>
            {isArabic ? "قد تحتاج بعض الإجابات إلى مراجعة." : "Some answers may need review."}
          </Text>
        ) : null}
        <ChatComposer
          ref={composerRef}
          basicMode={BASIC_CHAT_ONLY}
          onSend={handleSend}
          disabled={isSending || Boolean(connectorApproval)}
          isStreaming={isSending}
          onCancel={() => abortRef.current?.abort()}
        />
      </KeyboardAvoidingView>
            <BottomSheet
        visible={Boolean(connectorApproval)}
        title={connectorApproval?.connected ? (isArabic ? "مراجعة الإجراء" : "Review action") : (isArabic ? "يلزم الاتصال قبل تنفيذ الطلب" : "Connect before running this request")}
        onClose={cancelConnectorApproval}
      >
        {connectorApproval ? (() => {
          const name = connectorApproval.toolkit === "gmail" ? "Gmail" : connectorApproval.toolkit === "googledrive" ? "Google Drive" : "GitHub";
          const accountState = connectorApproval.disabled ? (isArabic ? "الحساب مرتبط لكنه معطّل حاليًا." : "The account is connected but disabled.") : connectorApproval.accountExists ? (isArabic ? "الحساب مرتبط لكنه غير نشط." : "The account is connected but inactive.") : (isArabic ? "الحساب غير مرتبط." : "The account is not connected.");
          return <View style={styles.connectorApproval}>
            <Text style={styles.connectorApprovalText}>{connectorApproval.connected
              ? (isArabic ? `الطلب يتضمن إجراءً على حسابك في ${name}. راجع النص التالي؛ لن يُنفّذ أي إرسال أو تعديل أو حذف دون تأكيدك.` : `This request includes an action on your ${name} account. Review it below; nothing will be sent, changed, or deleted without your confirmation.`)
              : (isArabic ? `${accountState} لن يبدأ الطلب قبل اكتمال الربط${connectorApproval.intent === "write" ? "، وبعد الربط ستراجع الإجراء وتؤكده بشكل منفصل." : " ومراجعة حالة الاتصال."}` : `${accountState} The request will not start until the connection is complete${connectorApproval.intent === "write" ? "; you will then review and separately confirm the action." : " and its status is verified."}`)}</Text>
            <View style={styles.connectorRequest}><Text style={styles.connectorRequestText}>{connectorApproval.content}</Text></View>
            <View style={styles.connectorActions}>
              <Pressable style={styles.connectorCancel} onPress={cancelConnectorApproval} accessibilityRole="button"><Text style={styles.connectorCancelText}>{isArabic ? "إلغاء" : "Cancel"}</Text></Pressable>
              <Pressable style={styles.connectorContinue} onPress={() => void continueConnectorApproval()} accessibilityRole="button">
                <Text style={styles.connectorContinueText}>{connectorApproval.connected ? (isArabic ? "تأكيد وتنفيذ الطلب" : "Confirm and run") : connectorApproval.intent === "write" ? (isArabic ? "اتصال، ثم مراجعة التنفيذ" : "Connect, then review") : (isArabic ? "اتصال ومتابعة المهمة" : "Connect and continue")}</Text>
              </Pressable>
            </View>
          </View>;
        })() : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemePalette, isArabic: boolean) => {
  const canvasBackground = colors.background === "#0A0A0A" ? "#000000" : colors.background;
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: canvasBackground },
  flex: { flex: 1 },
  appBar: { minHeight: 58, flexDirection: "row", direction: "ltr", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: Platform.OS === "web" ? 24 : 18, backgroundColor: canvasBackground },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "transparent", borderWidth: 0 },
  diamondBadge: { width: 28, height: 28 },
  menuLinesWrap: { width: 22, gap: 6, alignItems: "center", justifyContent: "center" },
  menuLine: { width: 22, height: 1.75, borderRadius: 1, backgroundColor: colors.textPrimary },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  modelSelector: { flex: 1, maxWidth: 360, minWidth: 90, height: 42, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 7, borderWidth: 0, borderColor: "transparent", borderRadius: 12, backgroundColor: "transparent", paddingHorizontal: 8 },
  modelSelectorText: { flex: 1, color: colors.textPrimary, fontSize: 11, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
  navigationMenuScroll: { maxHeight: 560 },
  navigationMenu: { gap: 7, paddingBottom: 8 },
  navigationMenuItem: { minHeight: 48, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 11, paddingHorizontal: 12, borderRadius: 11, backgroundColor: colors.surfaceElevated },
  navigationMenuLabel: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
  modelPickerOption: { minHeight: 54, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  modelPickerOptionSelected: { borderWidth: 1, borderColor: colors.primary },
  modelPickerOptionDisabled: { opacity: 0.55 },
  modelPickerCopy: { flex: 1, gap: 3 },
  modelPickerName: { color: colors.textPrimary, fontSize: 13, fontWeight: "800", textAlign: isArabic ? "right" : "left" },
  modelPickerDescription: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, textAlign: isArabic ? "right" : "left" },
  modelPickerHint: { color: colors.textMuted, fontSize: 11, textAlign: isArabic ? "right" : "left", paddingHorizontal: 8, paddingVertical: 4 },
  creditPill: { flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceElevated, borderColor: colors.divider, borderWidth: 1, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 5 },
  creditPillText: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  headerIcon: { color: colors.textPrimary, fontSize: 25 },
  adminShortcut: { minWidth: 42, height: 36, paddingHorizontal: 7, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  adminShortcutText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  upgradeShortcut: { minHeight: 32, borderRadius: 9, paddingHorizontal: 9, justifyContent: "center", backgroundColor: colors.primary },
  upgradeShortcutText: { color: colors.onPrimary, fontSize: 11, fontWeight: "800" },
  errorBox: { marginHorizontal: 14, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
  errorText: { color: colors.error, textAlign: isArabic ? "right" : "left", fontSize: 12 },
  retryWarning: { marginHorizontal: 14, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  retryWarningText: { color: colors.textSecondary, textAlign: isArabic ? "right" : "left", fontSize: 12, flex: 1 },
  retryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary },
  retryButtonText: { color: colors.surface, fontSize: 12, fontWeight: "700" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  loadingText: { color: colors.textSecondary },
  uploadStatus: { flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 8 },
  messages: { flex: 1 },
  messageListContainer: { flex: 1, position: "relative" },
  scrollToBottomButton: { position: "absolute", right: 24, bottom: 12, width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.divider, elevation: 5, zIndex: 2 },
  messageContent: { flexGrow: 1, paddingVertical: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 16, width: "100%", maxWidth: 1440, alignSelf: "center" },
  reviewDisclaimer: { color: colors.textMuted, fontSize: 10, lineHeight: 16, textAlign: "center", paddingHorizontal: 16, paddingBottom: 7 },
  welcomeFace: { width: 160, height: 240, marginBottom: 12 },
  welcomeMark: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "transparent", marginBottom: 4 },
  welcomeMarkText: { color: colors.primary, fontSize: 48, fontWeight: "900", letterSpacing: -3 },
  welcomeEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 2, textAlign: "center" },
  emptyTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: "600", textAlign: "center", letterSpacing: -0.2, paddingHorizontal: 8 },
  emptySubtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 23, textAlign: "center", maxWidth: 520, marginBottom: 10 },
  suggestionHeading: { width: "100%", maxWidth: 620, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 12, marginTop: 4, marginBottom: 2 },
  suggestionHeadingText: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  suggestionHeadingLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  chooseTaskTitle: { width: "100%", flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8 },
  chooseTaskText: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
  taskGrid: { width: "100%", maxWidth: 620, flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 4 },
  taskCard: { width: "48%", minHeight: 82, flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 10, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  taskIconCircle: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  taskCardText: { flex: 1, color: colors.textPrimary, textAlign: isArabic ? "right" : "left", fontSize: 12, lineHeight: 18, fontWeight: "600" },
  taskArrow: { marginStart: 2 },
  taskHint: { color: colors.textMuted, textAlign: "center", fontSize: 11, lineHeight: 17 },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  star: { color: colors.textMuted, fontSize: 25 },
  starSelected: { color: colors.warning },
  ratingSheet: { gap: 14 },
  ratingPrompt: { color: colors.textSecondary, textAlign: isArabic ? "right" : "left" },
  ratingInput: { minHeight: 90, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, backgroundColor: colors.inputBackground, color: colors.textPrimary, padding: 12, textAlign: isArabic ? "right" : "left" },
  ratingSubmit: { minHeight: 44, borderRadius: 14, paddingHorizontal: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  ratingSubmitText: { color: colors.onPrimary, fontWeight: "800" },
  usageSheet: { gap: 12 },
  usageTaskTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", textAlign: isArabic ? "right" : "left" },
  usageMetric: { padding: 18, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, alignItems: "center", gap: 5 },
  usageMetricLabel: { color: colors.textSecondary, textAlign: "center" },
  usageMetricValue: { color: colors.primary, fontSize: 32, fontWeight: "800" },
  usageStatus: { color: colors.textMuted, textAlign: isArabic ? "right" : "left" },
  connectorApproval: { gap: 14, paddingBottom: 8 },
  connectorApprovalText: { color: colors.textSecondary, textAlign: isArabic ? "right" : "left", fontSize: 13, lineHeight: 21 },
  connectorRequest: { padding: 12, borderRadius: 12, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.divider, maxHeight: 180 },
  connectorRequestText: { color: colors.textPrimary, textAlign: isArabic ? "right" : "left", fontSize: 12, lineHeight: 19 },
  connectorActions: { flexDirection: isArabic ? "row-reverse" : "row", gap: 10 },
  connectorCancel: { minHeight: 46, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
  connectorCancelText: { color: colors.textSecondary, fontWeight: "700" },
  connectorContinue: { flex: 1, minHeight: 46, paddingHorizontal: 14, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  connectorContinueText: { color: colors.onPrimary, fontSize: 12, fontWeight: "800", textAlign: "center" },
});
};
