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

/** Extract text from the common OpenAI Chat Completions and Responses payload shapes. */
export function extractOpenAiText(payload: unknown): string {
  const root = asRecord(payload);
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const choice = asRecord(choices[0]);
  const delta = asRecord(choice.delta);
  const message = asRecord(choice.message);
  const candidates = [
    delta.content,
    delta.text,
    message.content,
    message.text,
    choice.text,
    root.output_text,
    root.content,
    root.text,
  ];

  for (const candidate of candidates) {
    const text = contentText(candidate);
    if (text.trim()) return text;
  }

  const output = Array.isArray(root.output) ? root.output : [];
  for (const item of output) {
    const record = asRecord(item);
    const text = contentText(record.content);
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
): { done: boolean; text: string } {
  if (data === "[DONE]") return { done: true, text: "" };
  try {
    const payload = JSON.parse(data);
    const usage = extractOpenAiUsage(payload);
    if (usage.inputTokens !== null || usage.outputTokens !== null || usage.providerCostEgp !== null) {
      onUsage(usage.inputTokens, usage.outputTokens, usage.providerCostEgp);
    }
    return { done: false, text: extractOpenAiText(payload) };
  } catch {
    // Ignore provider keep-alives, comments, and incomplete frames.
    return { done: false, text: "" };
  }
}

/**
 * Read either a normal JSON response or an SSE stream. Some OpenAI-compatible
 * gateways return application/json even when stream=true; both forms are valid.
 */
export async function* readOpenAiResponse(
  response: Response,
  onUsage: ProviderUsageReporter,
): AsyncGenerator<string> {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!response.body) return;

  if (!contentType.includes("text/event-stream")) {
    const raw = await response.text();
    if (!raw.trim()) return;
    try {
      const payload = JSON.parse(raw);
      const usage = extractOpenAiUsage(payload);
      if (usage.inputTokens !== null || usage.outputTokens !== null || usage.providerCostEgp !== null) {
        onUsage(usage.inputTokens, usage.outputTokens, usage.providerCostEgp);
      }
      const text = extractOpenAiText(payload);
      if (text) yield text;
    } catch {
      // A plain-text completion is still useful from a compatible gateway.
      yield raw;
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line.startsWith("data:")) continue;
        const frame = parseSseFrame(line.slice(5).trim(), onUsage);
        if (frame.done) return;
        if (frame.text) yield frame.text;
      }

      if (done) break;
    }

    const finalLine = buffer.trimEnd();
    if (finalLine.startsWith("data:")) {
      const frame = parseSseFrame(finalLine.slice(5).trim(), onUsage);
      if (frame.text) yield frame.text;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}
