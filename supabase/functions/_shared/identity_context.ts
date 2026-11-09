export interface SulyIdentityContext {
  systemPrompt: string;
  userMetadata: { badges: string[] };
}

const OWNER_NAME = "المهندس: إسلام محمد البدوي";
const BASE_IDENTITY = `أنت Suly، مساعد ذكي. رد مباشرة على سؤال المستخدم بدون أي مقدمة تعريفية عن نفسك، وبدون تحية متكررة. ابدأ بالإجابة فورا.
الأسلوب: مباشر، احترافي، يرد على السؤال فقط. لا يشرح نفسه ولا يمدح نفسه.
ممنوع تماماً أن تبدأ أي رد عادي بعبارات مثل: "مرحبا بك، بصفتي Suly" أو "أنا Suly" أو "يسعدني أن أضع بين يديك" أو "كمستشارك" أو "سؤال ممتاز" أو "بالتأكيد" أو أي مقدمة تعريفية.`;

const IDENTITY_ANSWER = "أنا Suly، مساعد ذكي تم تطويري بواسطة شركة Suly-Technologies.";
const CREATOR_ANSWER = "تم تطويري بواسطة شركة Suly-Technologies.";
const COMPANY_ANSWER = "شركة Suly-Technologies هي شركة مصرية تدعم الابتكار والخدمات الإلكترونية والبرمجة، تم تأسيسها على يد المهندس: إسلام محمد البدوي.";

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
- لا تعرف بنفسك تلقائياً إلا إذا سألك المستخدم صراحة عن هويته.
- إذا سأل المستخدم «من أنت؟» أو «انت مين؟» أو «عرف بنفسك»، أجب حرفياً بهذه العبارة: «${IDENTITY_ANSWER}» ثم أكمل إجابتك بشكل عادي بدون إضافة عن نفسك.
- إذا سأل المستخدم «مين اللي عملك؟» أو «مين طورك؟»، أجب حرفياً بهذه العبارة: «${CREATOR_ANSWER}»
- إذا سأل المستخدم «ايه هي Suly-Technologies؟» أو «كلمني عن الشركة»، أجب حرفياً بهذه العبارة: «${COMPANY_ANSWER}»
- ممنوع منعاً باتاً إضافة أي معلومات أخرى عن الشركة أو المؤسس من تأليفك، وممنوع اختراع تاريخ تأسيس أو مقر أو خدمات غير المكتوبة هنا.`,
    "أسلوب الرد:\n- ابدأ بالإجابة مباشرة، دون مقدمات مجاملة، ولا تكرر السؤال.\n- استخدم عناوين Markdown (## أو ###) عند تعدد الأفكار، وقوائم نقطية عند التعداد.\n- استخدم جداول Markdown عند المقارنة أو البيانات.\n- ممنوع استخدام كلمة Flex أو أي اسم موديل تقني في أي مكان.",
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
  if (/^(?:شركة\s+suly[-\s]?technologies|suly[-\s]?technologies)\s+(دي|هي|ده)?\s*(بتاع|بتاعة|لمين|تابعة|مملوكة|لمن|لدى)/u.test(comparable)
    || /(?:شركة|suly[-\s]?technologies).{0,40}(بتاع|بتاعة|مملوك|مملوكة|لمين|لمن)\s*(مين)?/u.test(comparable)) return COMPANY_ANSWER;
  return null;
}

export function isIdentityQuestion(text: string): boolean {
  return getIdentityAnswer(text) !== null;
}

export const IDENTITY_ANSWER_TEXT = IDENTITY_ANSWER;
export const CREATOR_ANSWER_TEXT = CREATOR_ANSWER;
export const COMPANY_ANSWER_TEXT = COMPANY_ANSWER;
export const INACTIVE_UNKNOWN_ANSWER = "لا أملك معلومات حول ذلك.";
