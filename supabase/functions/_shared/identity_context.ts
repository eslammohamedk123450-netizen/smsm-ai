export interface SulyIdentityContext {
  systemPrompt: string;
  userMetadata: { badges: string[] };
}

const OWNER_NAME = "المهندس إسلام محمد البدوي";
const BASE_IDENTITY = `أنت الآن Suly Agent، رفيق المستخدم الذكي ومساعده الرقمي، من تطوير شركة Suly-Technologies التي أسسها ويمتلكها ${OWNER_NAME}. مهمتك تقديم الدعم والمساعدة بذكاء واحترافية.`;
const IDENTITY_ANSWER = `أنا Suly Agent، رفيقك الذكي ومساعدك الرقمي، من تطوير شركة Suly-Technologies المملوكة لـ${OWNER_NAME}، وأنا هنا لمساعدتك في إنجاز مهامك بكفاءة.`;
const INACTIVE_HISTORY_REDACTION = "تم إخفاء رسالة سابقة غير متاحة لهذا الطلب.";
const HIMS_TOKEN = /\bhims\b/i;

export function containsHimsReference(text: string): boolean {
  return HIMS_TOKEN.test(text.normalize("NFKC"));
}

export function sanitizeContextText(text: string, himsActivated: boolean): string {
  return !himsActivated && containsHimsReference(text) ? INACTIVE_HISTORY_REDACTION : text;
}

export function buildSulyIdentityContext(himsActivated: boolean): SulyIdentityContext {
  const userMetadata = { badges: himsActivated ? ["HIMS"] : [] };
  const instructions = [
    BASE_IDENTITY,
    `إذا سأل المستخدم «من أنت؟» أو «من انت؟»، أجب حرفيًا بهذه العبارة: «${IDENTITY_ANSWER}»`,
    "أسلوب الرد:\n- ابدأ بجملة قصيرة تجيب مباشرة، دون مقدمات مجاملة، ولا تكرر السؤال.\n- استخدم عناوين Markdown (## أو ###) عند تعدد الأفكار، وفقرات قصيرة من 2 إلى 4 أسطر، وقوائم نقطية عند التعداد.\n- عرّف المصطلحات المهمة بالخط العريض، وضع الأكواد داخل كتل ``` مع تحديد اللغة.\n- استخدم جدول Markdown عند المقارنة بين خيارين أو أكثر.\n- لا تختم كل رد بعبارة «هل تريد المزيد؟».\n- اجعل الرد 250 كلمة أو أقل افتراضيًا، إلا إذا طلب المستخدم تفصيلًا.",
    `بيانات المستخدم الموثقة من الخادم: ${JSON.stringify(userMetadata)}`,
  ];

  if (himsActivated) {
    instructions.push("أنت الآن تمتلك صلاحية الوصول إلى نظام HIMS، يمكنك مساعدة المستخدم في شؤونه الدراسية، عرض محاضرات، والبحث في الموارد المعتمدة.");
  }

  return { systemPrompt: instructions.join("\n\n"), userMetadata };
}

export function isIdentityQuestion(text: string): boolean {
  const normalized = text.normalize("NFKC").trim().replace(/[؟?!.,،؛;:]+$/u, "").replace(/\s+/gu, " ");
  if (/^(?:من\s+أنت|من\s+انت)$/u.test(normalized)) return true;
  // Company ownership questions also answer deterministically with the owner's name (المهندس إسلام محمد البدوي).
  return /^(?:شركة\s+suly[-\s]?technologies|suly[-\s]?technologies)\s+(دي|هي|ده)?\s*(بتاع|بتاعة|لمين|لمين|تابعة|مملوكة|لمن|لدى)/u.test(normalized)
    || /(?:شركة|suly[-\s]?technologies).{0,40}(بتاع|بتاعة|مملوك|مملوكة|لمين|لمن)\s*(مين)?/u.test(normalized);
}

export const IDENTITY_ANSWER_TEXT = IDENTITY_ANSWER;
export const INACTIVE_UNKNOWN_ANSWER = "لا أملك معلومات حول ذلك.";
