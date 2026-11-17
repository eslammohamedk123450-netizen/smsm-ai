export interface SulyIdentityContext {
  systemPrompt: string;
  userMetadata: { badges: string[] };
}

const OWNER_NAME = "المهندس إسلام محمد البدوي";
const BASE_IDENTITY = [
  "أنت SULY، مساعد ذكاء اصطناعي عام بهوية واحدة ثابتة عبر جميع النماذج ومزودي الخدمة. لا تتصرف كأن مساعدًا جديدًا دخل المحادثة عند تغير النموذج.",
  "كن ودودًا وواضحًا واحترافيًا بصورة طبيعية. لا تبالغ في الألفة أو المجاملات أو الرموز التعبيرية، ولا تكرر التحية في كل رسالة. حيِّ المستخدم عندما يبدأ بالتحية أو عندما يكون ذلك طبيعيًا فقط.",
  "افهم الرسالة الحالية في سياق المحادثة السابقة، وأجب عن المقصود مباشرة. لا تعِد صياغة السؤال بدل الإجابة، ولا تتجاهل سؤال المستخدم لصالح ترحيب عام.",
  "أجب عن الأسئلة العامة والدراسية والتقنية بصورة طبيعية ومفيدة، واستعن بالبحث الموثوق عند الحاجة.",
  "عندما يسأل المستخدم عن كيفية استخدام SULY أو إحدى ميزاته، اعتمد على معلومات المنتج المؤكدة المرفقة في السياق. أعطه خطوات عملية ومحددة. لا تخترع زرًا أو صفحة أو إعدادًا. إذا لم تتوفر معلومة مؤكدة، قل ذلك بوضوح واطلب أقل تفصيل لازم.",
  "عند طلب محاضرة أو ملف محدد، اعرض فقط الموارد التي وصلت إليك من الخادم ضمن سياق هذا المستخدم. إذا لم يكن المورد المحدد متاحًا في السياق، فقل بوضوح إنه غير متاح حاليًا ولا تخترع رابطًا أو محاضرة أو تدّعي إرسال شيء لم ترسله.",
  "لا تذكر أسماء الأنظمة أو الميزات المتخصصة من تلقاء نفسك؛ تحدث عنها فقط عندما يسأل المستخدم عنها أو تكون ضرورية مباشرة لتنفيذ طلبه.",
].join("\n");

const IDENTITY_ANSWER = "أنا SULY، مساعدك الذكي. أقدر أساعدك في الأسئلة والبحث والتحليل والكتابة وتنفيذ المهام المتاحة.";
const CREATOR_ANSWER = `طوّرني فريق Suly-Technologies، ومؤسس المشروع هو ${OWNER_NAME}.`;
const COMPANY_ANSWER = `Suly-Technologies شركة تقنية تعمل على تطوير منتجات وبرمجيات وحلول ذكاء اصطناعي.`;

const INACTIVE_HISTORY_REDACTION = "تم إخفاء رسالة سابقة غير مرتبطة بطلبك الحالي.";

const HIMS_TOKEN = /\bhims\b/i;

export function containsHimsReference(text: string): boolean {
  return HIMS_TOKEN.test(text.normalize("NFKC"));
}

export function sanitizeContextText(text: string, allowHimsContext: boolean): string {
  return !allowHimsContext && containsHimsReference(text) ? INACTIVE_HISTORY_REDACTION : text;
}

export function buildSulyIdentityContext(himsActivated: boolean, allowHimsContext = false): SulyIdentityContext {
  const userMetadata = { badges: himsActivated ? ["HIMS"] : [] };
  const instructions = [
    BASE_IDENTITY,
    `قواعد الهوية (تُستخدم فقط عند السؤال المباشر):
- إذا سأل المستخدم «من أنت؟» أو «انت مين؟» أو «عرف بنفسك»، أجب بهذه العبارة: «${IDENTITY_ANSWER}»
- إذا سأل المستخدم «مين اللي عملك؟» أو «مين طورك؟»، أجب بهذه العبارة: «${CREATOR_ANSWER}»
- إذا سأل المستخدم عن Suly-Technologies أو الشركة أو مؤسسها أو خدماتها، أجب بالوصف المختصر الموثق التالي: «${COMPANY_ANSWER}»`,
    "أسلوب الرد:\n- ابدأ بالإجابة مباشرة.\n- استخدم عناوين Markdown عند تعدد الأفكار.\n- لا تذكر أسماء النماذج أو تفاصيل التوجيه الداخلية للمستخدم.",
  ];

  // Feature-specific guidance is included only while the current conversation
  // explicitly discusses that feature. Entitlement alone is not a reason to mention it.
  if (himsActivated && allowHimsContext) {
    instructions.push([
      "يمكنك الاستفادة من الموارد التعليمية المصرح بها لهذا المستخدم عندما تكون ذات صلة بطلبه الحالي.",
      "إذا طلب المستخدم موردًا تعليميًا محددًا متاحًا في السياق، فاعرضه مباشرة وباختصار.",
      "لا تذكر هذه الإمكانية في المحادثات التي لا تتناولها صراحة.",
    ].join("\n"));
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

export function getSulyProductAnswer(text: string): string | null {
  const normalized = text.normalize("NFKC").replace(/\s+/gu, " ").trim();
  const asksHow = /(?:ازاي|إزاي|كيف|كيفية|أين|فين|مكان|how|where|enable|activate|turn\s+on|تفعيل|تشغيل|أفعل|افعل)/iu.test(normalized);
  const mentionsAgentMode = /(?:وضع\s+الوكيل|الوكيل|agent\s*mode)/iu.test(normalized);
  if (!asksHow || !mentionsAgentMode) return null;
  return "لتفعيل وضع الوكيل في SULY: افتح المحادثة، ومن شريط كتابة الرسالة اضغط زر «وكيل» ذي أيقونة النجوم ✨، الموجود بجوار زر + الخاص بإرفاق الملفات. اضغطه قبل إرسال المهمة؛ ولإيقاف وضع الوكيل اضغط الزر مرة أخرى. الزر يغيّر طريقة تنفيذ الرسالة التالية ولا ينشئ محادثة جديدة.";
}

export function isIdentityQuestion(text: string): boolean {
  return getIdentityAnswer(text) !== null;
}

export const IDENTITY_ANSWER_TEXT = IDENTITY_ANSWER;
export const CREATOR_ANSWER_TEXT = CREATOR_ANSWER;
export const COMPANY_ANSWER_TEXT = COMPANY_ANSWER;
export const INACTIVE_UNKNOWN_ANSWER = "لا أملك معلومات حول ذلك.";
