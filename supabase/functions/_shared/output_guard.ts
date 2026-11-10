export type OutputGuardReason = "repetition" | "max_output";

export interface OutputGuardResult {
  text: string;
  stopped: boolean;
  reason: OutputGuardReason | null;
}

export interface OutputGuardOptions {
  maxChars?: number;
  windowChars?: number;
  holdbackChars?: number;
  minRepeatedTokens?: number;
}

const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

function normalizeToken(value: string): string {
  return value.normalize("NFKC").replace(DIACRITICS, "").toLocaleLowerCase();
}

function tokensWithOffsets(value: string): Array<{ value: string; start: number }> {
  const result: Array<{ value: string; start: number }> = [];
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    result.push({ value: normalizeToken(match[0]), start: match.index ?? 0 });
  }
  return result;
}

function repeatedRunStart(value: string, minRepeatedTokens: number): number | null {
  const tokens = tokensWithOffsets(value);
  if (tokens.length < minRepeatedTokens * 3) return null;
  const maxN = Math.min(12, Math.floor(tokens.length / 3));
  for (let n = maxN; n >= minRepeatedTokens; n -= 1) {
    for (let start = 0; start + n * 3 <= tokens.length; start += 1) {
      const phraseTokens = tokens.slice(start, start + n).map((token) => token.value);
      const phrase = phraseTokens.join(" ");
      // Ignore short expressions: common function words, list labels and
      // repeated one-word terminology are not reliable loop evidence.
      if (phrase.length < 6 || new Set(phraseTokens).size < 2) continue;
      const second = tokens.slice(start + n, start + n * 2).map((token) => token.value).join(" ");
      const third = tokens.slice(start + n * 2, start + n * 3).map((token) => token.value).join(" ");
      if (phrase === second && phrase === third) return tokens[start].start;
    }
  }
  return null;
}

/**
 * Stateful server-side guard. It scans the already-emitted sliding window plus
 * a small un-emitted suffix. That suffix lets short loops spanning provider
 * chunks be cut before the repeated tail reaches the client. `finish()` releases
 * the suffix when the provider completes normally.
 */
export class OutputGuard {
  private readonly maxChars: number;
  private readonly windowChars: number;
  private readonly holdbackChars: number;
  private readonly minRepeatedTokens: number;
  private emitted = "";
  private pending = "";
  private tail = "";
  private stoppedReason: OutputGuardReason | null = null;

  constructor(options: OutputGuardOptions = {}) {
    this.maxChars = Math.max(1, Math.floor(options.maxChars ?? 24000));
    this.windowChars = Math.max(64, Math.floor(options.windowChars ?? 1400));
    this.holdbackChars = Math.max(0, Math.min(512, Math.floor(options.holdbackChars ?? 128)));
    this.minRepeatedTokens = Math.max(2, Math.floor(options.minRepeatedTokens ?? 2));
  }

  push(chunk: string): OutputGuardResult {
    if (this.stoppedReason || !chunk) {
      return { text: "", stopped: Boolean(this.stoppedReason), reason: this.stoppedReason };
    }
    const remaining = this.maxChars - this.emitted.length - this.pending.length;
    if (remaining <= 0) return this.stop("max_output", this.takePending());
    const boundedChunk = chunk.slice(0, remaining);
    const combinedPending = `${this.pending}${boundedChunk}`;
    const loopStart = repeatedRunStart(`${this.tail}${combinedPending}`, this.minRepeatedTokens);
    if (loopStart !== null) {
      const safeLength = Math.max(0, Math.min(combinedPending.length, loopStart - this.tail.length));
      const safeText = combinedPending.slice(0, safeLength);
      this.pending = "";
      this.emitted += safeText;
      this.tail = `${this.tail}${safeText}`.slice(-this.windowChars);
      return this.stop("repetition", safeText);
    }

    if (boundedChunk.length < chunk.length || this.emitted.length + combinedPending.length >= this.maxChars) {
      this.pending = "";
      this.emitted += combinedPending;
      this.tail = `${this.tail}${combinedPending}`.slice(-this.windowChars);
      return this.stop("max_output", combinedPending);
    }

    const emitLength = Math.max(0, combinedPending.length - this.holdbackChars);
    const safeText = combinedPending.slice(0, emitLength);
    this.pending = combinedPending.slice(emitLength);
    this.emitted += safeText;
    this.tail = `${this.tail}${safeText}`.slice(-this.windowChars);
    return { text: safeText, stopped: false, reason: null };
  }

  finish(): OutputGuardResult {
    if (this.stoppedReason) return { text: "", stopped: true, reason: this.stoppedReason };
    const text = this.takePending();
    this.emitted += text;
    this.tail = `${this.tail}${text}`.slice(-this.windowChars);
    return { text, stopped: false, reason: null };
  }

  get reason(): OutputGuardReason | null {
    return this.stoppedReason;
  }

  get text(): string {
    return this.emitted;
  }

  private takePending(): string {
    const text = this.pending;
    this.pending = "";
    return text;
  }

  private stop(reason: OutputGuardReason, text = ""): OutputGuardResult {
    this.stoppedReason = reason;
    return { text, stopped: true, reason };
  }
}
