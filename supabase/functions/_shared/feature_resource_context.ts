export interface FeatureResource {
  title: string;
  url: string;
  kind: string;
  description: string | null;
}

export interface FeatureInfo {
  label: string;
  activated: boolean;
  resources: FeatureResource[];
}

export interface FeatureContext {
  features: Record<string, FeatureInfo>;
}

const FEATURE_RESOURCE_TERMS = /(?:محاض(?:رة|رات)|مذ(?:كرة|كرات)|مل(?:ف|فات)|ملزم(?:ة|ات)|كتاب|كتب|pdf|lecture|handout|course\s+materials?|study\s+notes?)/iu;
const RESOURCE_SUMMARY_TERMS = /(?:ملخ(?:ص|صات)|summary)/iu;
const RESOURCE_ACTION = /(?:ابعت|ابعث|ارسل|أرسل|هات|جيب|عايز|عاوز|محتاج|ممكن|فين|اعرض|نزّل|نزل|حمّل|حمل|download|send|show|get)/iu;
const RESOURCE_FOLLOW_UP = /(?:ابعتها|ابعته|ابعتيها|ابعتيه|هاتها|هاته|هاتهم|ابعتهم|نزّلها|نزلها|حمّلها|حملها|افتحها|اعرضها|فينها|فينهم|الرابط|لينك|download|send\s+it|show\s+it)/iu;

export function isFeatureResourceRequest(text: string, recentUserMessages: string[] = []): boolean {
  const current = text.normalize("NFKC").trim();
  const hasResource = FEATURE_RESOURCE_TERMS.test(current) || RESOURCE_SUMMARY_TERMS.test(current);
  if (hasResource && RESOURCE_ACTION.test(current)) return true;
  if (/^(?:المحاضرة|المحاضرات|محاضرة|الملف|الملفات|ملف|المذكرة|المذكرات|مذكرة|الملزمة|ملزمة|الكتاب|الكتب|كتاب|pdf|lecture|handout)$/iu.test(current)) return true;
  if (!RESOURCE_FOLLOW_UP.test(current)) return false;
  return recentUserMessages.slice(-3).some((message) => {
    const previous = message.normalize("NFKC");
    return FEATURE_RESOURCE_TERMS.test(previous) || RESOURCE_SUMMARY_TERMS.test(previous);
  });
}

export function buildFeatureSystemContext(context: FeatureContext): string | null {
  const resources = Object.values(context.features)
    .filter((info) => info.activated)
    .flatMap((info) => info.resources);
  if (resources.length === 0) return null;
  const lines: string[] = [
    "محتوى وملفات متاحة لهذا المستخدم من مصادره المعتمدة:",
    "استخدم هذه الموارد فقط عندما يطلب المستخدم ملفاً أو محاضرة أو محتوى مرتبطاً بها.",
    "لا تذكر أسماء الأنظمة الداخلية أو التفعيل أو الأكواد. لا تخترع ملفات أو روابط غير موجودة في القائمة.",
  ];
  for (const resource of resources) {
    lines.push(`- ${resource.title}: ${resource.url}${resource.description ? ` — ${resource.description}` : ""}`);
  }
  return lines.join("\n");
}
