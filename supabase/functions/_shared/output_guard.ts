export type OutputGuardReason = "repetition" | "max_output";

export interface OutputGuardResult {
  text: string;
  stopped: boolean;
  reason: OutputGuardReason | null;
}

export interface OutputGuardOptions {
  maxChars?: number;
  windowChars?: number;
  minRepeatedTokens?: number;
}

const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

function normalizeToken(value: string): string {
  return value.normalize("NFKC").replace(DIACRITICS, "").toLocaleLowerCase();
}

function tokensWithOffsets(value: string): Array<{ value: string; start: number; end: number }> {
  const result: Array<{ value: string; start: number; end: number }> = [];
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    result.push({ value: normalizeToken(raw), start, end: start + raw.length });
  }
  return result;
}

function repeatedRunStart(value: string, minRepeatedTokens: number): number | null {
  const tokens = tokensWithOffsets(value);
  if (tokens.length < minRepeatedTokens * 3) return null;
  const maxN = Math.min(12, Math.floor(tokens.length / 3));
  for (let n = maxN; n >= minRepeatedTokens; n -= 1) {
    for (let start = 0; start + n * 3 <= tokens.length; start += 1) {
      const phrase = tokens.slice(start, start + n).map((token) => token.value).join(" ");
      // Keep the threshold above one-word loops while allowing short Arabic
      // phrases such as "إذا كنت" (seven normalized characters).
      if (phrase.length < 6) continue;
      const second = tokens.slice(start + n, start + n * 2).map((token) => token.value).join(" ");
      const third = tokens.slice(start + n * 2, start + n * 3).map((token) => token.value).join(" ");
      if (phrase === second && phrase === third) return tokens[start].start;
    }
  }
  return null;
}

/**
 * Stateful server-side output guard. It deliberately requires three consecutive
 * repetitions of a non-trivial phrase, avoiding short words and normal lists.
 */
export class OutputGuard {
  private readonly maxChars: number;
  private readonly windowChars: number;
  private readonly minRepeatedTokens: number;
  private emitted = "";
  private tail = "";
  private stoppedReason: OutputGuardReason | null = null;

  constructor(options: OutputGuardOptions = {}) {
    this.maxChars = Math.max(1, Math.floor(options.maxChars ?? 24000));
    this.windowChars = Math.max(64, Math.floor(options.windowChars ?? 1400));
    this.minRepeatedTokens = Math.max(2, Math.floor(options.minRepeatedTokens ?? 2));
  }

  push(chunk: string): OutputGuardResult {
    if (this.stoppedReason || !chunk) return { text: "", stopped: Boolean(this.stoppedReason), reason: this.stoppedReason };
    const remaining = this.maxChars - this.emitted.length;
    if (remaining <= 0) return this.stop("max_output");
    const boundedChunk = chunk.slice(0, remaining);
    const combined = `${this.tail}${boundedChunk}`;
    const normalizedForDetection = combined.replace(PUNCTUATION, " ");
    const loopStart = repeatedRunStart(normalizedForDetection, this.minRepeatedTokens);
    if (loopStart !== null) {
      const safeLength = Math.max(0, Math.min(boundedChunk.length, loopStart - this.tail.length));
      const safeText = boundedChunk.slice(0, safeLength);
      this.emitted += safeText;
      this.tail = `${this.tail}${safeText}`.slice(-this.windowChars);
      return this.stop("repetition", safeText);
    }
    this.emitted += boundedChunk;
    this.tail = combined.slice(-this.windowChars);
    if (boundedChunk.length < chunk.length || this.emitted.length >= this.maxChars) return this.stop("max_output", boundedChunk);
    return { text: boundedChunk, stopped: false, reason: null };
  }

  get reason(): OutputGuardReason | null {
    return this.stoppedReason;
  }

  get text(): string {
    return this.emitted;
  }

  private stop(reason: OutputGuardReason, text = ""): OutputGuardResult {
    this.stoppedReason = reason;
    return { text, stopped: true, reason };
  }
}
