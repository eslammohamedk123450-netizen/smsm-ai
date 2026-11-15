export type ExecutionMode = "chat" | "agent";
export type RequestedExecutionMode = ExecutionMode | "auto" | undefined;
export type ClassifiedIntent = "chat" | "simple_task" | "complex_task";

export interface ExecutionModeDecisionInput {
  requestedMode: RequestedExecutionMode;
  intent: ClassifiedIntent;
  hasConnectorRequest: boolean;
  hasAttachments: boolean;
  requiresLiveSearch: boolean;
  internalBrainCall: boolean;
}

/**
 * Resolve the one execution path for a request.
 * Legacy/missing mode remains Agent-compatible. Auto mode uses direct chat for
 * conversational and single-reply requests, while tool, attachment, research,
 * and compound work stays under the Agent orchestrator.
 */
export function resolveExecutionMode(input: ExecutionModeDecisionInput): ExecutionMode {
  if (input.requestedMode === "chat") return "chat";
  if (input.requestedMode !== "auto") return "agent";
  if (input.internalBrainCall) return "agent";
  if (input.hasConnectorRequest || input.hasAttachments || input.requiresLiveSearch) return "agent";
  return input.intent === "complex_task" ? "agent" : "chat";
}
