// quick-replies-cache (client side): instant answers for repeated chit-chat
// without any network call, model call, or token spend. Mirrors the server's
// static layer so the same phrase answers identically on both sides.

export const QUICK_REPLY_MAX_QUESTION_LENGTH = 120;

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

/** Same normalization rules as the server module, so both layers agree. */
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

/** Returns a cached reply, or null when the message needs the full route. */
export function getQuickReply(text: string): string | null {
  const normalized = normalizeQuickReply(text);
  if (!normalized || normalized.length > QUICK_REPLY_MAX_QUESTION_LENGTH) return null;
  return REPLIES[normalized] ?? null;
}
