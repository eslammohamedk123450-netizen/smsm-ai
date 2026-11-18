export function resolveRoutingMode(input: {
  requestedMode: unknown;
  hasExplicitModel: boolean;
}): "auto" | "manual" {
  // Manual mode is meaningful only when a concrete model ID accompanies it.
  // Older/stale clients can send "manual" after the selected model was cleared;
  // route those requests through the central automatic allowlist instead of
  // failing before any provider is attempted.
  if (input.requestedMode === "manual") {
    return input.hasExplicitModel ? "manual" : "auto";
  }
  // An explicit model remains a manual request for legacy clients that omit
  // routing_mode. Explicit "auto" always wins and keeps central routing.
  return input.hasExplicitModel && input.requestedMode !== "auto" ? "manual" : "auto";
}
