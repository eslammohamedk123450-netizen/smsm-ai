export interface CentralAgentResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  agentSteps: Record<string, unknown>[];
  completedSteps: number;
  estimatedSteps: number;
  complexity: "easy" | "complex";
  capabilities: string[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 50_000) : "";
}

function numericTokens(value: unknown): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

/** Parse the provider-neutral ai-router response used by queued Brain jobs. */
export function parseCentralAgentResult(value: unknown): CentralAgentResult | null {
  const payload = asRecord(value);
  const envelope = asRecord(payload.response);
  const choices = Array.isArray(envelope.choices) ? envelope.choices : [];
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice.message);
  const response = cleanText(message.content);
  const usage = asRecord(payload.usage);
  const hasUsage = Object.keys(usage).length > 0;
  const agentSteps = Array.isArray(payload.agent_steps)
    ? payload.agent_steps.map(asRecord).slice(0, 100)
    : [];
  // Failed central Agent attempts can still incur provider usage. Preserve that
  // usage even when no assistant response was produced so Brain can finalize it.
  if (!response && !hasUsage && agentSteps.length === 0) return null;
  const completedSteps = agentSteps.filter((step) => step.status === "completed").length;
  const capabilities = agentSteps.some((step) => step.tool === "web.search")
    ? ["text", "web_search"]
    : ["text"];

  return {
    response,
    inputTokens: numericTokens(usage.input_tokens),
    outputTokens: numericTokens(usage.output_tokens),
    agentSteps,
    completedSteps,
    estimatedSteps: Math.max(1, agentSteps.length),
    complexity: agentSteps.length > 2 ? "complex" : "easy",
    capabilities,
  };
}

export function toBrainTaskStepRows(
  taskId: string,
  agentSteps: Record<string, unknown>[],
  fallbackStatus: "completed" | "failed" = "completed",
): Array<Record<string, unknown>> {
  const sourceSteps = agentSteps.length > 0
    ? agentSteps.slice(0, 100)
    : [{ kind: "final", status: fallbackStatus }];
  return sourceSteps.map((step, index) => {
    const tool = typeof step.tool === "string" ? step.tool.slice(0, 80) : null;
    const kind = typeof step.kind === "string" ? step.kind : "planning";
    const rawStatus = step.status;
    const status = rawStatus === "completed" ? "completed" : rawStatus === "failed" ? "failed" : "running";
    const capabilityKey = tool === "web.search" ? "web_search" : kind === "planning" ? "reasoning" : "text";
    const description = tool
      ? `تنفيذ الأداة ${tool}`
      : kind === "final"
        ? "صياغة النتيجة النهائية"
        : kind === "error"
          ? "معالجة تعذر الخطوة"
          : "تحليل الطلب واختيار الخطوة";
    return {
      task_id: taskId,
      step_index: index + 1,
      capability_key: capabilityKey,
      description,
      expected_inputs: { source: "central_agent", kind, ...(tool ? { tool } : {}) },
      status,
      result: { agent_step: step },
    };
  });
}
