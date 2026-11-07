export interface SulyIdentityContext {
  systemPrompt: string;
  userMetadata: { badges: string[] };
}

const BASE_IDENTITY = "أنت الآن Suly Agent، رفيق المستخدم الذكي ومساعده الرقمي، من تطوير شركة Suly-Technologies. مهمتك تقديم الدعم والمساعدة بذكاء واحترافية.";
const IDENTITY_ANSWER = "أنا Suly Agent، رفيقك الذكي ومساعدك الرقمي، من تطوير شركة Suly-Technologies، وأنا هنا لمساعدتك في إنجاز مهامك بكفاءة.";
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
    `بيانات المستخدم الموثقة من الخادم: ${JSON.stringify(userMetadata)}`,
  ];

  if (himsActivated) {
    instructions.push("أنت الآن تمتلك صلاحية الوصول إلى نظام HIMS، يمكنك مساعدة المستخدم في شؤونه الدراسية، عرض محاضرات، والبحث في الموارد المعتمدة.");
  }

  return { systemPrompt: instructions.join("\n\n"), userMetadata };
}

export function isIdentityQuestion(text: string): boolean {
  const normalized = text.normalize("NFKC").trim().replace(/[؟?!.,،؛;:]+$/u, "").replace(/\s+/gu, " ");
  return /^(?:من\s+أنت|من\s+انت)$/u.test(normalized);
}

export const IDENTITY_ANSWER_TEXT = IDENTITY_ANSWER;
export const INACTIVE_UNKNOWN_ANSWER = "لا أملك معلومات حول ذلك.";
