// Global infrastructure: deterministic keys for the semantic response cache.
//
// These helpers are dependency-free (WebCrypto only) so the same implementation
// runs in Deno Edge Functions, in the browser, and under Jest.

export interface PromptKeyInput {
  featureKey: string;
  userMessage: string;
  systemPrompt?: string | null;
  routingMode?: string | null;
  modelId?: number | string | null;
  temperature?: number | null;
}

const FEATURE_KEY_PATTERN = /^[a-z0-9_]{1,40}$/;
const SENSITIVE_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|sb_[a-z]+_[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:api[_ -]?key|password|passwd|secret|token)\s*[:=]\s*\S{6,})/i;

/** Any feature key that does not match the strict pattern falls back to `general`. */
export function normalizeFeatureKey(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return FEATURE_KEY_PATTERN.test(raw) ? raw : "general";
}

/**
 * Cache keys must be stable across formatting differences: Unicode form, case,
 * and whitespace runs are normalized before hashing.
 */
export function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Credentials pasted into a prompt must never be persisted in the cache. */
export function containsSensitiveText(value: string): boolean {
  return SENSITIVE_PATTERN.test(value);
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeTemperature(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "default";
  return (Math.round(Math.min(2, Math.max(0, value)) * 100) / 100).toFixed(2);
}

/**
 * The exact-prompt hash identifies an identical request shape inside one
 * feature. The model is intentionally excluded: an identical question should be
 * reusable even when the router picks a different model.
 */
export async function buildPromptHash(input: PromptKeyInput): Promise<string> {
  const payload = [
    "v1",
    normalizeFeatureKey(input.featureKey),
    normalizeText(input.userMessage),
    normalizeTemperature(input.temperature),
  ].join("|");
  return sha256Hex(payload);
}

/**
 * The context hash guards semantic reuse: answers produced under a different
 * system prompt, routing mode, or pinned model are stored but only reused when
 * the surrounding context matches.
 */
export async function buildContextHash(input: PromptKeyInput): Promise<string> {
  const pinnedModel = input.routingMode === "manual" && input.modelId != null ? String(input.modelId) : "auto";
  const payload = [
    "v1",
    normalizeFeatureKey(input.featureKey),
    normalizeText(input.systemPrompt ?? ""),
    input.routingMode === "manual" ? "manual" : "auto",
    pinnedModel,
  ].join("|");
  return sha256Hex(payload);
}

/** Dedupe key for the global task memory store. */
export async function buildContentHash(featureKey: string, content: string): Promise<string> {
  return sha256Hex(["v1", normalizeFeatureKey(featureKey), normalizeText(content)].join("|"));
}

export interface CacheEligibility {
  eligible: boolean;
  reason?: "too_short" | "sensitive" | "activation_command";
}

/** Short prompts and control commands are not worth caching. */
export function checkCacheEligibility(userMessage: string): CacheEligibility {
  const text = userMessage.trim();
  if (/^\s*!activate[_-]/i.test(text)) return { eligible: false, reason: "activation_command" };
  if (normalizeText(text).length < 8) return { eligible: false, reason: "too_short" };
  if (containsSensitiveText(text)) return { eligible: false, reason: "sensitive" };
  return { eligible: true };
}
