// supabase/functions/ai-router/resilience.ts
//
// Resilience helpers for the router:
//   * a fast pre-flight probe that drops dead candidates before the real race
//   * task splitting for long / multi-question prompts
//   * part merging that keeps numbering stable

export interface ProbeTarget {
  endpoint: string;
  apiKey: string;
  modelIdentifier: string;
}

export interface ProbeOutcome {
  ok: boolean;
  durationMs: number;
  error: string | null;
}

const PROBE_PROMPT = "ping";

/**
 * Sends a minimal non-streaming request. A provider that answers within the
 * budget is considered alive; anything else (HTTP error, timeout, empty body)
 * is treated as dead so the router never spends the race budget on it.
 */
export async function probeCandidate(target: ProbeTarget, timeoutMs: number): Promise<ProbeOutcome> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(300, timeoutMs));
  try {
    const response = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: target.modelIdentifier,
        messages: [{ role: "user", content: PROBE_PROMPT }],
        max_tokens: 1,
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        error: `preflight_http_${response.status}${body ? `: ${body.slice(0, 160)}` : ""}`,
      };
    }
    // Drain a bounded amount so the connection is released cleanly.
    await response.text().catch(() => "");
    return { ok: true, durationMs: Date.now() - startedAt, error: null };
  } catch (error) {
    const aborted = controller.signal.aborted;
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: aborted ? "preflight_timeout" : `preflight_error: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probes a bounded set of candidates in parallel and reports which ones failed.
 * The caller decides how to record the failures (health + circuit breaker).
 */
export async function probeCandidates<T extends ProbeTarget>(
  candidates: T[],
  timeoutMs: number,
): Promise<{ alive: T[]; dead: Array<{ candidate: T; error: string; durationMs: number }> }> {
  if (candidates.length === 0) return { alive: [], dead: [] };
  const results = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      outcome: await probeCandidate(candidate, timeoutMs),
    })),
  );
  const alive: T[] = [];
  const dead: Array<{ candidate: T; error: string; durationMs: number }> = [];
  for (const item of results) {
    if (item.outcome.ok) alive.push(item.candidate);
    else dead.push({
      candidate: item.candidate,
      error: item.outcome.error ?? "preflight_failed",
      durationMs: item.outcome.durationMs,
    });
  }
  return { alive, dead };
}

const NUMBERED_LINE = /^\s*(?:(\d{1,3})\s*[.)\-–:]|(?:س|q|Q)\s*\.?\s*(\d{1,3})\s*[.)\-–:])\s*/;
const QUESTION_HINT = /(?:^|\n)\s*(?:\d{1,3}\s*[.)\-–]|[•\-*]\s|\?|؟)/g;

function countQuestions(text: string): number {
  const matches = text.match(QUESTION_HINT);
  return matches ? matches.length : 0;
}

/** Splits a block of numbered questions (or long prose) into balanced parts. */
export function splitTask(text: string, maxParts: number): string[] {
  const limit = Math.max(2, Math.min(12, Math.floor(maxParts) || 6));
  const trimmed = text.trim();
  if (!trimmed) return [];
  const questionCount = countQuestions(trimmed);
  const isLong = trimmed.length > 1200;
  if (!isLong && questionCount < 4) return [trimmed];

  const lines = trimmed.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];
  let seenNumbered = false;
  for (const line of lines) {
    if (NUMBERED_LINE.test(line) && current.length > 0 && seenNumbered) {
      blocks.push(current.join("\n").trim());
      current = [line];
    } else {
      if (NUMBERED_LINE.test(line)) seenNumbered = true;
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join("\n").trim());

  const usableBlocks = blocks.filter((block) => block.length > 0);
  if (usableBlocks.length < 2) {
    // No numbered structure: fall back to paragraph/size based splitting.
    const paragraphs = trimmed.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    if (paragraphs.length >= 2) return groupBySize(paragraphs, limit);
    return sliceBySize(trimmed, limit);
  }
  return groupBySize(usableBlocks, limit);
}

function groupBySize(blocks: string[], maxParts: number): string[] {
  const total = blocks.reduce((sum, block) => sum + block.length, 0);
  const target = Math.max(400, Math.ceil(total / maxParts));
  const parts: string[] = [];
  let buffer: string[] = [];
  let size = 0;
  for (const block of blocks) {
    if (buffer.length > 0 && size + block.length > target && parts.length < maxParts - 1) {
      parts.push(buffer.join("\n\n").trim());
      buffer = [block];
      size = block.length;
    } else {
      buffer.push(block);
      size += block.length;
    }
  }
  if (buffer.length) parts.push(buffer.join("\n\n").trim());
  return parts.filter(Boolean).slice(0, maxParts);
}

function sliceBySize(text: string, maxParts: number): string[] {
  const target = Math.max(600, Math.ceil(text.length / maxParts));
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < text.length && parts.length < maxParts - 1) {
    let end = Math.min(text.length, cursor + target);
    if (end < text.length) {
      const newline = text.lastIndexOf("\n", end);
      if (newline > cursor + 200) end = newline;
    }
    parts.push(text.slice(cursor, end).trim());
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor).trim());
  return parts.filter(Boolean);
}

/** Joins part answers while keeping the original order and numbering visible. */
export function mergePartAnswers(parts: Array<{ index: number; content: string; model: string | null }>): string {
  if (parts.length === 1) return parts[0].content;
  return parts
    .map((part) => {
      const heading = `### الجزء ${part.index + 1}`;
      const body = part.content.trim() || "لم يتمكن أي نموذج من إكمال هذا الجزء.";
      return `${heading}\n\n${body}`;
    })
    .join("\n\n");
}
