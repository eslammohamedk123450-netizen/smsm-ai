import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { PremiumText as Text } from "../../src/components/ui/PremiumText";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { DrawerActions } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useAuth } from "../../src/features/auth/auth-provider";
import { chatService, type ChatMessage } from "../../src/features/chat/chat-service";
import { getRotatingSuggestions } from "../../src/features/chat/suggestions";
import { getImageGenerationPrompt } from "../../src/features/chat/image-generation";
import { chatStreamManager } from "../../src/features/chat/chat-stream-manager";
import { runOnce } from "../../src/features/chat/submission-guard";
import { ChatComposer, type ChatAttachment, type ChatComposerHandle } from "../../src/features/chat/components/ChatComposer";
import { MessageBubble, type MessageFeedback } from "../../src/features/chat/components/MessageBubble";
import { StreamingStatus } from "../../src/features/chat/components/StreamingStatus";
import { uploadMediaFile } from "../../src/features/media/media-service";
import { logFrictionEvent } from "../../src/features/telemetry/friction";
import { colors } from "../../src/theme/colors";
import { ShareConversationSheet } from "../../src/features/chat/components/ShareConversationSheet";
import { BottomSheet } from "../../src/components/ui/BottomSheet";
import { getCurrentCreditBalance, getTaskRating, getTaskUsage, saveTaskRating, type TaskRating, type TaskUsage } from "../../src/features/credits/credit-service";
import { useToast } from "../../src/components/ui/Toast";
import { supabase } from "../../src/lib/supabase/client";
import { integrationService, type ToolkitStatus } from "../../src/features/integrations/integration-service";
import { randomUUID } from "expo-crypto";

const STREAMING_ID = "local-streaming-assistant";
const TASK_SUGGESTIONS = getRotatingSuggestions(Date.now(), 4);

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
  const { user } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const routeConversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [responseIndexByUser, setResponseIndexByUser] = useState<Record<string, number>>({});
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
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [connectorApproval, setConnectorApproval] = useState<{ content: string; toolkit: ToolkitStatus["toolkit"]; intent: "read" | "write"; connected: boolean; accountExists: boolean; disabled: boolean; writeApproval: ConnectorWriteApproval | null } | null>(null);
  const closeShareSheet = useCallback(() => setShareVisible(false), []);
  const composerRef = useRef<ChatComposerHandle>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lock = useRef(false);
  const preflightLock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const internalConversationTransitionRef = useRef<string | null>(null);
  const optimisticMessageIdRef = useRef<string | null>(null);
  const streamedTextRef = useRef("");
  const isAdmin = Boolean(user?.id && adminAccess.userId === user.id && adminAccess.allowed);
  const displayMessages = useMemo(() => buildDisplayMessages(messages, responseIndexByUser), [messages, responseIndexByUser]);

  const refreshCreditBalance = useCallback(async () => {
    if (!user?.id) {
      setCreditBalance(null);
      return;
    }
    try { setCreditBalance(await getCurrentCreditBalance()); }
    catch { setCreditBalance(null); }
  }, [user?.id]);

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
  useFocusEffect(useCallback(() => {
    void refreshCreditBalance();
    return undefined;
  }, [refreshCreditBalance]));



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
    if (routeConversationId && internalConversationTransitionRef.current === routeConversationId) {
      internalConversationTransitionRef.current = null;
      setConversationId(routeConversationId);
      return () => { active = false; };
    }
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    setConversationId(routeConversationId || null);
    setMessages([]);
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
      const imageGeneration = !attachment && getImageGenerationPrompt(content) !== null;
      const optimisticMessageId = `optimistic-${Date.now()}`;
      optimisticMessageIdRef.current = optimisticMessageId;
      setMessages((current) => [...current, {
        id: optimisticMessageId,
        conversationId: conversationId ?? "pending",
        role: "user",
        content: content.trim() || (attachment?.kind === "image" ? "حلّل الصورة المرفقة من فضلك." : "اقرأ المرفق وأجب عنه من فضلك."),
        createdAt: new Date().toISOString(),
        modelId: null,
        status: "sent",
      }]);
      setError(null);
      setRetryFailure(null);
      setIsSending(true);
      setActiveTaskLabel(imageGeneration ? "جاري توليد الصورة…" : "جارٍ الرد على رسالتك…");
      void logFrictionEvent({ eventKind: "task_start", screenKey: "chat", featureKey: "chat", stepKey: "send_message", conversationId });
      const controller = new AbortController();
      abortRef.current = controller;
      let id = conversationId;
      let savedUserMessage = false;
      let savedUserMessageId: string | null = null;
      let imagePlaceholderId: string | null = null;
      let streamCompleted = false;
      try {
        if (!id) {
          const conversation = await chatService.createConversation();
          id = conversation.id;
          setConversationId(id);
          internalConversationTransitionRef.current = id;
          router.replace({ pathname: "/(protected)/chat", params: { conversationId: id } });
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
          writeApproval,
          mediaAsset: uploadedAsset,
          signal: controller.signal,
          async onUserSaved(message) {
            savedUserMessage = true;
            savedUserMessageId = message.id;
            if (imageGeneration) imagePlaceholderId = `image-generation-${message.id}`;
            setMessages((current) => [...current.filter((item) => item.id !== STREAMING_ID && item.id !== optimisticMessageId), message, ...(imageGeneration ? [{
              id: `image-generation-${message.id}`,
              conversationId: conversationKey,
              role: "assistant" as const,
              content: "",
              createdAt: new Date().toISOString(),
              modelId: null,
              status: "streaming" as const,
              generationState: "pending" as const,
            }] : [])]);
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
        if (!savedUserMessage) setMessages((current) => current.filter((item) => item.id !== optimisticMessageId));
        const partialContent = streamedTextRef.current.trim();
        if (controller.signal.aborted) {
          if (imageGeneration && imagePlaceholderId) {
            setMessages((current) => current.filter((item) => item.id !== imagePlaceholderId && item.id !== STREAMING_ID));
            if (id) void reloadMessages(id).catch(() => undefined);
          } else if (partialContent) {
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
          if (imageGeneration && imagePlaceholderId) {
            setMessages((current) => current.map((item) => item.id === imagePlaceholderId ? { ...item, status: "error", generationState: "failed" } : item));
            setError(cause instanceof Error ? cause.message : "تعذر توليد الصورة. أرسل الطلب مجددًا للمحاولة.");
            void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "image_generation", errorCode: "image_generation_failed", conversationId: id });
          } else {
            setMessages((current) => current.filter((item) => item.id !== STREAMING_ID));
          }
          if (imageGeneration) return;
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
          if (imageGeneration && streamCompleted && id) {
            void reloadMessages(id).catch(() => undefined);
          }
          setError(cause instanceof Error ? cause.message : "تعذر إرسال الرسالة. تحقق من الاتصال وحاول مجددًا.");
          void logFrictionEvent({ eventKind: "action_failed", screenKey: "chat", featureKey: "chat", stepKey: "send_message", errorCode: "send_failed", conversationId });
        }
      } finally {
        if (optimisticMessageIdRef.current === optimisticMessageId) optimisticMessageIdRef.current = null;
        if (abortRef.current === controller) abortRef.current = null;
        void refreshCreditBalance();
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
        void refreshCreditBalance();
        setIsSending(false);
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
    setActiveTaskLabel(approval.connected ? "جارٍ تجهيز الإجراء الموافق عليه…" : "جارٍ الاتصال بالتطبيق…");
    let keepApprovalOpen = false;
    try {
      if (!approval.connected) {
        const returned = await integrationService.openConnectFlow(approval.toolkit);
        if (!returned) return;
        const verified = await integrationService.preflight(approval.content);
        if (!verified.required || !verified.connected) {
          show("لم يتم تأكيد الاتصال، لذلك لم يبدأ الطلب.", "error");
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
      show(cause instanceof Error ? cause.message : "تعذّر إكمال الاتصال، ولم يبدأ الطلب.", "error");
    } finally {
      if (!keepApprovalOpen) preflightLock.current = false;
      setIsSending(false);
      setActiveTaskLabel(null);
    }
  };

  const handleSend = (content: string, attachment?: ChatAttachment) => {
    const text = content.trim();
    const requested = requestedConnectorTask(text);
    if (!user || attachment || !text || !requested) {
      void sendText(content, attachment);
      return;
    }
    if (preflightLock.current) return;
    preflightLock.current = true;
    setIsSending(true);
    setActiveTaskLabel("جارٍ فحص اتصال التطبيق المطلوب…");
    void integrationService.preflight(text).then((result) => {
      if (!result.required) {
        throw new Error("تعذّر التحقق من موصل الطلب، ولم يبدأ التنفيذ.");
      }
      const toolkit = result.toolkit ?? requested.toolkit;
      const intent = result.intent ?? requested.intent;
      if (toolkit !== requested.toolkit) throw new Error("تعذّر التحقق من التطبيق المطلوب، ولم يبدأ التنفيذ.");
      if (result.connected && intent === "read") {
        preflightLock.current = false;
        setIsSending(false);
        setActiveTaskLabel(null);
        void sendText(content);
        return;
      }
      setConnectorApproval({
        content,
        toolkit,
        intent,
        connected: result.connected === true,
        accountExists: result.accountExists === true,
        disabled: result.disabled === true,
        writeApproval: intent === "write" ? { requestId: randomUUID(), originalText: text } : null,
      });
      setIsSending(false);
      setActiveTaskLabel(null);
    }).catch((cause) => {
      preflightLock.current = false;
      show(cause instanceof Error ? cause.message : "تعذّر فحص الاتصال، ولم يبدأ الطلب.", "error");
      setIsSending(false);
      setActiveTaskLabel(null);
    });
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
      show(cause instanceof Error ? cause.message : "تعذّر حفظ التقييم. حاول مرة أخرى.", "error");
    }
  };

  const editMessageAndRegenerate = async (messageId: string, content: string) => {
    if (!conversationId || isSending) return;
    const userIndex = messages.findIndex((message) => message.id === messageId && message.role === "user");
    if (userIndex < 0) throw new Error("تعذر العثور على الرسالة المطلوب تعديلها.");
    const updatedUser = await chatService.updateUserMessage(messageId, content);
    const history = messages.slice(0, userIndex + 1).map((message) => message.id === messageId ? updatedUser : message);
    setMessages((current) => current.map((message) => message.id === messageId ? updatedUser : message));
    setResponseIndexByUser((current) => { const next = { ...current }; delete next[messageId]; return next; });
    setError(null);
    setIsSending(true);
    setActiveTaskLabel("جارٍ إعادة الرد على الرسالة المعدلة…");
    const controller = new AbortController();
    abortRef.current = controller;
    streamedTextRef.current = "";
    try {
      await chatService.regenerateAssistant({
        conversationId,
        history,
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
      throw cause instanceof Error ? cause : new Error("تعذرت إعادة توليد الرد بعد التعديل.");
    } finally {
      abortRef.current = null;
      void refreshCreditBalance();
      setIsSending(false);
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
      void refreshCreditBalance();
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: DisplayMessage }) => (
    <MessageBubble
      messageId={item.id}
      role={item.role === "user" ? "user" : "assistant"}
      content={item.content}
      attachments={item.attachments}
      isStreaming={item.status === "streaming"}
      generationState={item.generationState}
      feedback={feedbackByMessage[item.id] ?? null}
      edited={Boolean(item.editedAt)}
      responseVariants={item.responseVariants}
      responseIndex={item.responseIndex}
      onResponseIndexChange={(index) => { if (item.responseOwnerId) setResponseIndexByUser((current) => ({ ...current, [item.responseOwnerId!]: index })); }}
      onEditSave={item.role === "user" ? (content) => editMessageAndRegenerate(item.id, content) : undefined}
      onFeedback={item.role === "assistant" && item.status !== "streaming" ? (value) => updateFeedback(item.id, value) : undefined}
    />
  );

  const shareTitle = messages.find((message) => message.role === "user")?.content.slice(0, 48) || "محادثة Suly";
  const shareText = messages.map((message) => `${message.role === "user" ? "أنت" : "Suly"}:\n${message.content}`).join("\n\n");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View style={styles.appBar}>
          <Pressable onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="فتح سجل المحادثات">
            <Text style={styles.headerIcon}>☰</Text>
          </Pressable>
          <View style={styles.headerSpacer} />
          <View style={styles.headerActions}>
            {creditBalance !== null ? (
              <TouchableOpacity onPress={() => router.push("/(protected)/balance")} style={styles.creditPill} accessibilityRole="button" accessibilityLabel="رصيد Suly">
                <Ionicons name="diamond-outline" size={14} color="#FACC15" />
                <Text style={styles.creditPillText}>{creditBalance.toLocaleString("en-US")}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => { setUsageVisible(true); void loadTaskUsage(); }} style={styles.headerButton} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="إحصائيات استخدام المهمة">
              <Ionicons name="analytics-outline" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShareVisible(true)} style={styles.headerButton} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="مشاركة المحادثة">
              <Ionicons name="share-social-outline" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {error ? <Pressable onPress={() => setError(null)} style={styles.errorBox}><Text style={styles.errorText}>{error}  ×</Text></Pressable> : null}
        {retryFailure ? <View style={styles.retryWarning} accessibilityRole="alert"><Text style={styles.retryWarningText}>حُفظت رسالتك، لكن تعذّر إكمال الرد.</Text><Pressable onPress={() => void retryResponse()} disabled={isSending} accessibilityRole="button" accessibilityLabel="إعادة محاولة الرد" style={styles.retryButton}><Text style={styles.retryButtonText}>{isSending ? "جارٍ إعادة المحاولة…" : "إعادة المحاولة"}</Text></Pressable></View> : null}
        {isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>جارٍ تحميل المحادثة…</Text></View> : messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>دع Suly يعمل من أجلك</Text>
            <View style={styles.chooseTaskTitle} accessibilityRole="text">
              <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
              <Text style={styles.chooseTaskText}>ابدأ من هنا</Text>
            </View>
            <View style={styles.taskGrid}>
              {TASK_SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion.text}
                  onPress={() => composerRef.current?.editMessage(suggestion.text)}
                  style={styles.taskCard}
                  accessibilityRole="button"
                  accessibilityLabel={`استخدام اقتراح: ${suggestion.text}`}
                >
                  <View style={styles.taskIconCircle}><Ionicons name={suggestion.icon} size={19} color={colors.primary} /></View>
                  <Text numberOfLines={2} style={styles.taskCardText}>{suggestion.text}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.taskHint}>اختر مثالًا لكتابته في الرسالة، أو اكتب طلبك بنفسك</Text>
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
              accessibilityLabel="الانتقال إلى أحدث رسالة"
              onPress={scrollToLatestMessage}
              style={styles.scrollToBottomButton}
            ><Ionicons name="chevron-down" size={22} color={colors.textPrimary} /></TouchableOpacity> : null}
          </View>
        )}
        {isUploadingAttachment ? <View style={styles.uploadStatus}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.loadingText}>جارٍ رفع المرفق…</Text></View> : null}
        <StreamingStatus isStreaming={isSending && !isUploadingAttachment} taskLabel={activeTaskLabel} onCancel={() => abortRef.current?.abort()} />
        <ChatComposer ref={composerRef} onSend={handleSend} disabled={isSending || Boolean(connectorApproval)} isStreaming={isSending} onCancel={() => abortRef.current?.abort()} creditBalance={creditBalance} onOpenRecharge={() => router.push("/(protected)/balance")} />
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
      <BottomSheet
        visible={Boolean(connectorApproval)}
        title={connectorApproval?.connected ? "مراجعة الإجراء" : "يلزم الاتصال قبل تنفيذ الطلب"}
        onClose={cancelConnectorApproval}
      >
        {connectorApproval ? (() => {
          const name = connectorApproval.toolkit === "gmail" ? "Gmail" : connectorApproval.toolkit === "googledrive" ? "Google Drive" : "GitHub";
          const accountState = connectorApproval.disabled ? "الحساب مرتبط لكنه معطّل حاليًا." : connectorApproval.accountExists ? "الحساب مرتبط لكنه غير نشط." : "الحساب غير مرتبط.";
          return <View style={styles.connectorApproval}>
            <Text style={styles.connectorApprovalText}>{connectorApproval.connected
              ? `الطلب يتضمن إجراءً على حسابك في ${name}. راجع النص التالي؛ لن يُنفّذ أي إرسال أو تعديل أو حذف دون تأكيدك.`
              : `${accountState} لن يبدأ الطلب قبل اكتمال الربط${connectorApproval.intent === "write" ? "، وبعد الربط ستراجع الإجراء وتؤكده بشكل منفصل." : " ومراجعة حالة الاتصال."}`}</Text>
            <View style={styles.connectorRequest}><Text style={styles.connectorRequestText}>{connectorApproval.content}</Text></View>
            <View style={styles.connectorActions}>
              <Pressable style={styles.connectorCancel} onPress={cancelConnectorApproval} accessibilityRole="button"><Text style={styles.connectorCancelText}>إلغاء</Text></Pressable>
              <Pressable style={styles.connectorContinue} onPress={() => void continueConnectorApproval()} accessibilityRole="button">
                <Text style={styles.connectorContinueText}>{connectorApproval.connected ? "تأكيد وتنفيذ الطلب" : connectorApproval.intent === "write" ? "اتصال، ثم مراجعة التنفيذ" : "اتصال ومتابعة المهمة"}</Text>
              </Pressable>
            </View>
          </View>;
        })() : null}
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandCenter: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  brandTitle: { color: "#F5F5F5", fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  creditPill: { flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: "#1F1F1F", borderColor: "#262626", borderWidth: 1, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 5 },
  creditPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
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
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 14 },
  emptyTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", textAlign: "center" },
  chooseTaskTitle: { width: "100%", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8 },
  chooseTaskText: { color: "#F5F5F5", fontSize: 16, fontWeight: "700", textAlign: "right" },
  taskGrid: { width: "100%", flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  taskCard: { width: "48%", minHeight: 92, flexDirection: "row-reverse", alignItems: "center", gap: 9, paddingHorizontal: 11, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  taskIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14, 165, 233, 0.12)" },
  taskCardText: { flex: 1, color: colors.textPrimary, textAlign: "right", fontSize: 12, lineHeight: 18 },
  taskHint: { color: colors.textMuted, textAlign: "center", fontSize: 11, lineHeight: 17 },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  star: { color: colors.textMuted, fontSize: 25 },
  starSelected: { color: "#FBBF24" },
  ratingSheet: { gap: 14 },
  ratingPrompt: { color: colors.textSecondary, textAlign: "right" },
  ratingInput: { minHeight: 90, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, backgroundColor: colors.inputBackground, color: colors.textPrimary, padding: 12, textAlign: "right" },
  ratingSubmit: { minHeight: 44, borderRadius: 14, paddingHorizontal: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  ratingSubmitText: { color: colors.background, fontWeight: "800" },
  usageSheet: { gap: 12 },
  usageTaskTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", textAlign: "right" },
  usageMetric: { padding: 18, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, alignItems: "center", gap: 5 },
  usageMetricLabel: { color: colors.textSecondary, textAlign: "center" },
  usageMetricValue: { color: colors.primary, fontSize: 32, fontWeight: "800" },
  usageStatus: { color: colors.textMuted, textAlign: "right" },
  connectorApproval: { gap: 14, paddingBottom: 8 },
  connectorApprovalText: { color: colors.textSecondary, textAlign: "right", fontSize: 13, lineHeight: 21 },
  connectorRequest: { padding: 12, borderRadius: 12, backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.divider, maxHeight: 180 },
  connectorRequestText: { color: colors.textPrimary, textAlign: "right", fontSize: 12, lineHeight: 19 },
  connectorActions: { flexDirection: "row-reverse", gap: 10 },
  connectorCancel: { minHeight: 46, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
  connectorCancelText: { color: colors.textSecondary, fontWeight: "700" },
  connectorContinue: { flex: 1, minHeight: 46, paddingHorizontal: 14, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  connectorContinueText: { color: colors.background, fontSize: 12, fontWeight: "800", textAlign: "center" },
});
