// Global infrastructure: semantic response cache service.
//
// The cache is feature-agnostic. A feature is only a `feature_key` namespace, so
// chat, HIMS, and any future feature share one storage and one lookup path.

import { buildContextHash, buildPromptHash, checkCacheEligibility, normalizeFeatureKey } from "./prompt_keys.ts";
import { createEmbedding, vectorLiteral } from "./embedding_provider.ts";

export const DEFAULT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_MATCH_THRESHOLD = 0.93;

export interface CacheLookupInput {
  supabase: any;
  featureKey: string;
  userMessage: string;
  systemPrompt?: string | null;
  routingMode?: string | null;
  modelId?: number | string | null;
  temperature?: number | null;
  userId?: string | null;
  embedding?: number[] | null;
  scope?: "global" | "user";
  matchThreshold?: number;
  matchCount?: number;
}

export interface CacheHit {
  id: string;
  responseText: string;
  similarity: number;
  modelIdentifier: string | null;
  providerType: string | null;
  routingGroup: string | null;
  createdAt: string | null;
}

export interface CacheLookupResult {
  hit: CacheHit | null;
  embedding: number[] | null;
  promptHash: string | null;
  contextHash: string | null;
  skipped: boolean;
  reason?: string;
}

interface CacheLookupOptions {
  userId?: string | null;
  scope?: "global" | "user";
  matchThreshold?: number;
  matchCount?: number;
  /** Reuse an embedding already computed for this request. */
  embedding?: number[] | null;
  /** Skip the embedding call entirely (used when the router already has one). */
  reuseEmbeddingOnly?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Looks up a cached answer for the prompt. Context hashes are compared so an
 * answer produced under a different system prompt, routing mode, or pinned model
 * is not silently reused.
 */
export async function lookupSemanticCache(input: CacheLookupInput): Promise<CacheLookupResult> {
  const featureKey = normalizeFeatureKey(input.featureKey);
  const eligibility = checkCacheEligibility(input.userMessage);
  if (!eligibility.eligible) {
    return { hit: null, embedding: input.embedding ?? null, promptHash: null, contextHash: null, skipped: true, reason: eligibility.reason };
  }
  const keyInput = {
    featureKey,
    userMessage: input.userMessage,
    systemPrompt: input.systemPrompt ?? "",
    routingMode: input.routingMode ?? "auto",
    modelId: input.modelId ?? null,
    temperature: input.temperature ?? null,
  };
  const [promptHash, contextHash] = await Promise.all([buildPromptHash(keyInput), buildContextHash(keyInput)]);
  let embedding = input.embedding ?? null;
  try {
    if (!embedding) embedding = await createEmbedding(input.supabase, input.userMessage);
    if (!embedding) {
      return { hit: null, embedding: null, promptHash, contextHash, skipped: true, reason: "embedding_unavailable" };
    }
    const options: CacheLookupOptions = {
      userId: input.userId ?? null,
      scope: input.scope ?? "global",
      matchThreshold: input.matchThreshold ?? DEFAULT_MATCH_THRESHOLD,
      matchCount: input.matchCount ?? 3,
    };
    const { data, error } = await input.supabase.rpc("suly_semantic_cache_lookup", {
      p_feature_key: featureKey,
      p_embedding: vectorLiteral(embedding),
      p_user_id: options.scope === "user" ? options.userId ?? null : options.userId ?? null,
      p_match_threshold: options.matchThreshold,
      p_match_count: options.matchCount,
      p_include_global: options.scope !== "user",
    });
    if (error) throw new Error(error.message);
    const rows = Array.isArray(data) ? data : [];
    const match = rows.map(asRecord).find((row) => {
      const rowContext = typeof row.context_hash === "string" ? row.context_hash : null;
      // Entries stored without a context hash stay usable (legacy/global entries).
      return rowContext === null || rowContext === contextHash;
    });
    if (!match) return { hit: null, embedding, promptHash, contextHash, skipped: false };
    const hit: CacheHit = {
      id: String(match.id ?? ""),
      responseText: String(match.response_text ?? ""),
      similarity: Number(match.similarity ?? 0),
      modelIdentifier: typeof match.model_identifier === "string" ? match.model_identifier : null,
      providerType: typeof match.provider_type === "string" ? match.provider_type : null,
      routingGroup: typeof match.routing_group === "string" ? match.routing_group : null,
      createdAt: typeof match.created_at === "string" ? match.created_at : null,
    };
    if (!hit.id || !hit.responseText) return { hit: null, embedding, promptHash, contextHash, skipped: false };
    return { hit, embedding, promptHash, contextHash, skipped: false };
  } catch (error) {
    console.warn("Semantic cache lookup failed:", error instanceof Error ? error.message : String(error));
    return { hit: null, embedding, promptHash, contextHash, skipped: true, reason: "lookup_failed" };
  }
}

export async function recordCacheHit(supabase: any, cacheId: string): Promise<void> {
  if (!cacheId) return;
  try {
    const { error } = await supabase.rpc("suly_semantic_cache_hit", { p_id: cacheId });
    if (error) console.warn("Could not record cache hit:", error.message);
  } catch (error) {
    console.warn("Could not record cache hit:", error instanceof Error ? error.message : String(error));
  }
}

export interface CacheStoreInput {
  supabase: any;
  featureKey: string;
  userMessage: string;
  responseText: string;
  promptHash: string | null;
  contextHash: string | null;
  embedding: number[] | null;
  userId?: string | null;
  scope?: "global" | "user";
  modelIdentifier?: string | null;
  providerType?: string | null;
  routingGroup?: string | null;
  language?: string | null;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Stores an answer for future reuse. Failures are logged and swallowed: a cache
 * write must never break a successful user response.
 */
export async function storeSemanticCache(input: CacheStoreInput): Promise<string | null> {
  const text = input.responseText.trim();
  if (!input.promptHash || !input.embedding || text.length < 20) return null;
  try {
    const { data, error } = await input.supabase.rpc("suly_semantic_cache_store", {
      p_feature_key: normalizeFeatureKey(input.featureKey),
      p_scope: input.scope ?? "global",
      p_user_id: input.scope === "user" ? input.userId ?? null : null,
      p_prompt_text: input.userMessage.slice(0, 8000),
      p_prompt_hash: input.promptHash,
      p_response_text: text.slice(0, 20000),
      p_embedding: vectorLiteral(input.embedding),
      p_model_identifier: input.modelIdentifier ?? null,
      p_provider_type: input.providerType ?? null,
      p_routing_group: input.routingGroup ?? null,
      p_context_hash: input.contextHash ?? null,
      p_language: input.language ?? null,
      p_ttl_seconds: input.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS,
      p_metadata: input.metadata ?? {},
    });
    if (error) throw new Error(error.message);
    return typeof data === "string" ? data : null;
  } catch (error) {
    console.warn("Could not store semantic cache entry:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
