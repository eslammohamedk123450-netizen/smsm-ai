const IMAGE_WORD = /(?:صورة|صور|تصميم|image|images|photo|photos|picture|pictures|illustration|artwork)/iu;
const CHAT_VISUAL_REQUEST = /(?:رسم\\s+بياني|رسمة\\s+بيانية|مخطط(?:ات)?|مخطط\\s+تدفق|جدول(?:\\s+مقارنة)?|لوحة\\s+(?:معلومات|تحكم)|داشبورد|chart|graph|flowchart|diagram|dashboard|data\\s+visuali[sz]ation|comparison\\s+table)/iu;
const GENERATION_VERB = /(?:أنشئ|انشئ|اصنع|اعمل|اعملي|اعمللي|تعمل|تعمللي|تسوي|سوي|انتج|أنتج|صمّم|صمم|ارسم|ولّد|ولد|توليد|generate|create|draw|design|illustrate|paint|make)/iu;
const WANT_IMAGE = /^(?:عايز|عاوزه|عاوز|أريد|اريد|محتاج|محتاجة|احتاج|i\s+want|i\s+need)\s+(?:(?:to\s+)?(?:generate|create|draw|make)\s+)?(?:(?:a|an)\s+)?(?:صورة|صور|image|images|photo|photos|picture|pictures)(?=\s|$)/iu;
const ART_IMPERATIVE = /^(?:ارسم|صمّم|صمم|ولّد|ولد)(?=\s|$)|^(?:draw|paint|illustrate)\b/iu;

/** Return the user's original prompt only for explicit image-creation requests. */
export function getImageGenerationPrompt(message: string): string | null {
  const prompt = message.trim();
  if (!prompt || prompt.length > 16000 || CHAT_VISUAL_REQUEST.test(prompt)) return null;
  const hasImageWord = IMAGE_WORD.test(prompt);
  if ((GENERATION_VERB.test(prompt) && hasImageWord) || WANT_IMAGE.test(prompt) || ART_IMPERATIVE.test(prompt)) {
    return prompt;
  }
  return null;
}

export type StudioIntent = "image" | "video" | "audio" | "transcription";

const VIDEO_WORD = /(?:فيديو|الفيديو|video|videos|clip|clips)/iu;
const AUDIO_WORD = /(?:صوت|الصوت|تعليق\s+صوتي|موسيقى|audio|voiceover|voice\s+over|sound|music)/iu;
const RECORDING_WORD = /(?:تسجيل|التسجيل|تسجيلات|recording|recordings)/iu;
const WANT_VIDEO = /^(?:عايز|عاوزه|عاوز|أريد|اريد|محتاج|محتاجة|احتاج|i\s+want|i\s+need)\s+(?:(?:to\s+)?(?:generate|create|make|produce)\s+)?(?:فيديو|الفيديو|video|clip)(?=\s|$)/iu;
const WANT_AUDIO = /^(?:عايز|عاوزه|عاوز|أريد|اريد|محتاج|محتاجة|احتاج|i\s+want|i\s+need)\s+(?:(?:to\s+)?(?:generate|create|make|produce)\s+)?(?:صوت|تعليق\s+صوتي|موسيقى|audio|voiceover|music)(?=\s|$)/iu;
const TRANSCRIPTION_ACTION = /(?:فرّغ|فرغ|تفريغ|حوّل|حول|اكتب\s+النص|transcribe)/iu;

/** Detect explicit media-creation or transcription requests that must be confirmed in Studio. */
export function getStudioIntent(message: string): StudioIntent | null {
  const prompt = message.normalize("NFKC").trim();
  if (!prompt || prompt.length > 16000) return null;
  if (getImageGenerationPrompt(prompt)) return "image";
  if (VIDEO_WORD.test(prompt) && (GENERATION_VERB.test(prompt) || WANT_VIDEO.test(prompt))) return "video";
  if (AUDIO_WORD.test(prompt) && (GENERATION_VERB.test(prompt) || WANT_AUDIO.test(prompt))) return "audio";
  if (TRANSCRIPTION_ACTION.test(prompt) && (AUDIO_WORD.test(prompt) || RECORDING_WORD.test(prompt))) return "transcription";
  return null;
}
