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

/** A configured route is an allowlist, not merely a preference order. */
export function restrictModelsToAssignedRoute<T extends ModelCandidate>(
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
  return candidates.filter((candidate) => allowedIds.has(candidate.model.id));
}
