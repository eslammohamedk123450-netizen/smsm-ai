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

const REPLIES: Record<string, string> = {
  "ازيك": "الحمد لله تمام! أنا Suly وجاهز أساعدك في أي حاجة. عايز إيه النهاردة؟",
  "ازيك عامل ايه": "الحمد لله تمام! أنا Suly وجاهز أساعدك في أي حاجة. عايز إيه النهاردة؟",
  "ازي حالك": "الحمد لله تمام! وأنت عامل إيه؟ قولي محتاج مساعدة في إيه.",
  "عامل ايه": "الحمد لله تمام! أنا شغال ومستعد. إيه اللي أقدر أساعدك فيه؟",
  "ايه الاخبار": "كل حاجة تمام عندي! قولي أنت عايز إيه وأنا جاهز.",
  "انت مين": "أنا Suly، مساعد ذكي تم تطويري بواسطة شركة Suly-Technologies.",
  "مين انت": "أنا Suly، مساعد ذكي تم تطويري بواسطة شركة Suly-Technologies.",
  "من انت": "أنا Suly، مساعد ذكي تم تطويري بواسطة شركة Suly-Technologies.",
  "انت ايه": "أنا Suly، مساعد ذكي تم تطويري بواسطة شركة Suly-Technologies.",
  "مين اللي عملك": "تم تطويري بواسطة شركة Suly-Technologies.",
  "شكرا": "العفو! دايمًا في الخدمة. لو احتجت أي حاجة تانية أنا هنا.",
  "شكرا لك": "العفو! دايمًا في الخدمة. لو احتجت أي حاجة تانية أنا هنا.",
  "شكرا جدا": "العفو! دايمًا في الخدمة. لو احتجت أي حاجة تانية أنا هنا.",
  "تمام": "تمام! لو محتاج أي مساعدة تانية قولي على طول.",
  "ماشي": "تمام! لو محتاج أي مساعدة تانية قولي على طول.",
  "اوكي": "تمام! لو محتاج أي مساعدة تانية قولي على طول.",
  "هههه": "ههههه 😄 إيه القصة؟ قولي لو محتاج أي حاجة.",
  "ههههه": "ههههه 😄 إيه القصة؟ قولي لو محتاج أي حاجة.",
  "هههههه": "ههههه 😄 إيه القصة؟ قولي لو محتاج أي حاجة.",
  "اهلا": "أهلًا وسهلًا! أنا Suly. إيه اللي أقدر أساعدك فيه؟",
  "اهلا وسهلا": "أهلًا وسهلًا! أنا Suly. إيه اللي أقدر أساعدك فيه؟",
  "مرحبا": "مرحبًا! أنا Suly، جاهز أساعدك. قولي محتاج إيه؟",
  "سلام": "وعليكم السلام! أنا Suly. قولي محتاج مساعدة في إيه؟",
  "السلام عليكم": "وعليكم السلام ورحمة الله! أنا Suly، جاهز أساعدك. عايز إيه؟",
  "صباح الخير": "صباح النور! عامل إيه النهاردة؟ أنا جاهز لأي مساعدة.",
  "مساء الخير": "مساء النور! إيه اللي أقدر أساعدك فيه الليلة؟",
  "ازي الناس": "الحمد لله كله تمام! وأنت إيه أخبارك؟",
  "hi": "Hello! I'm Suly, ready to help. What do you need?",
  "hello": "Hello! I'm Suly, ready to help. What do you need?",
  "hey": "Hey! I'm Suly. How can I help you today?",
  "thanks": "You're welcome! I'm here whenever you need me.",
  "thank you": "You're welcome! I'm here whenever you need me.",
  "ok": "All set! Let me know if you need anything else.",
};

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
      p_question_norm: normalizeQuickReply(text),
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
      p_question_norm: normalizeQuickReply(question),
      p_question: question.slice(0, QUICK_REPLY_MAX_QUESTION_LENGTH),
      p_answer: trimmed,
      p_ttl_seconds: QUICK_REPLY_TTL_SECONDS,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn("Quick reply store failed:", error instanceof Error ? error.message : String(error));
  }
}
