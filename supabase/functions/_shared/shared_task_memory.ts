// Global infrastructure: shared-task-memory.
//
// One compact scratchpad per task (request), shared by the mind (router),
// the workers (split parts / agent loop), and the coordinator (merge step).
// Workers read this summary instead of re-reading the full chat history, so
// the whole orchestration spends the minimum tokens. The record is wiped as
// soon as the task finishes. Postgres persistence is best-effort; if the
// backing table is missing the module degrades to an in-instance map so the
// task still completes.

export interface SharedTaskMemory {
  requestId: string;
  userId: string;
  objective: string;
  done: string[];
  remaining: string[];
  sources: string[];
  createdAt: number;
}

const instanceMemory = new Map<string, SharedTaskMemory>();

export interface SharedTaskMemoryPatch {
  objective?: string;
  done?: string[];
  remaining?: string[];
  sources?: string[];
}

function clampItems(items: string[], limit = 12): string[] {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, limit).map((item) => item.slice(0, 300));
}

export async function upsertSharedTaskMemory(
  supabase: any,
  input: { requestId: string; userId: string; conversationId?: string | null; objective: string; remaining?: string[] },
): Promise<SharedTaskMemory> {
  const record: SharedTaskMemory = {
    requestId: input.requestId,
    userId: input.userId,
    objective: input.objective.slice(0, 2000),
    done: [],
    remaining: clampItems(input.remaining ?? []),
    sources: [],
    createdAt: Date.now(),
  };
  instanceMemory.set(input.requestId, record);
  try {
    const { error } = await supabase.from("agent_task_memory").upsert({
      request_id: input.requestId,
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      objective: record.objective,
      done: [],
      remaining: record.remaining,
      sources: [],
      status: "running",
    }, { onConflict: "request_id" });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn("Shared task memory upsert degraded to in-instance mode:", error instanceof Error ? error.message : String(error));
  }
  return record;
}

export async function getSharedTaskMemory(supabase: any, requestId: string): Promise<SharedTaskMemory | null> {
  const local = instanceMemory.get(requestId);
  if (local) return local;
  try {
    const { data, error } = await supabase
      .from("agent_task_memory")
      .select("request_id,user_id,objective,done,remaining,sources")
      .eq("request_id", requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const record: SharedTaskMemory = {
      requestId: String(data.request_id),
      userId: String(data.user_id),
      objective: String(data.objective ?? ""),
      done: Array.isArray(data.done) ? data.done.map(String) : [],
      remaining: Array.isArray(data.remaining) ? data.remaining.map(String) : [],
      sources: Array.isArray(data.sources) ? data.sources.map(String) : [],
      createdAt: Date.now(),
    };
    instanceMemory.set(requestId, record);
    return record;
  } catch (error) {
    console.warn("Shared task memory read degraded:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function updateSharedTaskMemory(
  supabase: any,
  requestId: string,
  patch: SharedTaskMemoryPatch,
): Promise<SharedTaskMemory | null> {
  const record = instanceMemory.get(requestId) ?? await getSharedTaskMemory(supabase, requestId);
  if (!record) return null;
  if (patch.objective !== undefined) record.objective = patch.objective.slice(0, 2000);
  if (patch.done) record.done = clampItems([...record.done, ...patch.done]);
  if (patch.remaining) record.remaining = clampItems(patch.remaining);
  if (patch.sources) record.sources = clampItems([...record.sources, ...patch.sources]);
  instanceMemory.set(requestId, record);
  try {
    const { error } = await supabase.from("agent_task_memory").update({
      objective: record.objective,
      done: record.done,
      remaining: record.remaining,
      sources: record.sources,
      updated_at: new Date().toISOString(),
    }).eq("request_id", requestId);
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn("Shared task memory update degraded:", error instanceof Error ? error.message : String(error));
  }
  return record;
}

/**
 * The worker brief replaces the full chat transcript: what is required, what
 * is done, what remains, and which sources were already gathered.
 */
export function buildWorkerBrief(memory: SharedTaskMemory): string {
  const lines = [
    "ملخص المهمة المشتركة (اقرأه بدل إعادة قراءة المحادثة كاملة):",
    `المطلوب بالظبط: ${memory.objective}`,
  ];
  if (memory.done.length > 0) lines.push(`اللي اتعمل لحد دلوقتي:\n- ${memory.done.join("\n- ")}`);
  else lines.push("اللي اتعمل لحد دلوقتي: لا شيء بعد.");
  if (memory.remaining.length > 0) lines.push(`اللي فاضل:\n- ${memory.remaining.join("\n- ")}`);
  if (memory.sources.length > 0) lines.push(`المصادر اللي اتجابت:\n- ${memory.sources.join("\n- ")}`);
  lines.push("أكمل من نقطة التوقف دون إعادة العمل المنجز.");
  return lines.join("\n");
}

/** Wipes the scratchpad once the task is finished. Never throws. */
export async function clearSharedTaskMemory(supabase: any, requestId: string): Promise<void> {
  instanceMemory.delete(requestId);
  try {
    const { error } = await supabase.from("agent_task_memory").delete().eq("request_id", requestId);
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn("Shared task memory cleanup degraded:", error instanceof Error ? error.message : String(error));
  }
}
