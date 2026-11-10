export interface AiRequestFingerprintInput {
  conversationId: string | null;
  userMessageId: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  mediaAssetIds: string[];
  featureKey: string;
  routingMode: string;
  modelId: number | null;
  temperature: number;
  maxTokens: number;
}

export async function fingerprintAiRequest(input: AiRequestFingerprintInput): Promise<string> {
  // Construct in a fixed property order; the digest binds a request id to the
  // authenticated conversation, message history, attachments and routing knobs
  // without storing prompts or attachment URLs in the request ledger.
  const canonical = JSON.stringify({
    conversation_id: input.conversationId,
    user_message_id: input.userMessageId,
    messages: input.messages.map(({ role, content }) => ({ role, content })),
    media_asset_ids: [...input.mediaAssetIds].sort(),
    feature_key: input.featureKey,
    routing_mode: input.routingMode,
    model_id: input.modelId,
    temperature: input.temperature,
    max_tokens: input.maxTokens,
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export type AiRequestClaim = {
  claimed?: boolean;
  already_completed?: boolean;
  in_progress?: boolean;
  terminal?: boolean;
  status?: string;
  error?: string;
  error_code?: string | null;
  response_message_id?: string | null;
  response_text?: string | null;
  response_metadata?: Record<string, unknown> | null;
};

export function isCompletedAiRequestClaim(value: unknown): value is AiRequestClaim & { already_completed: true } {
  return Boolean(value && typeof value === "object" && (value as AiRequestClaim).already_completed === true);
}

export function requestClaimHttpStatus(value: AiRequestClaim): number {
  if (value.error === "conversation_access_denied" || value.error === "user_message_access_denied") return 404;
  if (value.error === "request_id_conflict") return 409;
  if (value.in_progress || value.terminal) return 409;
  if (value.claimed === true) return 200;
  return 503;
}
