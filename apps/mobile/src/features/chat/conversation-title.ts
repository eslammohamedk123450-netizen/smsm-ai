const TITLE_LIMIT = 48;

/**
 * Builds a readable conversation title from the first user message, so the
 * history list says what the request was instead of "محادثة جديدة".
 * Kept free of imports so it stays unit-testable without a Supabase client.
 */
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
