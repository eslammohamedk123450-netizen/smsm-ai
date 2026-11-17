// Global infrastructure: quick replies cache (quick-replies-cache).
//
// Layer 1 is a zero-dependency static map: normalized chit-chat phrases map to
// canned Suly replies. Layer 2 persists earlier exact question/answer pairs in
// Postgres so a repeated question is answered with zero model calls.
// Every lookup/store failure is swallowed: the cache can only ever accelerate
// a response, never break one.

export const QUICK_REPLY_MAX_QUESTION_LENGTH = 120;
export const QUICK_REPLY_MAX_ANSWER_LENGTH = 600;
/** Exact-form DB entries stay valid for one day. */
export const QUICK_REPLY_TTL_SECONDS = 24 * 60 * 60;
const QUICK_REPLY_CACHE_VERSION = "v2";

const REPLIES: Record<string, string> = {
  "ازيك": "الحمد لله بخير. كيف أقدر أساعدك؟",
  "ازيك عامل ايه": "بخير، شكرًا لسؤالك. ما الذي تحتاجه؟",
  "ازي حالك": "بخير، شكرًا لك. كيف أساعدك اليوم؟",
  "عامل ايه": "بخير وجاهز للمساعدة. ما طلبك؟",
  "ايه الاخبار": "كل شيء جيد. كيف أقدر أساعدك؟",
  "انت مين": "أنا SULY، مساعدك الذكي.",
  "مين انت": "أنا SULY، مساعدك الذكي.",
  "من انت": "أنا SULY، مساعدك الذكي.",
  "انت ايه": "أنا SULY، مساعدك الذكي.",
  "مين اللي عملك": "طوّرني فريق Suly-Technologies.",
  "شكرا": "العفو، أنا هنا إذا احتجت أي مساعدة أخرى.",
  "شكرا لك": "على الرحب والسعة.",
  "شكرا جدا": "العفو، سعيد بمساعدتك.",
  "تمام": "تمام. تفضل بطلبك التالي.",
  "ماشي": "حسنًا، أنا جاهز.",
  "اوكي": "حسنًا.",
  "هههه": "😄",
  "ههههه": "😄",
  "هههههه": "😄",
  "اهلا": "أهلًا! كيف أقدر أساعدك؟",
  "اهلا وسهلا": "أهلًا وسهلًا. ما الذي تحتاجه؟",
  "مرحبا": "مرحبًا! أنا SULY. كيف أقدر أساعدك؟",
  "سلام": "وعليكم السلام. كيف أقدر أساعدك؟",
  "السلام عليكم": "وعليكم السلام ورحمة الله وبركاته.",
  "صباح الخير": "صباح النور! كيف أقدر أساعدك؟",
  "مساء الخير": "مساء النور! ما الذي تحتاجه؟",
  "ازي الناس": "بخير، شكرًا لسؤالك.",
  "hi": "Hello! I'm SULY. How can I help?",
  "hello": "Hello! I'm SULY. What can I help you with?",
  "hey": "Hey! How can I help?",
  "thanks": "You're welcome. Let me know if you need anything else.",
  "thank you": "You're welcome.",
  "ok": "Okay. I'm ready for your next request.",
};;

/** Aggressive normalization: diacritics, tatweel, letter variants, punctuation. */
export function normalizeQuickReply(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True for short chit-chat-like messages worth remembering verbatim. */
export function isQuickReplyCandidate(text: string): boolean {
  const normalized = normalizeQuickReply(text);
  if (!normalized || normalized.length > QUICK_REPLY_MAX_QUESTION_LENGTH) return false;
  // Real work requests are longer, imperative, or contain search markers.
  if (/\b(اعمل|اعملي|ابحث|ابحثي|حلل|صمم|اكتب كود|برمج|خطة|قارن|موقع|تقرير)\b/u.test(normalized)) return false;
  if (normalized.split(" ").length > 8) return false;
  return true;
}

export function lookupStaticQuickReply(text: string): string | null {
  const normalized = normalizeQuickReply(text);
  if (!normalized) return null;
  return REPLIES[normalized] ?? null;
}

export interface QuickReplyLookupResult {
  reply: string | null;
  source: "static" | "database" | null;
}

/**
 * Layer 1 is synchronous and free; layer 2 asks Postgres for an earlier exact
 * answer. A missing RPC or table degrades to "no hit" without noise.
 */
export async function lookupQuickReply(
  supabase: any,
  userId: string | null,
  text: string,
): Promise<QuickReplyLookupResult> {
  const staticReply = lookupStaticQuickReply(text);
  if (staticReply) return { reply: staticReply, source: "static" };
  if (!userId) return { reply: null, source: null };
  try {
    const { data, error } = await supabase.rpc("suly_quick_reply_lookup", {
      p_user_id: userId,
      p_question_norm: `${QUICK_REPLY_CACHE_VERSION}:${normalizeQuickReply(text)}`,
    });
    if (error) throw new Error(error.message);
    const answer = typeof data === "string" ? data.trim() : "";
    if (!answer) return { reply: null, source: null };
    return { reply: answer, source: "database" };
  } catch (error) {
    console.warn("Quick reply lookup failed:", error instanceof Error ? error.message : String(error));
    return { reply: null, source: null };
  }
}

/** Persists a short chit-chat answer so the next identical ask costs nothing. */
export async function storeQuickReply(
  supabase: any,
  userId: string | null,
  question: string,
  answer: string,
): Promise<void> {
  if (!userId) return;
  if (!isQuickReplyCandidate(question)) return;
  const trimmed = answer.trim();
  if (!trimmed || trimmed.length > QUICK_REPLY_MAX_ANSWER_LENGTH) return;
  try {
    const { error } = await supabase.rpc("suly_quick_reply_store", {
      p_user_id: userId,
      p_question_norm: `${QUICK_REPLY_CACHE_VERSION}:${normalizeQuickReply(question)}`,
      p_question: question.slice(0, QUICK_REPLY_MAX_QUESTION_LENGTH),
      p_answer: trimmed,
      p_ttl_seconds: QUICK_REPLY_TTL_SECONDS,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn("Quick reply store failed:", error instanceof Error ? error.message : String(error));
  }
}
