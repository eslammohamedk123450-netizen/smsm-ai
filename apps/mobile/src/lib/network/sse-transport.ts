import { supabase } from "../supabase/client";
import { env } from "../../config/env";
import { SseParser, type RouterSseEvent } from "./sse-parser";
import { Utf8Decoder } from "./utf8-decoder";

export interface StreamCallbacks {
  onChunk(text: string): void;
  onDone(): void;
  onTaskUpdate?(task: { task: string; status: "pending" | "running" | "completed" | "failed" }): void;
}

export interface ChatRequestBody {
  conversation_id: string;
  user_message_id?: string;
  media_asset_ids?: string[];
  request_id: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  routing_mode: "auto";
  execution_mode: "chat" | "agent";
  stream: true;
  connector_approval_request_id?: string;
  connector_approval_original_text?: string;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function publicHttpError(status: number): Error {
  if (status === 401 || status === 403) return new Error("انتهت الجلسة أو لا تملك صلاحية استخدام خدمة الدردشة. سجّل الدخول مجددًا.");
  if (status === 402) return new Error("رصيدك غير كافٍ لإرسال الطلب.");
  if (status === 429) return new Error("أُرسلت الطلبات بسرعة كبيرة. انتظر قليلًا ثم أعد المحاولة.");
  if (status >= 500) return new Error("خدمة الدردشة غير متاحة مؤقتًا. حاول مرة أخرى لاحقًا.");
  return new Error(`تعذر إرسال الرسالة (HTTP ${status}).`);
}

async function publicResponseError(response: Response): Promise<Error> {
  const status = response.status;
  if (status === 401 || status === 403 || status === 402 || status === 429 || status >= 500) return publicHttpError(status);
  const payload = await response.clone().json().catch(() => null) as { error?: unknown } | null;
  if (typeof payload?.error === "string" && payload.error.length > 0 && payload.error.length <= 400) return new Error(payload.error);
  return publicHttpError(status);
}

function dispatch(event: RouterSseEvent, callbacks: StreamCallbacks): boolean {
  if (event.type === "chunk") {
    if (event.text) callbacks.onChunk(event.text);
    return false;
  }
  if (event.type === "error") throw new Error(event.message);
  if (event.type === "task") { callbacks.onTaskUpdate?.({ task: event.task, status: event.status }); return false; }
  callbacks.onDone();
  return true;
}

export async function streamChat(
  fetchImpl: FetchLike,
  body: ChatRequestBody,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
): Promise<void> {
  if (!env.isConfigured) throw new Error("إعدادات Supabase العامة غير مكتملة.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("سجّل الدخول مجددًا قبل إرسال رسالة.");

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });

  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timedOut = false;
  const setIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 90_000);
  };

  try {
    const responsePromise = fetchImpl(`${env.edgeFunctionBaseUrl}/ai-router`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: env.supabaseAnonKey,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      connectTimer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new Error("انتهت مهلة الاتصال بخدمة الدردشة."));
      }, 90_000);
    });
    const response = await Promise.race([responsePromise, timeoutPromise]);
    if (connectTimer) clearTimeout(connectTimer);
    if (!response.ok) throw await publicResponseError(response);
    if (!response.body?.getReader) throw new Error("هذا النظام لا يوفر قارئ بث مناسبًا. استخدم نسخة تطوير native مدعومة.");

    reader = response.body.getReader();
    const decoder = new Utf8Decoder();
    const parser = new SseParser();
    let receivedDone = false;
    setIdleTimer();

    while (!receivedDone) {
      const result = await reader.read();
      if (result.done) {
        const tail = decoder.finish();
        for (const event of parser.push(tail).concat(parser.finish())) {
          receivedDone = dispatch(event, callbacks) || receivedDone;
        }
        break;
      }
      setIdleTimer();
      const decoded = decoder.decode(result.value);
      for (const event of parser.push(decoded)) {
        receivedDone = dispatch(event, callbacks) || receivedDone;
      }
    }
    if (!receivedDone) throw new Error("انقطع تدفق الرد قبل اكتماله. لم يُحفظ رد مساعد كامل.");
  } catch (error) {
    if (signal.aborted) {
      const cancelled = new Error("أُلغي الطلب.");
      cancelled.name = "AbortError";
      throw cancelled;
    }
    if (timedOut) throw new Error("انتهت مهلة الرد قبل اكتمال التدفق.");
    throw error instanceof Error ? error : new Error("تعذر إكمال تدفق الرد.");
  } finally {
    signal.removeEventListener("abort", abort);
    if (idleTimer) clearTimeout(idleTimer);
    if (connectTimer) clearTimeout(connectTimer);
    if (reader) await reader.cancel().catch(() => undefined);
  }
}
