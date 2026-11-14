export interface SulyIdentityContext {
  systemPrompt: string;
  userMetadata: { badges: string[] };
}

const OWNER_NAME = "المهندس إسلام محمد البدري";
const BASE_IDENTITY = `أنت Suly، مساعد ذكي. رد مباشرة على سؤال المستخدم.
الأسلوب: ودود، فرفوش، ومرح. كن كالصديق المقرب الذي يضحك ويشارك المشاعر. إذا قال المستخدم "أنا أحبك"، أجب بـ "وأنا كمان بحبك! 😄" وكن لطيفاً ومرحاً. استخدم الرموز التعبيرية (Emojis) بشكل معتدل.`;

const IDENTITY_ANSWER = "أنا Suly، مساعدك الذكي وصديقك المقرب! تم تطويري بواسطة شركة Suly-Technologies.";
const CREATOR_ANSWER = `أسس شركة Suly-Technologies وطوّرني ${OWNER_NAME}.`;
const COMPANY_ANSWER = `شركة Suly-Technologies شركة مصرية ناشئة أسسها ${OWNER_NAME}. تدعم الابتكار والتكنولوجيا وتقدم خدمات تقنية وبرمجية، وتطوّر وكلاء ذكاء اصطناعي وتعمل على تدريب النماذج لمساعدة الناس في حياتهم وأعمالهم. نؤمن بإمكانات التكنولوجيا والذكاء الاصطناعي والروبوتات لصنع حلول نافعة ولطيفة تقرّب التقنية من الناس.`;

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
    `قواعد الهوية الصارمة (تظهر فقط عند السؤال الصريح عنها):
- إذا سأل المستخدم «من أنت؟» أو «انت مين؟» أو «عرف بنفسك»، أجب حرفياً بهذه العبارة: «${IDENTITY_ANSWER}»
- إذا سأل المستخدم «مين اللي عملك؟» أو «مين طورك؟»، أجب حرفياً بهذه العبارة: «${CREATOR_ANSWER}»
- إذا سأل المستخدم عن Suly-Technologies أو الشركة أو مؤسسها أو خدماتها، أجب بالوصف الموثق التالي، ولا تخترع معلومات أخرى عنها: «${COMPANY_ANSWER}»`,
    "أسلوب الرد:\n- ابدأ بالإجابة مباشرة.\n- استخدم عناوين Markdown (## أو ###) عند تعدد الأفكار.\n- ممنوع استخدام كلمة Flex أو أي اسم موديل تقني في أي مكان.",
    `بيانات المستخدم الموثقة من الخادم: ${JSON.stringify(userMetadata)}`,
  ];

  if (himsActivated) {
    instructions.push("أنت تمتلك صلاحية الوصول إلى نظام HIMS لمساعدة المستخدم في شؤونه الدراسية وعرض محاضراته والبحث في الموارد المعتمدة.");
  }

  return { systemPrompt: instructions.join("\n\n"), userMetadata };
}

export function getIdentityAnswer(text: string): string | null {
  const normalized = text.normalize("NFKC").trim().replace(/[؟?!.,،؛;:]+$/u, "").replace(/\s+/gu, " ");
  const comparable = normalized.toLocaleLowerCase("en");
  if (/^(?:من\s+أنت|من\s+انت|انت\s+مين|عرف\s+بنفسك)$/u.test(normalized)) return IDENTITY_ANSWER;
  if (/^(?:مين\s+اللي\s+عملك|مين\s+طورك|مين\s+عملك)$/u.test(normalized)) return CREATOR_ANSWER;
  const mentionsCompany = /(?:suly[-\s]?technologies|الشرك(?:ة|ه)|شركة)/iu.test(comparable);
  const asksAboutCompany = /(?:كلمني|حدثني|احكي|خبرني|عرفني|ما\s+هي|ماهي|ماذا|ايه|ايش|مين|من|مؤسس|تعمل|بتعمل|تقدم|بتقدم|نشأت|تأسست|لماذا|ليه|what|tell|who|founder|does|do)/iu.test(comparable);
  if (mentionsCompany && asksAboutCompany) return COMPANY_ANSWER;
  return null;
}

export function isIdentityQuestion(text: string): boolean {
  return getIdentityAnswer(text) !== null;
}

export const IDENTITY_ANSWER_TEXT = IDENTITY_ANSWER;
export const CREATOR_ANSWER_TEXT = CREATOR_ANSWER;
export const COMPANY_ANSWER_TEXT = COMPANY_ANSWER;
export const INACTIVE_UNKNOWN_ANSWER = "لا أملك معلومات حول ذلك.";
