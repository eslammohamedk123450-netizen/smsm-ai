type ModelCandidate = { model: { id: number } };

/** Prefer a configured model only when it is already present in this eligible pool. */
export function prioritizeModelCandidate<T extends ModelCandidate>(
  candidates: T[],
  preferredModelId: number | null,
): T[] {
  if (preferredModelId === null || !Number.isSafeInteger(preferredModelId)) return candidates;
  const selectedIndex = candidates.findIndex((candidate) => candidate.model.id === preferredModelId);
  if (selectedIndex <= 0) return candidates;
  return [candidates[selectedIndex], ...candidates.slice(0, selectedIndex), ...candidates.slice(selectedIndex + 1)];
}


type RouteAssignment = { route_role: string; model_id: number; enabled: boolean };
type RouteEligibleItem = { id: number } | { model: { id: number } };

function routeEligibleModelId(candidate: RouteEligibleItem): number {
  return "model" in candidate ? candidate.model.id : candidate.id;
}

/** A configured route is an allowlist, not merely a preference order. */
export function restrictModelsToAssignedRoute<T extends RouteEligibleItem>(
  candidates: T[],
  assignments: readonly RouteAssignment[],
  role: string,
): T[] {
  const allowedIds = new Set(
    assignments
      .filter((assignment) => assignment.route_role === role && assignment.enabled === true)
      .map((assignment) => assignment.model_id),
  );
  if (allowedIds.size === 0) return [];
  return candidates.filter((candidate) => allowedIds.has(routeEligibleModelId(candidate)));
}


export type ModelCapabilityEvidence = {
  model_id: number;
  capability_key: string;
  vendor_claim_status: "unknown" | "supported" | "unsupported";
  provider_test_status: "not_tested" | "passed" | "failed";
  suly_test_status: "not_tested" | "passed" | "failed";
};

const EVIDENCE_KEY_BY_REQUIRED_CAPABILITY: Readonly<Record<string, string>> = {
  chat: "text",
  vision: "vision",
  audio: "audio_input",
  pdf: "pdf_input",
  word: "file_input",
  video: "video_input",
  tools: "function_calling",
};

/**
 * Evidence is a conservative deny-list layered over the legacy capability flags.
 * Missing/unknown evidence keeps the old routing behavior; explicit upstream
 * negatives or failed probes block only the affected capability. A successful
 * SULY integration test is authoritative for a gateway-specific alias.
 */
export function hasCapabilityEvidenceConflict(
  modelId: number,
  requiredCapabilities: readonly string[],
  evidenceRows: readonly ModelCapabilityEvidence[],
): boolean {
  for (const requiredCapability of requiredCapabilities) {
    const evidenceKey = EVIDENCE_KEY_BY_REQUIRED_CAPABILITY[requiredCapability];
    if (!evidenceKey) continue;
    const evidence = evidenceRows.find(
      (row) => row.model_id === modelId && row.capability_key === evidenceKey,
    );
    if (!evidence) continue;
    if (evidence.suly_test_status === "passed") continue;
    if (evidence.provider_test_status === "failed" || evidence.suly_test_status === "failed") {
      return true;
    }
    if (evidence.vendor_claim_status === "unsupported" && evidence.provider_test_status !== "passed") {
      return true;
    }
  }
  return false;
}
