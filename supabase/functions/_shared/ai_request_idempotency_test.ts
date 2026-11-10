import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fingerprintAiRequest, isCompletedAiRequestClaim, requestClaimHttpStatus } from "./ai_request_idempotency.ts";

Deno.test("fingerprint is stable for the same request", async () => {
  const input = {
    conversationId: "conversation-1",
    userMessageId: "message-1",
    messages: [{ role: "user" as const, content: "مرحبا" }],
    mediaAssetIds: ["asset-b", "asset-a"],
    featureKey: "general",
    routingMode: "auto",
    modelId: null,
    temperature: 0.7,
    maxTokens: 1024,
  };
  assertEquals(await fingerprintAiRequest(input), await fingerprintAiRequest(input));
});

Deno.test("fingerprint changes when response-affecting input changes", async () => {
  const base = {
    conversationId: "conversation-1",
    userMessageId: "message-1",
    messages: [{ role: "user" as const, content: "مرحبا" }],
    mediaAssetIds: [],
    featureKey: "general",
    routingMode: "auto",
    modelId: null,
    temperature: 0.7,
    maxTokens: 1024,
  };
  assertNotEquals(await fingerprintAiRequest(base), await fingerprintAiRequest({ ...base, maxTokens: 2048 }));
  assertNotEquals(await fingerprintAiRequest(base), await fingerprintAiRequest({ ...base, messages: [{ role: "user", content: "طلب آخر" }] }));
});

Deno.test("recognizes cached and conflicting claims", () => {
  assertEquals(isCompletedAiRequestClaim({ already_completed: true }), true);
  assertEquals(requestClaimHttpStatus({ error: "request_id_conflict" }), 409);
  assertEquals(requestClaimHttpStatus({ in_progress: true }), 409);
  assertEquals(requestClaimHttpStatus({ claimed: true }), 200);
});
