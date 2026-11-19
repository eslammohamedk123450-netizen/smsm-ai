const TITLE_LIMIT = 48;

function cleanTitleInput(content: string): string {
  return content
    .replace(/!ACTIVATE_[A-Za-z0-9_-]+/g, " ")
    .replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_#>\x60~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clipTitle(value: string): string {
  if (value.length <= TITLE_LIMIT) return value;
  const clipped = value.slice(0, TITLE_LIMIT);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > 18 ? clipped.slice(0, lastSpace) : clipped).trim() + "…";
}

/**
 * Creates a concise, intent-led conversation label without copying a long
 * first prompt verbatim. It is deterministic and never sends private text
 * to a second model request.
 */
export function summarizeContent(content: string): string {
  const cleaned = cleanTitleInput(content);
  if (!cleaned) return "محادثة جديدة";

  const rules: Array<[RegExp, string]> = [
    [/(?:اعمل|أعمل|اعملي|أنشئ|انشئ|ابني|ابنِ|طور|طوّر|صمم|صمّم|برمج|build|create|design|develop).{0,35}(?:موقع|website|web\s?site)/iu, "تصميم موقع إلكتروني"],
    [/(?:اعمل|أعمل|اعملي|أنشئ|انشئ|ابني|ابنِ|طور|طوّر|صمم|صمّم|برمج).{0,35}(?:تطبيق|app|application)/iu, "تطوير تطبيق"],
    [/(?:متجر|e-?commerce|online store)/iu, "إنشاء متجر إلكتروني"],
    [/(?:صمم|صمّم|اعمل|أنشئ|انشئ).{0,25}(?:شعار|logo)/iu, "تصميم شعار"],
    [/(?:اكتب|صياغة|جهز|جهّز).{0,25}(?:ايميل|إيميل|بريد|email)/iu, "كتابة بريد إلكتروني"],
    [/(?:لخص|لخّص|تلخيص|اختصر|summari[sz]e)/iu, "تلخيص المحتوى"],
    [/(?:ترجم|ترجمة|translate)/iu, "ترجمة نص"],
    [/(?:اشرح|شرح|فسر|فسّر|explain)/iu, "شرح وتوضيح"],
    [/(?:حلل|حلّل|تحليل|analy[sz]e)/iu, "تحليل الموضوع"],
    [/(?:خطة|خطط|خطّط|plan)/iu, "إعداد خطة"],
    [/(?:قارن|مقارنة|compare)/iu, "مقارنة الخيارات"],
    [/(?:ابحث|بحث|دور على|find|search)/iu, "بحث عن معلومات"],
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(cleaned)) return label;
  }

  if (cleaned.length <= 32) return cleaned;
  const normalized = cleaned
    .replace(/^(?:من فضلك|لو سمحت|ممكن|عايز|عاوز|أريد|اريد|please|can you|could you|i want you to)\s+/iu, "")
    .trim();
  return clipTitle(normalized.split(" ").filter(Boolean).slice(0, 6).join(" "));
}

/** Backward-compatible name for older callers. */
export function titleFromMessage(content: string): string {
  return summarizeContent(content);
}
