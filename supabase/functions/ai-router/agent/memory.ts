export type AgentMemoryState = {
  embedding: number[] | null;
  memories: string[];
};

type EmbeddingProvider = {
  id: number;
  provider_type: string;
  base_url: string | null;
};

const EMBEDDING_MODELS: Record<string, string> = {
  openai: "text-embedding-3-small",
  openrouter: "openai/text-embedding-3-small",
  custom: "text-embedding-3-small",
};

function embeddingsEndpoint(baseUrl: unknown): string | null {
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

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
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
  const timeoutId = setTimeout(() => controller.abort(), 10000);
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
        dimensions: 1536,
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
  if (!Array.isArray(embedding) || embedding.length !== 1536 || !embedding.every((value: unknown) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error(`${provider.provider_type} did not return a valid 1536-dimensional vector`);
  }
  return embedding as number[];
}

export async function prepareAgentMemory(
  supabase: any,
  userId: string,
  queryText: string,
): Promise<AgentMemoryState> {
  const unavailable: AgentMemoryState = { embedding: null, memories: [] };
  const text = queryText.trim().slice(0, 8000);
  if (!text) return unavailable;

  try {
    const { data: providers, error: providerError } = await supabase
      .from("ai_providers")
      .select("id,provider_type,base_url")
      .in("provider_type", Object.keys(EMBEDDING_MODELS))
      .eq("enabled", true)
      .order("priority", { ascending: false })
      .limit(10);
    if (providerError) throw new Error(`embedding provider lookup failed: ${providerError.message}`);
    if (!Array.isArray(providers) || providers.length === 0) return unavailable;

    let embedding: number[] | null = null;
    let lastError: unknown = null;
    for (const provider of providers as EmbeddingProvider[]) {
      try {
        embedding = await requestEmbedding(supabase, provider, text);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!embedding) {
      const message = lastError instanceof Error ? lastError.message : String(lastError ?? "no compatible embedding provider");
      console.warn("Long-term memory is unavailable for this request:", message);
      return unavailable;
    }

    // Use the service-side overload, which takes an explicit user_id and checks it.
    const { data: rows, error: memoryError } = await supabase.rpc("get_relevant_memories", {
      user_id: userId,
      query_embedding: vectorLiteral(embedding),
    });
    if (memoryError) throw new Error(`memory search failed: ${memoryError.message}`);

    const memories = (Array.isArray(rows) ? rows : [])
      .filter((row: any) => typeof row?.content === "string" && Number(row?.similarity) >= 0.7)
      .slice(0, 5)
      .map((row: any) => row.content as string);
    return { embedding, memories };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Long-term memory is unavailable for this request:", message);
    return unavailable;
  }
}

export async function saveAgentMemory(
  supabase: any,
  userId: string,
  content: string,
  embedding: number[] | null,
): Promise<void> {
  const text = content.trim();
  if (!embedding || text.length < 20 || embedding.length !== 1536) return;
  // Do not retain obvious credentials pasted into chat.
  if (/\b(?:sk-[A-Za-z0-9_-]{16,}|Bearer\s+\S+|(?:api[_ -]?key|password|secret)\s*[:=]\s*\S+)/i.test(text)) return;

  try {
    const { error } = await supabase.from("agent_memories").insert({
      user_id: userId,
      content: text.slice(0, 4000),
      embedding: vectorLiteral(embedding),
    });
    if (error) console.warn("Could not save long-term memory:", error.message);
  } catch (error) {
    console.warn("Could not save long-term memory:", error instanceof Error ? error.message : String(error));
  }
}
