const TITLE_LIMIT = 48;

/** Fast, dependency-free first-message summarizer. */
export function summarizeContent(content: string): string {
  const cleaned = content
    .replace(/!ACTIVATE_[A-Za-z0-9_-]+/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_#>`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "محادثة جديدة";
  if (/^(مرحب|اهل|أهل|السلام|هاي|hello|hi)\b/i.test(cleaned)) return "تحية";
  if (/(تطبيق|app|موقع|واجهة|برمج|كود|react|expo|supabase|api)/i.test(cleaned)) return "فكرة أو سؤال تقني";
  if (/(فكرة|مشروع|ابتكار|خطة)/i.test(cleaned)) return "فكرة مشروع";
  if (/(اشرح|شرح|كيف|لماذا|ما هو|ما هي|سؤال|معلومة)/i.test(cleaned)) return "سؤال معرفي";
  if (/(لخص|تلخيص|ملخص|اختصر)/i.test(cleaned)) return "تلخيص محتوى";
  if (/(ترجم|ترجمة|translate)/i.test(cleaned)) return "ترجمة";
  if (cleaned.length <= TITLE_LIMIT) return cleaned;
  const clipped = cleaned.slice(0, TITLE_LIMIT);
  const lastSpace = clipped.lastIndexOf(" ");
  const title = (lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped).trim();
  return `${title}…`;
}

/** Legacy content title kept for existing callers and saved conversations. */
export function titleFromMessage(content: string): string {
  const cleaned = content
    .replace(/!ACTIVATE_[A-Za-z0-9_-]+/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_#>`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "محادثة جديدة";
  if (cleaned.length <= TITLE_LIMIT) return cleaned;
  const clipped = cleaned.slice(0, TITLE_LIMIT);
  const lastSpace = clipped.lastIndexOf(" ");
  const title = (lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped).trim();
  return `${title}…`;
}
