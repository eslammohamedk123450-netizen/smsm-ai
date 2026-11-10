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
const BULLET_LINE = /^\s*[•*\-–]\s+\S/;
const DEPENDENCY_HINT = /(?:\bthen\b|\bafter\b|\bonce\b|\bfollowed by\b|\bdepends on\b|ثم|بعد ذلك|بعدها|بعد أن|بعد ما|يعتمد على|اعتمادًا على)/iu;

/**
 * Split only explicit, same-level numbered/bulleted asks. Message length and
 * paragraph boundaries alone are never evidence that a request is parallel.
 * Dependency language falls back to one direct model call rather than racing
 * steps whose inputs may depend on each other.
 */
export function splitTask(text: string, maxParts: number): string[] {
  const limit = Math.max(2, Math.min(5, Math.floor(maxParts) || 4));
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (DEPENDENCY_HINT.test(trimmed)) return [trimmed];

  const lines = trimmed.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];
  let listType: "numbered" | "bullet" | null = null;
  for (const line of lines) {
    const numbered = NUMBERED_LINE.test(line);
    const bullet = BULLET_LINE.test(line);
    const type = numbered ? "numbered" : bullet ? "bullet" : null;
    if (type && listType && type !== listType) return [trimmed];
    if (type && current.length > 0 && listType === type) {
      blocks.push(current.join("\n").trim());
      current = [line];
    } else {
      current.push(line);
      if (type) listType = type;
    }
  }
  if (current.length) blocks.push(current.join("\n").trim());

  const usableBlocks = blocks.filter((block) => block.length > 0);
  if (!listType || usableBlocks.length < 2) return [trimmed];
  return groupBySize(usableBlocks, limit);
}

function groupBySize(blocks: string[], maxParts: number): string[] {
  const total = blocks.reduce((sum, block) => sum + block.length, 0);
  const target = Math.max(1, Math.ceil(total / maxParts));
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

export interface TaskPlanStep {
  step_id: string;
  description: string;
  expected_inputs: Record<string, unknown>;
  completion_criteria: string;
  depends_on: string[];
}

/** Builds a compact deterministic plan for already-separated independent list items. */
export function buildIndependentTaskPlan(parts: string[], maxParts: number): TaskPlanStep[] | null {
  const limit = Math.max(2, Math.min(5, Math.floor(maxParts) || 4));
  if (parts.length < 2 || parts.length > limit || parts.some((part) => !part.trim())) return null;
  return parts.map((part, index) => ({
    step_id: `part-${index + 1}`,
    description: part.trim().slice(0, 240),
    expected_inputs: { source: "user_request_list_item", list_index: index + 1 },
    completion_criteria: "إجابة مكتملة ومباشرة عن هذا الجزء دون تنفيذ أجزاء أخرى.",
    depends_on: [],
  }));
}

/** Validates ids, bounds, required fields and an acyclic dependency graph. */
export function validateTaskPlan(plan: TaskPlanStep[], maxParts: number): boolean {
  const limit = Math.max(2, Math.min(5, Math.floor(maxParts) || 4));
  if (plan.length < 2 || plan.length > limit) return false;
  const ids = new Set(plan.map((step) => step.step_id));
  if (ids.size !== plan.length) return false;
  for (const step of plan) {
    if (!step.step_id.trim() || !step.description.trim() || !step.completion_criteria.trim()) return false;
    if (!step.expected_inputs || typeof step.expected_inputs !== "object" || !Array.isArray(step.depends_on)) return false;
    if (step.depends_on.some((id) => !ids.has(id) || id === step.step_id)) return false;
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const byId = new Map(plan.map((step) => [step.step_id, step]));
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const parent of byId.get(id)?.depends_on ?? []) if (!visit(parent)) return false;
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  return [...ids].every(visit);
}

/** Stable-order bounded worker pool used for independent task parts. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency) || 1));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
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
