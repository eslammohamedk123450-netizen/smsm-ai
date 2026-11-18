import { supabase } from "../../lib/supabase/client";

export type TaskStep = {
  key: string;
  description: string;
  status: string;
  attemptNo: number;
  error: string | null;
};

export type TaskSnapshot = {
  taskId: string;
  status: string;
  complexity: string | null;
  estimatedSteps: number;
  updatedAt: string | null;
  steps: TaskStep[];
  review: { verdict: string; feedback: string | null } | null;
  jobId?: string;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

/** Durable progress for a brain-router task, scoped to the signed-in user by RLS. */
export async function getTaskProgress(taskId: string, jobId?: string): Promise<TaskSnapshot | null> {
  let job: Record<string, unknown> | null = null;
  if (jobId) {
    const { data } = await supabase.rpc("get_agent_task_job_status", { p_job_id: jobId });
    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row === "object") job = row as Record<string, unknown>;
  }
  const { data: context, error } = await supabase.from("brain_task_contexts")
    .select("task_id,status,complexity,estimated_steps,updated_at")
    .eq("task_id", taskId)
    .maybeSingle();
  if (error || !context) {
    if (!job) return null;
    return {
      taskId: String(job.task_id ?? taskId),
      status: String(job.status ?? "queued"),
      complexity: null,
      estimatedSteps: 0,
      updatedAt: job.updated_at == null ? null : String(job.updated_at),
      steps: [],
      review: null,
      jobId,
      result: job.result && typeof job.result === "object" ? job.result as Record<string, unknown> : null,
      errorMessage: job.error_message == null ? null : String(job.error_message),
    };
  }
  const { data: steps } = await supabase.from("brain_task_steps")
    .select("step_index,description,status,result")
    .eq("task_id", taskId)
    .order("step_index", { ascending: true })
    .limit(50);
  return {
    taskId: String(context.task_id),
    status: String(job?.status ?? context.status ?? "unknown"),
    complexity: context.complexity == null ? null : String(context.complexity),
    estimatedSteps: Number(context.estimated_steps ?? 0),
    updatedAt: context.updated_at == null ? null : String(context.updated_at),
    steps: (steps ?? []).map((step, index) => ({
      key: String(step.step_index ?? index),
      description: String(step.description ?? "خطوة"),
      status: String(step.status ?? "pending"),
      attemptNo: 0,
      error: null,
    })),
    review: null,
    jobId,
    result: job?.result && typeof job.result === "object" ? job.result as Record<string, unknown> : null,
    errorMessage: job?.error_message == null ? null : String(job.error_message),
  };
}




export type ChatAgentStep = {
  key: string;
  description: string;
  status: "pending" | "running" | "reviewing" | "waiting_approval" | "retrying" | "completed" | "failed";
  sequenceOrder: number;
  attemptNo: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type ChatAgentToolActivity = {
  tool: "connected_app.status" | "connected_app.read" | "connected_app.read_multiple" | "connected_app.write" | "web.search";
  effect: "read" | "write";
  status: "pending" | "approved" | "rejected" | "running" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
};

export type ChatAgentProgress = {
  workspaceId: string;
  requestId: string;
  userMessageId: string;
  status: "planning" | "executing" | "reviewing" | "waiting_approval" | "retrying" | "completed" | "failed" | "cancelled";
  currentStepKey: string | null;
  attemptCount: number;
  maxAttempts: number;
  updatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  plan: Array<{ key: string; description: string; dependsOn: string[] }>;
  steps: ChatAgentStep[];
  tools: ChatAgentToolActivity[];
};

const CHAT_AGENT_STATUSES = new Set(["planning", "executing", "reviewing", "waiting_approval", "retrying", "completed", "failed", "cancelled"]);
const CHAT_AGENT_STEP_STATUSES = new Set(["pending", "running", "reviewing", "waiting_approval", "retrying", "completed", "failed"]);
const CHAT_AGENT_TOOL_STATUSES = new Set(["pending", "approved", "rejected", "running", "completed", "failed"]);
const CHAT_AGENT_TOOLS = new Set(["connected_app.status", "connected_app.read", "connected_app.read_multiple", "connected_app.write", "web.search"]);

/** Safe, owner-visible projection of the central Agent workspace. Raw results, inputs, and internal reasoning are intentionally excluded. */
export function mapChatAgentProgress(workspaceValue: unknown, stepValues: unknown[], toolValues: unknown[] = []): ChatAgentProgress | null {
  const workspace = asRecord(workspaceValue);
  if (!workspace || typeof workspace.id !== "string" || typeof workspace.request_id !== "string" || typeof workspace.status !== "string" || !CHAT_AGENT_STATUSES.has(workspace.status)) return null;
  const metadata = asRecord(workspace.metadata);
  const rawPlan = Array.isArray(workspace.plan) ? workspace.plan : [];
  const plan = rawPlan.slice(0, 12).flatMap((value, index) => {
    const row = asRecord(value);
    if (!row || typeof row.description !== "string") return [];
    const key = typeof row.step_id === "string" ? row.step_id.slice(0, 100) : `step-${index + 1}`;
    const dependsOn = Array.isArray(row.depends_on) ? row.depends_on.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
    return [{ key, description: row.description.trim().slice(0, 240), dependsOn }];
  });
  const steps = stepValues.flatMap((value) => {
    const row = asRecord(value);
    if (!row || typeof row.step_key !== "string" || typeof row.status !== "string" || !CHAT_AGENT_STEP_STATUSES.has(row.status)) return [];
    return [{
      key: row.step_key.slice(0, 100),
      description: typeof row.description === "string" ? row.description.trim().slice(0, 240) : "خطوة تنفيذ",
      status: row.status as ChatAgentStep["status"],
      sequenceOrder: Number.isSafeInteger(row.sequence_order) ? Number(row.sequence_order) : 0,
      attemptNo: Number.isSafeInteger(row.attempt_no) ? Number(row.attempt_no) : 0,
      startedAt: typeof row.started_at === "string" ? row.started_at : null,
      completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    }];
  }).sort((a, b) => a.sequenceOrder - b.sequenceOrder).slice(0, 40);
  const tools = toolValues.flatMap((value) => {
    const row = asRecord(value);
    if (!row || typeof row.tool_name !== "string" || !CHAT_AGENT_TOOLS.has(row.tool_name) || typeof row.status !== "string" || !CHAT_AGENT_TOOL_STATUSES.has(row.status)) return [];
    return [{
      tool: row.tool_name as ChatAgentToolActivity["tool"],
      effect: row.effect === "write" ? "write" as const : "read" as const,
      status: row.status as ChatAgentToolActivity["status"],
      startedAt: typeof row.started_at === "string" ? row.started_at : null,
      completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    }];
  }).slice(0, 20);
  return {
    workspaceId: workspace.id,
    requestId: workspace.request_id,
    userMessageId: typeof metadata?.user_message_id === "string" ? metadata.user_message_id : workspace.request_id,
    status: workspace.status as ChatAgentProgress["status"],
    currentStepKey: typeof workspace.current_step_key === "string" ? workspace.current_step_key : null,
    attemptCount: Number.isSafeInteger(workspace.attempt_count) ? Number(workspace.attempt_count) : 0,
    maxAttempts: Number.isSafeInteger(workspace.max_attempts) ? Number(workspace.max_attempts) : 3,
    updatedAt: typeof workspace.updated_at === "string" ? workspace.updated_at : null,
    completedAt: typeof workspace.completed_at === "string" ? workspace.completed_at : null,
    cancelledAt: typeof workspace.cancelled_at === "string" ? workspace.cancelled_at : null,
    plan,
    steps,
    tools,
  };
}

const CHAT_AGENT_WORKSPACE_COLUMNS = "id,request_id,conversation_id,status,plan,current_step_key,attempt_count,max_attempts,metadata,updated_at,completed_at,cancelled_at";
const CHAT_AGENT_STEP_COLUMNS = "workspace_id,step_key,sequence_order,description,status,attempt_no,started_at,completed_at";
const CHAT_AGENT_TOOL_COLUMNS = "request_id,tool_name,effect,status,started_at,completed_at";

async function mapChatAgentWorkspaceRows(workspaces: unknown[]): Promise<ChatAgentProgress[]> {
  const rows = workspaces.flatMap((value) => {
    const row = asRecord(value);
    return row && typeof row.id === "string" && typeof row.request_id === "string" ? [row] : [];
  });
  if (!rows.length) return [];
  const workspaceIds = rows.map((row) => row.id as string);
  const requestIds = rows.map((row) => row.request_id as string);
  const [stepResult, toolResult] = await Promise.all([
    supabase.from("agent_workspace_steps").select(CHAT_AGENT_STEP_COLUMNS).in("workspace_id", workspaceIds).order("sequence_order", { ascending: true }).limit(500),
    supabase.from("agent_tool_execution_log").select(CHAT_AGENT_TOOL_COLUMNS).in("request_id", requestIds).order("started_at", { ascending: true }).limit(300),
  ]);
  if (stepResult.error || toolResult.error) throw new Error("تعذر تحميل تفاصيل تنفيذ الوكيل.");
  return rows.flatMap((row) => {
    const progress = mapChatAgentProgress(
      row,
      (stepResult.data ?? []).filter((step) => step.workspace_id === row.id),
      (toolResult.data ?? []).filter((tool) => tool.request_id === row.request_id),
    );
    return progress ? [progress] : [];
  });
}

/** Read one live Agent workspace by request ID. RLS restricts the result to its owner. */
export async function getChatAgentProgress(requestId: string): Promise<ChatAgentProgress | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return null;
  const { data, error } = await supabase.from("agent_workspaces").select(CHAT_AGENT_WORKSPACE_COLUMNS).eq("request_id", requestId).maybeSingle();
  if (error) throw new Error("تعذر تحميل حالة تنفيذ الوكيل.");
  return (await mapChatAgentWorkspaceRows(data ? [data] : []))[0] ?? null;
}

/** Recover recent Agent execution cards for a conversation after reload/reconnect. */
export async function listConversationAgentProgress(conversationId: string, limit = 20): Promise<ChatAgentProgress[]> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) return [];
  const safeLimit = Math.max(1, Math.min(30, Math.floor(Number.isFinite(limit) ? limit : 20)));
  const { data, error } = await supabase.from("agent_workspaces").select(CHAT_AGENT_WORKSPACE_COLUMNS)
    .eq("conversation_id", conversationId).order("updated_at", { ascending: false }).limit(safeLimit);
  if (error) throw new Error("تعذر استعادة سجل تنفيذ الوكيل.");
  return mapChatAgentWorkspaceRows(data ?? []);
}

export type TaskHistoryItem = {
  jobId: string;
  taskId: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  objective: string;
  resultText: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  complexity: string | null;
  estimatedSteps: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Pure, bounded projection for the signed-in user's task-history view. */
export function mapTaskHistory(jobs: unknown[], contexts: unknown[]): TaskHistoryItem[] {
  const contextByTask = new Map<string, Record<string, unknown>>();
  for (const value of contexts) {
    const row = asRecord(value);
    if (typeof row?.task_id === "string") contextByTask.set(row.task_id, row);
  }
  const allowedStatuses = new Set(["queued", "running", "completed", "failed", "cancelled"]);
  return jobs.flatMap((value) => {
    const job = asRecord(value);
    if (typeof job?.id !== "string" || typeof job.status !== "string" || !allowedStatuses.has(job.status)) return [];
    const taskId = typeof job.task_id === "string" ? job.task_id : null;
    const context = taskId ? contextByTask.get(taskId) : undefined;
    const result = asRecord(job.result);
    const resultText = typeof job.result === "string" ? job.result
      : typeof result?.response === "string" ? result.response
      : typeof result?.summary === "string" ? result.summary
      : null;
    return [{
      jobId: job.id,
      taskId,
      status: job.status as TaskHistoryItem["status"],
      objective: typeof context?.objective === "string" ? context.objective : "مهمة محفوظة",
      resultText,
      updatedAt: typeof job.updated_at === "string" ? job.updated_at : null,
      completedAt: typeof job.completed_at === "string" ? job.completed_at : null,
      complexity: typeof context?.complexity === "string" ? context.complexity : null,
      estimatedSteps: typeof context?.estimated_steps === "number" ? context.estimated_steps : null,
    }];
  });
}

/**
 * Lists only rows visible under the authenticated user's RLS policy. The
 * selected agent_task_jobs columns are intentionally limited to the explicit
 * authenticated column grants; worker payloads and lease fields are excluded.
 */
export async function listTaskHistory(limit = 100): Promise<TaskHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number.isFinite(limit) ? limit : 100)));
  const { data: jobs, error: jobsError } = await supabase.from("agent_task_jobs")
    .select("id,task_id,status,result,updated_at,completed_at")
    .order("updated_at", { ascending: false })
    .limit(safeLimit);
  if (jobsError) throw new Error("تعذر تحميل سجل المهام.");

  const taskIds = [...new Set((jobs ?? []).map((job) => job.task_id).filter((id): id is string => typeof id === "string"))];
  let contexts: unknown[] = [];
  if (taskIds.length) {
    const { data, error } = await supabase.from("brain_task_contexts")
      .select("task_id,objective,complexity,estimated_steps")
      .in("task_id", taskIds);
    if (error) throw new Error("تعذر تحميل تفاصيل سجل المهام.");
    contexts = data ?? [];
  }
  return mapTaskHistory(jobs ?? [], contexts);
}
