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
