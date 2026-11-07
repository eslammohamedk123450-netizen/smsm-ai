// Global infrastructure: one embedding path shared by the semantic cache, the
// global task memory, and the agent tools. Providers are rotated until one
// returns a valid 1536-dimensional vector; credentials are read from Vault
// through a service-side RPC and never leave this module.

export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_TIMEOUT_MS = 10_000;

export const EMBEDDING_MODELS: Record<string, string> = {
  openai: "text-embedding-3-small",
  openrouter: "openai/text-embedding-3-small",
  custom: "text-embedding-3-small",
};

export type EmbeddingProvider = {
  id: number;
  provider_type: string;
  base_url: string | null;
};

export function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export function embeddingsEndpoint(baseUrl: unknown): string | null {
  if (typeof baseUrl !== "string" || baseUrl.length > 2048) return null;
  try {
    const url = new URL(baseUrl.trim());
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !host) return null;
    if (host === "localhost" || host === "metadata" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    if (host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host)) return null;
    return `${url.toString().replace(/\/+$/, "")}/embeddings`;
  } catch {
    return null;
  }
}

async function requestEmbedding(supabase: any, provider: EmbeddingProvider, text: string): Promise<number[]> {
  const endpoint = embeddingsEndpoint(provider.base_url);
  if (!endpoint) throw new Error(`${provider.provider_type} embedding URL is invalid`);

  const { data: apiKey, error: keyError } = await supabase.rpc("suly_service_get_provider_api_key", {
    p_provider_id: provider.id,
  });
  if (keyError || typeof apiKey !== "string" || apiKey.length === 0) {
    throw new Error(`${provider.provider_type} embedding credential is unavailable in Vault`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODELS[provider.provider_type],
        input: text,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: "float",
      }),
      signal: controller.signal,
      redirect: "error",
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) throw new Error(`${provider.provider_type} embeddings returned HTTP ${response.status}`);

  const payload = await response.json();
  const embedding = payload?.data?.[0]?.embedding;
  if (
    !Array.isArray(embedding) ||
    embedding.length !== EMBEDDING_DIMENSIONS ||
    !embedding.every((value: unknown) => typeof value === "number" && Number.isFinite(value))
  ) {
    throw new Error(`${provider.provider_type} did not return a valid ${EMBEDDING_DIMENSIONS}-dimensional vector`);
  }
  return embedding as number[];
}

/**
 * Returns a vector for the text, or null when no embedding provider is usable.
 * Callers must treat null as "run without semantic features", never as an error
 * that blocks the user's request.
 */
export async function createEmbedding(
  supabase: any,
  text: string,
  options: { limit?: number; maxChars?: number } = {},
): Promise<number[] | null> {
  const input = text.trim().slice(0, options.maxChars ?? 8000);
  if (!input) return null;
  try {
    const { data: providers, error } = await supabase
      .from("ai_providers")
      .select("id,provider_type,base_url")
      .in("provider_type", Object.keys(EMBEDDING_MODELS))
      .eq("enabled", true)
      .order("priority", { ascending: false })
      .limit(Math.max(1, Math.min(options.limit ?? 5, 10)));
    if (error) throw new Error(`embedding provider lookup failed: ${error.message}`);
    if (!Array.isArray(providers) || providers.length === 0) return null;
    let lastError: unknown = null;
    for (const provider of providers as EmbeddingProvider[]) {
      try {
        return await requestEmbedding(supabase, provider, input);
      } catch (error) {
        lastError = error;
      }
    }
    console.warn("Embeddings unavailable:", lastError instanceof Error ? lastError.message : String(lastError));
    return null;
  } catch (error) {
    console.warn("Embeddings unavailable:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
