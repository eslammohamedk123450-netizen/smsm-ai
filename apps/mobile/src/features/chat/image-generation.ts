const IMAGE_WORD = /(?:صورة|صور|تصميم|رسمة|رسم|image|images|photo|photos|picture|pictures|illustration|artwork)/iu;
const GENERATION_VERB = /(?:أنشئ|انشئ|اصنع|اعمل|اعملي|اعمللي|صمّم|صمم|ارسم|ولّد|ولد|توليد|generate|create|draw|design|illustrate|paint|make)/iu;
const WANT_IMAGE = /^(?:عايز|عاوزه|عاوز|أريد|اريد|محتاج|محتاجة|احتاج|i\s+want|i\s+need)\s+(?:(?:to\s+)?(?:generate|create|draw|make)\s+)?(?:(?:a|an)\s+)?(?:صورة|صور|image|images|photo|photos|picture|pictures)(?=\s|$)/iu;
const ART_IMPERATIVE = /^(?:ارسم|صمّم|صمم|ولّد|ولد)(?=\s|$)|^(?:draw|paint|illustrate)\b/iu;

/** Return the user's original prompt only for explicit image-creation requests. */
export function getImageGenerationPrompt(message: string): string | null {
  const prompt = message.trim();
  if (!prompt || prompt.length > 16000) return null;
  const hasImageWord = IMAGE_WORD.test(prompt);
  if ((GENERATION_VERB.test(prompt) && hasImageWord) || WANT_IMAGE.test(prompt) || ART_IMPERATIVE.test(prompt)) {
    return prompt;
  }
  return null;
}
