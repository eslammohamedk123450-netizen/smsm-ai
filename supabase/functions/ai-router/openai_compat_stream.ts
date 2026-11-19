export type ProviderUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  providerCostEgp: number | null;
};

export type ProviderUsageReporter = (
  inputTokens: number | null,
  outputTokens: number | null,
  providerCostEgp: number | null,
) => void;

export type ProviderAttemptFailureStatus = "cancelled" | "timeout" | "empty" | "error";

type FailureContext = {
  cancelledByWinner: boolean;
  cancelledByRequest: boolean;
  raceDeadlineExpired: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === "string") return part;
      const item = asRecord(part);
      if (typeof item.text === "string") return item.text;
      if (typeof item.output_text === "string") return item.output_text;
      return typeof item.content === "string" ? item.content : "";
    }).join("");
  }
  const item = asRecord(value);
  if (typeof item.text === "string") return item.text;
  if (typeof item.output_text === "string") return item.output_text;
  return typeof item.content === "string" ? item.content : "";
}

function extractProviderError(payload: unknown): string | null {
  const root = asRecord(payload);
  const response = asRecord(root.response);
  const raw = root.error ?? response.error;
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 500);
  if (raw && typeof raw === "object") {
    const error = asRecord(raw);
    const message = typeof error.message === "string" ? error.message : typeof error.detail === "string" ? error.detail : "";
    if (message.trim()) return message.trim().slice(0, 500);
    if (typeof error.code === "string") return error.code.slice(0, 120);
  }
  if (root.type === "error" || root.type === "response.failed") {
    const message = typeof root.message === "string" ? root.message : "provider reported a failed response";
    return message.slice(0, 500);
  }
  return null;
}

/** Extract user-visible text from common OpenAI, Anthropic, Gemini and gateway envelopes. */
export function extractOpenAiText(payload: unknown): string {
  const root = asRecord(payload);
  const response = asRecord(root.response);
  const data = asRecord(root.data);
  const result = asRecord(root.result);
  const choices = Array.isArray(root.choices) ? root.choices : Array.isArray(response.choices) ? response.choices : [];
  const choice = asRecord(choices[0]);
  const delta = asRecord(choice.delta);
  const message = asRecord(choice.message);
  const rootDelta = asRecord(root.delta);
  const rootMessage = asRecord(root.message);
  const candidates = [
    delta.content, delta.text, message.content, message.text, choice.text,
    rootDelta.text, rootDelta.content, rootMessage.content, rootMessage.text,
    root.output_text, root.content, root.text,
    response.output_text, response.content, response.text,
    data.output_text, data.content, data.text,
    result.output_text, result.content, result.text,
  ];

  for (const candidate of candidates) {
    const text = contentText(candidate);
    if (text.trim()) return text;
  }

  const output = Array.isArray(root.output) ? root.output : Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const text = contentText(asRecord(item).content);
    if (text.trim()) return text;
  }

  const geminiCandidates = Array.isArray(root.candidates) ? root.candidates : Array.isArray(response.candidates) ? response.candidates : [];
  for (const item of geminiCandidates) {
    const content = asRecord(asRecord(item).content);
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const text = parts.map((part) => contentText(part)).join("");
    if (text.trim()) return text;
  }
  return "";
}

export function extractOpenAiUsage(payload: unknown): ProviderUsage {
  const root = asRecord(payload);
  const usage = asRecord(root.usage);
  const billing = asRecord(root.x_billing);
  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
  };

  return {
    inputTokens: toNumber(usage.prompt_tokens ?? usage.input_tokens),
    outputTokens: toNumber(usage.completion_tokens ?? usage.output_tokens),
    providerCostEgp: (() => {
      const value = billing.cost_egp;
      if (value === null || value === undefined || value === "") return null;
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 ? number : null;
    })(),
  };
}

/** Do not treat cleanup aborts as provider timeouts; classify the original failure. */
export function classifyProviderAttemptFailure(
  errorText: string,
  context: FailureContext,
): ProviderAttemptFailureStatus {
  if (context.cancelledByWinner || context.cancelledByRequest) return "cancelled";
  if (/no text|empty response/i.test(errorText)) return "empty";
  if (context.raceDeadlineExpired || /timeout|timed out/i.test(errorText)) return "timeout";
  return "error";
}

function parseSseFrame(
  data: string,
  onUsage: ProviderUsageReporter,
  onFinishReason?: (reason: string) => void,
): { done: boolean; text: string } {
  if (data === "[DONE]") return { done: true, text: "" };
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    // Ignore provider keep-alives, comments, and incomplete frames.
    return { done: false, text: "" };
  }
  const providerError = extractProviderError(payload);
  if (providerError) throw new Error(`provider_error: ${providerError}`);
  const root = asRecord(payload);
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const finishReason = asRecord(choices[0]).finish_reason;
  const geminiCandidates = Array.isArray(root.candidates) ? root.candidates : [];
  const geminiFinishReason = asRecord(geminiCandidates[0]).finishReason;
  if (typeof finishReason === "string" && finishReason) onFinishReason?.(finishReason);
  if (typeof geminiFinishReason === "string" && geminiFinishReason) {
    onFinishReason?.(geminiFinishReason.toUpperCase() === "MAX_TOKENS" ? "length" : geminiFinishReason.toLowerCase());
  }
  const terminalEvent = ["message_stop", "response.completed", "response.done"].includes(String(root.type ?? ""));
  const usage = extractOpenAiUsage(payload);
  if (usage.inputTokens !== null || usage.outputTokens !== null || usage.providerCostEgp !== null) {
    onUsage(usage.inputTokens, usage.outputTokens, usage.providerCostEgp);
  }
  return { done: terminalEvent || typeof geminiFinishReason === "string" && geminiFinishReason.length > 0, text: extractOpenAiText(payload) };
}

/**
 * Read either a normal JSON response or an SSE stream. Some OpenAI-compatible
 * gateways return application/json even when stream=true; both forms are valid.
 */
export async function* readOpenAiResponse(
  response: Response,
  onUsage: ProviderUsageReporter,
  onFinishReason?: (reason: string) => void,
): AsyncGenerator<string> {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!response.body) return;

  if (!contentType.includes("text/event-stream")) {
    const raw = await response.text();
    if (!raw.trim()) return;
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      // A plain-text completion is still useful from a compatible gateway.
      yield raw;
      return;
    }
    const providerError = extractProviderError(payload);
    if (providerError) throw new Error(`provider_error: ${providerError}`);
    const root = asRecord(payload);
    const choices = Array.isArray(root.choices) ? root.choices : [];
    const finishReason = asRecord(choices[0]).finish_reason;
    if (typeof finishReason === "string" && finishReason) onFinishReason?.(finishReason);
    const usage = extractOpenAiUsage(payload);
    if (usage.inputTokens !== null || usage.outputTokens !== null || usage.providerCostEgp !== null) {
      onUsage(usage.inputTokens, usage.outputTokens, usage.providerCostEgp);
    }
    const text = extractOpenAiText(payload);
    if (text) yield text;
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDoneMarker = false;
  let sawFinishReason = false;
  const reportFinishReason = (reason: string) => {
    sawFinishReason = true;
    onFinishReason?.(reason);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line.startsWith("data:")) continue;
        const frame = parseSseFrame(line.slice(5).trim(), onUsage, reportFinishReason);
        if (frame.text) yield frame.text;
        if (frame.done) {
          sawDoneMarker = true;
          return;
        }
      }

      if (done) break;
    }

    const finalLine = buffer.trimEnd();
    if (finalLine.startsWith("data:")) {
      const frame = parseSseFrame(finalLine.slice(5).trim(), onUsage, reportFinishReason);
      if (frame.text) yield frame.text;
      if (frame.done) sawDoneMarker = true;
    }
    // EOF without [DONE] or a provider finish_reason means the gateway may
    // have silently truncated the stream. Surface this to the continuation layer.
    if (!sawDoneMarker && !sawFinishReason) {
      throw new Error("provider_stream_incomplete: stream closed before a completion marker");
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}
