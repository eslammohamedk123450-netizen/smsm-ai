import { randomUUID } from "expo-crypto";
import { env } from "../../config/env";
import { supabase } from "../../lib/supabase/client";
import { getQuickReply } from "../../lib/infra/quick-replies-cache";
import type { ChatRequestBody } from "../../lib/network/sse-transport";
import { summarizeContent } from "./conversation-title";
import { buildRetryHistory } from "./chat-retry";
import { chatStreamManager } from "./chat-stream-manager";
import { getImageGenerationPrompt } from "./image-generation";
import { getMediaDeliveryUrls, type MediaAsset } from "../media/media-service";
export { titleFromMessage } from "./conversation-title";
export { summarizeContent } from "./conversation-title";

export type MessageRole = "user" | "assistant" | "system";
export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  modelId: string | null;
  status: "sent" | "streaming" | "error";
  generationState?: "pending" | "failed";
  attachments?: MediaAsset[];
}
export interface ChatModel {
  id: string;
  name: string;
  providerId: number;
  provider: string;
  modelIdentifier: string;
  enabled: boolean;
  priority: number;
  contextWindow: number | null;
  routingGroup: string;
}
export interface Conversation {
  id: string;
  title: string;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  archivedAt: string | null;
}
interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  model_id: number | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function retryRequestId(messageId: string): string {
  // Persisted message IDs are UUIDs. Reusing one for a retry makes the server's
  // escrow and workspace upserts idempotent across reconnects and app restarts.
  return UUID_PATTERN.test(messageId) ? messageId : randomUUID();
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    modelId: row.model_id === null ? null : String(row.model_id),
    status: "sent",
  };
}

function checkStrictIdentity(query: string): string | null {
  const q = query.replace(/[؟?.,!]/g, "").trim().toLowerCase();
  const whoAreYouPattern = /^(انت مين|من انت|من أنت|عرف بنفسك|عرف عن نفسك|عرفنا بنفسك|ما هو سولي|ما هو suly|مين سولي|مين suly|انت ايه)$/i;
  if (whoAreYouPattern.test(q)) {
    return "أنا Suly، مساعد ذكي تم تطويري بواسطة شركة Suly-Technologies.";
  }
  const whoMadeYouPattern = /^(مين اللي عملك|مين عملك|مين طورك|مين اللي طورك|من طورك|من صنعك|مين صنعك|مين برمجك|من برمجك|من انشاك|مين انشاك)$/i;
  if (whoMadeYouPattern.test(q)) {
    return "تم تطويري بواسطة شركة Suly-Technologies.";
  }
  const whoIsCompanyPattern = /^(ايه هي suly-technologies|ايه هي شركة suly-technologies|ما هي suly-technologies|ما هي شركة suly-technologies|كلمني عن الشركة|كلمني عن suly-technologies|معلومات عن الشركة|من هو مؤسس suly-technologies|مين صاحب الشركة)$/i;
  if (whoIsCompanyPattern.test(q)) {
    return "شركة Suly-Technologies هي شركة مصرية تدعم الابتكار والخدمات الإلكترونية والبرمجة، تم تأسيسها على يد المهندس: إسلام محمد البدوي.";
  }
  return null;
}

const TITLE_LIMIT = 48;

export const chatService = {
  async getAvailableModels(): Promise<ChatModel[]> {
    const [modelResult, providerResult] = await Promise.all([
      supabase.from("ai_models")
        .select("id,name,provider_id,model_identifier,enabled,priority,context_window,routing_group,allowed_tiers")
        .eq("enabled", true)
        .order("priority", { ascending: false })
        .limit(200),
      supabase.from("ai_providers_catalog")
        .select("id,name,provider_type")
        .limit(100),
    ]);
    if (modelResult.error) throw new Error("تعذر تحميل النماذج المتاحة.");
    if (providerResult.error) throw new Error("تعذر تحميل قائمة مزودي النماذج.");
    const providerById = new Map<number, string>();
    for (const item of providerResult.data ?? []) {
      providerById.set(Number(item.id), String(item.provider_type || item.name || "provider"));
    }
    return (modelResult.data ?? []).map((item) => ({
      id: String(item.id),
      name: String(item.name ?? item.model_identifier ?? "Model"),
      providerId: Number(item.provider_id),
      provider: providerById.get(Number(item.provider_id)) ?? "provider",
      modelIdentifier: String(item.model_identifier ?? item.name ?? ""),
      enabled: item.enabled === true,
      priority: Number(item.priority ?? 0),
      contextWindow: typeof item.context_window === "number" ? item.context_window : null,
      routingGroup: String(item.routing_group ?? "free_race"),
    }));
  },

  async createConversation(title = "New Conversation"): Promise<Conversation> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("سجّل الدخول لبدء محادثة.");
    const { data, error } = await supabase.from("suly_conversations")
      .insert({ user_id: user.id, title })
      .select("id,title,model_id,created_at,updated_at,is_pinned,archived_at")
      .single();
    if (error || !data) throw new Error("تعذر إنشاء محادثة جديدة.");
    return {
      id: String(data.id),
      title: String(data.title),
      modelId: data.model_id == null ? null : String(data.model_id),
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
      isPinned: data.is_pinned === true,
      archivedAt: data.archived_at == null ? null : String(data.archived_at),
    };
  },

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase.from("suly_messages")
      .select("id,conversation_id,role,content,model_id,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error("تعذر تحميل رسائل المحادثة.");
    const messages = (data ?? []).map((row) => mapMessage(row as MessageRow));
    const messageIds = messages.map((message) => message.id);
    if (!messageIds.length) return messages;
    const { data: assetRows, error: assetError } = await supabase.from("global_media_assets")
      .select("id,message_id,bucket,mime_type,size_bytes,original_filename,created_at,metadata")
      .eq("feature_key", "chat")
      .in("message_id", messageIds)
      .limit(500);
    if (assetError) throw new Error("تعذر تحميل مرفقات المحادثة.");
    if (!assetRows?.length) return messages;
    const urls = await getMediaDeliveryUrls(assetRows.map((asset) => String(asset.id)));
    const attachmentsByMessage = new Map<string, MediaAsset[]>();
    for (const row of assetRows) {
      const messageId = String(row.message_id ?? "");
      const id = String(row.id ?? "");
      const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
      const kind = row.bucket === "video" ? "video" : row.bucket === "raw" ? "raw" : "image";
      const attachment: MediaAsset = {
        id,
        featureKey: "chat",
        url: urls.get(id) ?? "",
        mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
        sizeBytes: Number(row.size_bytes ?? 0),
        filename: typeof row.original_filename === "string" ? row.original_filename : null,
        kind,
        createdAt: String(row.created_at ?? ""),
        width: typeof metadata.width === "number" ? metadata.width : null,
        height: typeof metadata.height === "number" ? metadata.height : null,
        durationSeconds: typeof metadata.duration_seconds === "number" ? metadata.duration_seconds : null,
      };
      attachmentsByMessage.set(messageId, [...(attachmentsByMessage.get(messageId) ?? []), attachment]);
    }
    return messages.map((message) => ({ ...message, attachments: attachmentsByMessage.get(message.id) }));
  },

  /** Most recently active conversations first, scoped to the signed-in user by RLS. */
  async listConversations(limit = 50): Promise<Conversation[]> {
    const { data, error } = await supabase.from("suly_conversations")
      .select("id,title,model_id,created_at,updated_at,is_pinned,archived_at")
      .is("archived_at", null)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error("تعذر تحميل سجل المحادثات.");
    return (data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? "محادثة جديدة"),
      modelId: row.model_id == null ? null : String(row.model_id),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      isPinned: row.is_pinned === true,
      archivedAt: row.archived_at == null ? null : String(row.archived_at),
    }));
  },

  async listArchivedConversations(limit = 100): Promise<Conversation[]> {
    const { data, error } = await supabase.from("suly_conversations")
      .select("id,title,model_id,created_at,updated_at,is_pinned,archived_at")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error("تعذر تحميل الأرشيف.");
    return (data ?? []).map((row) => ({
      id: String(row.id), title: String(row.title ?? "محادثة جديدة"),
      modelId: row.model_id == null ? null : String(row.model_id),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      isPinned: row.is_pinned === true, archivedAt: row.archived_at == null ? null : String(row.archived_at),
    }));
  },

  async setConversationPinned(conversationId: string, pinned: boolean): Promise<void> {
    const { error } = await supabase.rpc("suly_set_conversation_pinned", { p_conversation_id: conversationId, p_pinned: pinned });
    if (error) {
      if (error.message?.includes("PIN_LIMIT_REACHED")) throw new Error("الخطة المجانية تسمح بتثبيت 3 محادثات فقط. حدّث خطتك لتثبيت عدد أكبر.");
      throw new Error("تعذر تحديث تثبيت المحادثة.");
    }
  },

  async setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
    const { error } = await supabase.from("suly_conversations")
      .update({ archived_at: archived ? new Date().toISOString() : null, ...(archived ? { is_pinned: false } : {}) })
      .eq("id", conversationId);
    if (error) throw new Error(archived ? "تعذر أرشفة المحادثة." : "تعذر استعادة المحادثة.");
  },

  async renameConversation(conversationId: string, title: string): Promise<void> {
    const trimmed = title.trim().slice(0, 120);
    if (!trimmed) return;
    const { error } = await supabase.from("suly_conversations").update({ title: trimmed }).eq("id", conversationId);
    if (error) throw new Error("تعذر تحديث عنوان المحادثة.");
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("سجّل الدخول مجددًا.");
    const { error } = await supabase.from("suly_conversations").delete()
      .eq("id", conversationId).eq("user_id", user.id);
    if (error) throw new Error("تعذر حذف المحادثة.");
  },

  async sendMessage(options: {
    conversationId: string;
    content: string;
    executionMode?: "chat" | "agent";
    confirmedConnectorAction?: boolean;
    mediaAsset?: MediaAsset;
    signal: AbortSignal;
    onUserSaved(message: ChatMessage): void | Promise<void>;
    onChunk(text: string): void;
    onTaskUpdate?(task: { task: string; status: "pending" | "running" | "completed" | "failed" }): void;
  }): Promise<void> {
    const content = options.content.trim() || (options.mediaAsset?.kind === "image" ? "حلّل الصورة المرفقة من فضلك." : options.mediaAsset ? "اقرأ المرفق وأجب عنه من فضلك." : "");
    if (!content) return;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("انتهت الجلسة. سجّل الدخول مجددًا.");

    // Read prior history before inserting the new user row.
    const priorMessages = await this.getMessages(options.conversationId);
    const { data: inserted, error: insertError } = await supabase.from("suly_messages").insert({
      conversation_id: options.conversationId,
      user_id: user.id,
      role: "user",
      content,
      tokens_used: Math.ceil(content.length / 4),
    }).select("id,conversation_id,role,content,model_id,created_at").single();
    if (insertError || !inserted) throw new Error("تعذر حفظ رسالتك. لم يُرسل الطلب إلى نموذج الذكاء الاصطناعي.");
    if (options.mediaAsset) {
      try { await this.attachMediaToMessage(options.mediaAsset.id, String(inserted.id)); }
      catch (error) {
        await supabase.from("suly_messages").delete().eq("id", inserted.id).eq("user_id", user.id);
        throw error;
      }
    }
    const savedMessage = mapMessage(inserted as MessageRow);
    if (options.mediaAsset) savedMessage.attachments = [options.mediaAsset];
    await options.onUserSaved(savedMessage);
    const conversationUpdate: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    // Summarize only the first user message so later turns never overwrite
    // the conversation label.
    if (priorMessages.length === 0) conversationUpdate.title = summarizeContent(content);
    const { error: updateError } = await supabase.from("suly_conversations")
      .update(conversationUpdate)
      .eq("id", options.conversationId).eq("user_id", user.id);
    if (updateError) throw new Error("حُفظت رسالتك، لكن تعذر تحديث ترتيب المحادثة.");

    const imagePrompt = options.mediaAsset ? null : getImageGenerationPrompt(content);
    if (imagePrompt) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("انتهت الجلسة. سجّل الدخول مرة أخرى لبدء توليد الصورة.");
      let response: Response;
      try {
        response = await fetch(`${env.edgeFunctionBaseUrl}/image-generator`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: env.supabaseAnonKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ conversation_id: options.conversationId, user_message_id: String(inserted.id), prompt: imagePrompt }),
          signal: options.signal,
        });
      } catch (cause) {
        if (options.signal.aborted) throw cause;
        throw new Error("تعذر الاتصال بخدمة توليد الصور. حاول مرة أخرى.");
      }
      let result: Record<string, unknown> = {};
      try { result = await response.json() as Record<string, unknown>; } catch { /* show safe fallback below */ }
      if (!response.ok || result.success !== true) {
        const message = typeof result.error === "string" ? result.error : "تعذر توليد الصورة. حاول مرة أخرى.";
        throw new Error(message);
      }
      return;
    }

    const identityReply = options.mediaAsset ? null : checkStrictIdentity(content);
    if (identityReply) {
      options.onChunk(identityReply);
      await supabase.from("suly_messages").insert({
        conversation_id: options.conversationId,
        user_id: user.id,
        role: "assistant",
        content: identityReply,
        tokens_used: Math.ceil(identityReply.length / 4),
      });
      return;
    }

    // quick-replies-cache: repeated chit-chat answers instantly from the
    // local cache with zero network calls and zero token spend.
    const quickReply = options.mediaAsset ? null : getQuickReply(content);
    if (quickReply) {
      options.onChunk(quickReply);
      await supabase.from("suly_messages").insert({
        conversation_id: options.conversationId,
        user_id: user.id,
        role: "assistant",
        content: quickReply,
        tokens_used: Math.ceil(quickReply.length / 4),
      });
      return;
    }

    const history: ChatRequestBody["messages"] = priorMessages
      .filter((entry): entry is ChatMessage & { role: "user" | "assistant" } => entry.role === "user" || entry.role === "assistant")
      .slice(-19)
      .map(({ role, content: text }) => ({ role, content: text }));
    history.push({ role: "user", content });
    const requestBody: ChatRequestBody = {
      conversation_id: options.conversationId,
      user_message_id: String(inserted.id),
      media_asset_ids: options.mediaAsset ? [options.mediaAsset.id] : undefined,
      request_id: retryRequestId(String(inserted.id)),
      messages: history,
      routing_mode: "auto",
      execution_mode: options.executionMode ?? "chat",
      stream: true,
      confirmed_connector_action: options.confirmedConnectorAction === true ? true : undefined,
    };
    await chatStreamManager.start(requestBody, { onChunk: options.onChunk, onTaskUpdate: options.onTaskUpdate, onDone() {} }, options.signal);
  },

  async regenerateAssistant(options: {
    conversationId: string;
    history: ChatMessage[];
    requestId?: string;
    executionMode?: "chat" | "agent";
    signal: AbortSignal;
    onChunk(text: string): void;
    onTaskUpdate?(task: { task: string; status: "pending" | "running" | "completed" | "failed" }): void;
  }): Promise<void> {
    const messages: ChatRequestBody["messages"] = options.history
      .filter((entry): entry is ChatMessage & { role: "user" | "assistant" } => entry.role === "user" || entry.role === "assistant")
      .slice(-20)
      .map(({ role, content }) => ({ role, content }));
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      throw new Error("لا توجد رسالة مستخدم لإعادة توليد الرد عليها.");
    }
    const latestUser = [...options.history].reverse().find((entry) => entry.role === "user");
    await chatStreamManager.start({
      conversation_id: options.conversationId,
      user_message_id: latestUser?.id,
      media_asset_ids: latestUser?.attachments?.map((asset) => asset.id),
      request_id: options.requestId ?? randomUUID(),
      messages,
      routing_mode: "auto",
      execution_mode: options.executionMode ?? "chat",
      stream: true,
    }, { onChunk: options.onChunk, onTaskUpdate: options.onTaskUpdate, onDone() {} }, options.signal);
  },

  async retryAssistant(options: {
    conversationId: string;
    userMessageId: string;
    executionMode?: "chat" | "agent";
    signal: AbortSignal;
    onChunk(text: string): void;
    onTaskUpdate?(task: { task: string; status: "pending" | "running" | "completed" | "failed" }): void;
  }): Promise<void> {
    const savedMessages = await this.getMessages(options.conversationId);
    const history = buildRetryHistory(savedMessages, options.userMessageId);
    await this.regenerateAssistant({
      conversationId: options.conversationId,
      history,
      requestId: retryRequestId(options.userMessageId),
      signal: options.signal,
      onChunk: options.onChunk,
      onTaskUpdate: options.onTaskUpdate,
    });
  },

  async getMessageFeedback(messageIds: string[]): Promise<Record<string, "like" | "dislike">> {
    const ids = [...new Set(messageIds)].filter((id) => id && id !== "local-streaming-assistant").slice(0, 500);
    if (!ids.length) return {};
    const { data, error } = await supabase.from("suly_message_feedback")
      .select("message_id,reaction").in("message_id", ids).limit(500);
    if (error) throw new Error("تعذر تحميل تقييمات الرسائل.");
    const result: Record<string, "like" | "dislike"> = {};
    for (const row of data ?? []) {
      if (row.reaction === "like" || row.reaction === "dislike") result[String(row.message_id)] = row.reaction;
    }
    return result;
  },

  async setMessageFeedback(messageId: string, reaction: "like" | "dislike" | null): Promise<void> {
    if (reaction === null) {
      const { error } = await supabase.from("suly_message_feedback").delete().eq("message_id", messageId);
      if (error) throw new Error("تعذر إزالة التقييم.");
      return;
    }
    const { error } = await supabase.from("suly_message_feedback").upsert(
      { message_id: messageId, reaction, updated_at: new Date().toISOString() },
      { onConflict: "user_id,message_id" },
    );
    if (error) throw new Error("تعذر حفظ تقييمك على الخادم.");
  },

  async attachMediaToMessage(mediaId: string, messageId: string): Promise<void> {
    const { error } = await supabase.rpc("suly_media_attach_to_message", { p_media_id: mediaId, p_message_id: messageId });
    if (error) throw new Error("تعذر ربط الملف برسالة المحادثة.");
  },
};
