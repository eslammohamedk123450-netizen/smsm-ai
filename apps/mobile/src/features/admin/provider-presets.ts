export interface ProviderPreset {
  /** Value stored in ai_providers.provider_type and used by the ai-router adapter. */
  type: string;
  /** Default display name written to ai_providers.name. */
  name: string;
  /** Chat-completions base URL expected by the matching adapter. */
  baseUrl: string;
  /** Short hint about where the key comes from. */
  keyHint: string;
  /** Requires the administrator to supply the base URL manually. */
  requiresBaseUrl?: boolean;
}

/**
 * Presets mirror `supabase/functions/ai-router/providers/*` so the stored
 * `provider_type` always matches an existing adapter. `custom` is the only
 * preset that requires a URL, because it points at an arbitrary gateway.
 */
export const providerPresets: ProviderPreset[] = [
  { type: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", keyHint: "يبدأ عادةً بـ sk-" },
  { type: "anthropic", name: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", keyHint: "يبدأ عادةً بـ sk-ant-" },
  { type: "google_ai", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", keyHint: "مفتاح من Google AI Studio" },
  { type: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", keyHint: "من لوحة DeepSeek" },
  { type: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", keyHint: "يبدأ عادةً بـ sk-or-" },
  { type: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", keyHint: "يبدأ عادةً بـ gsk_" },
  { type: "mistral", name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", keyHint: "من لوحة Mistral" },
  { type: "together", name: "Together AI", baseUrl: "https://api.together.xyz/v1", keyHint: "من لوحة Together" },
  { type: "xai", name: "xAI Grok", baseUrl: "https://api.x.ai/v1", keyHint: "يبدأ عادةً بـ xai-" },
  { type: "perplexity", name: "Perplexity", baseUrl: "https://api.perplexity.ai", keyHint: "يبدأ عادةً بـ pplx-" },
  { type: "cohere", name: "Cohere", baseUrl: "https://api.cohere.com/v2", keyHint: "من لوحة Cohere" },
  { type: "custom", name: "مزود مخصص", baseUrl: "", keyHint: "أي بوابة متوافقة مع OpenAI", requiresBaseUrl: true },
];

export function findPreset(type: string): ProviderPreset | undefined {
  return providerPresets.find((preset) => preset.type === type);
}