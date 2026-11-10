// Global infrastructure: "the mind thinks first" intent classifier.
//
// Before any response or orchestration, Suly asks itself three internal
// questions and this module answers them with deterministic rules, costing
// zero tokens and zero model calls:
//   1. Is this chat or a task?
//   2. If a task, is it simple (one reply) or compound (needs splitting)?
//   3. If research is needed, one source or several?
// The UI is never told about this stage; it only changes routing.

export type Intent = "chat" | "simple_task" | "complex_task";

export interface IntentDecision {
  intent: Intent;
  /** Maximum number of external sources this request should touch. */
  maxSources: number;
  reason: string;
}

const CHAT_PATTERNS: RegExp[] = [
  /^(ازيك|ايه اخبارك|عامل ايه|عاملة ايه|انت مين|من انت|مين انت|انت ايه|مين اللي عملك|مين عملك|شكرا|شكرا لك|تمام|ماشي|اوكي|ههه+|اهلا|مرحبا|سلام|السلام عليكم|صباح الخير|مساء الخير|ايه الاخبار|كيف حالك|هاي|هلا|ok|okay|hi|hello|hey|thanks|thank you|good (morning|evening))[\s!.,؟?]*$/iu,
  /^(خلاص|يلا|كفايه|حاضر|ولا يهمك|ربنا يخليك|تسلم|مع السلامة|سلام عليكم|باي|bye|goodbye)[\s!.,؟?]*$/iu,
  /^(ههههه*|😂|🙂|👍)+$/u,
];

const COMPLEX_MARKERS: RegExp[] = [
  /(?<![\p{L}\p{N}\p{M}_])(اعمل\s*(لي)?\s+موقع|انشئ\s+موقع|بناء\s+موقع|تطبيق\s+كامل|لعبة\s+كاملة)(?![\p{L}\p{N}\p{M}_])/u,
  /(?<![\p{L}\p{N}\p{M}_])(بحث\s+(كامل|شامل|موسع)|دراسة\s+شاملة|تقرير\s+كامل)(?![\p{L}\p{N}\p{M}_])/u,
  /(?<![\p{L}\p{N}\p{M}_])(قارن\s+بين|مقارنة\s+شاملة|قارن\s+الفرق)(?![\p{L}\p{N}\p{M}_])/u,
  /(?<![\p{L}\p{N}\p{M}_])(خطة\s+(عمل|دراسة|تسويقية|تنفيذية)|roadmap)(?![\p{L}\p{N}\p{M}_])/iu,
  /(?<![\p{L}\p{N}\p{M}_])(خطوة\s+بخطوة\s+؟?\s*مع\s+المصادر|مع\s+المصادر\s+والمراجع)(?![\p{L}\p{N}\p{M}_])/u,
  /[,،؛;]\s*(ثم|وبعدين|وكذلك|وأيضا|وبرضو)(?![\p{L}\p{N}\p{M}_])/u,
  /(?<![\p{L}\p{N}\p{M}_])(ثم|وبعدين)(?![\p{L}\p{N}\p{M}_]).*(?<![\p{L}\p{N}\p{M}_])(ثم|وبعدين)(?![\p{L}\p{N}\p{M}_])/u,
];

const SIMPLE_TASK_MARKERS: RegExp[] = [
  /(?<![\p{L}\p{N}\p{M}_])(ابحث\s*(لي)?\s*عن|ابحث\s*(لي)?\s*على|دور\s*(لي)?\s*عن|سعر(?:\s+ال)?|ثمن|كام\s+ال|ما\s+هو|ما\s+هي|مين\s+هو|مين\s+هي|ايه\s+هو|ايه\s+هي|ترجم\s*(لي)?|احسب\s*(لي)?|اشرح\s*(لي)?|وضح\s*(لي)?|define|translate|search\s+for)(?![\p{L}\p{N}\p{M}_])/u,
];

/** Research-heavy or multi-source signals bump the source budget. */
const MULTI_SOURCE_MARKERS: RegExp[] = [
  /(?<![\p{L}\p{N}\p{M}_])(قارن|مقارنة|مصادر|مصادر متعددة|من عدة مصادر|دراسة شاملة|تقرير كامل|جميع الخيارات|كل البدائل)(?![\p{L}\p{N}\p{M}_])/u,
];

export function classifyIntent(text: string): IntentDecision {
  const message = text.trim();
  if (!message) return { intent: "chat", maxSources: 0, reason: "empty_message" };
  for (const pattern of CHAT_PATTERNS) {
    if (pattern.test(message)) {
      return { intent: "chat", maxSources: 0, reason: "chitchat_phrase" };
    }
  }
  for (const pattern of COMPLEX_MARKERS) {
    if (pattern.test(message)) {
      const multiSource = MULTI_SOURCE_MARKERS.some((marker) => marker.test(message));
      return { intent: "complex_task", maxSources: multiSource ? 3 : 2, reason: "compound_task_marker" };
    }
  }
  for (const pattern of SIMPLE_TASK_MARKERS) {
    if (pattern.test(message)) {
      const multiSource = MULTI_SOURCE_MARKERS.some((marker) => marker.test(message));
      return { intent: "simple_task", maxSources: multiSource ? 3 : 1, reason: "single_action_marker" };
    }
  }
  // Default: short unconstrained asks are chat; long ones are simple tasks.
  if (message.length <= 60 && message.split(/\s+/).length <= 10) {
    return { intent: "chat", maxSources: 0, reason: "short_message" };
  }
  return { intent: "simple_task", maxSources: 1, reason: "default_single_reply" };
}

/**
 * The internal policy appended to the system prompt. It is never surfaced to
 * the user; it only tells the model how the routing stage decided to act.
 */
export function buildMindPolicy(decision: IntentDecision): string {
  const base = [
    "سياسة العقل الداخلية (لا تذكرها ولا تشرحها للمستخدم إطلاقًا):",
    "قبل الرد سألت نفسك ثلاثة أسئلة وحُدد المسار مسبقًا:",
    "1) دردشة أم مهمة؟",
    "2) لو مهمة: بسيطة (رد واحد) أم مركبة (تقسيم وتنسيق)؟",
    "3) لو تحتاج بحث: مصدر واحد أم أكثر؟",
  ];
  if (decision.intent === "chat") {
    base.push(
      "النتيجة: هذه دردشة. ردّ بنفسك مباشرة في جملة أو جملتين طبيعيتين.",
      "لا تستخدم أدوات، ولا تذكر تقسيمًا أو عمالًا أو خططًا، ولا تطول الرد.",
    );
  } else if (decision.intent === "simple_task") {
    base.push(
      `النتيجة: مهمة بسيطة. أجب في رد واحد فقط بحد أقصى ${decision.maxSources} مصدر/مصادر.`,
      "لا تقسّم المهمة ولا تعرض خطة تنفيذ، ما لم يطلب المستخدم غير ذلك.",
    );
  } else {
    base.push(
      `النتيجة: مهمة مركبة. تنفذ وفق الخطة المتفق عليها بحد أقصى ${decision.maxSources} مصادر،`,
      "وقد قسمت المهمة مسبقًا إلى أجزاء تُنفذ بالتوازي ثم تُجمّع النتائج.",
    );
  }
  return base.join("\n");
}
