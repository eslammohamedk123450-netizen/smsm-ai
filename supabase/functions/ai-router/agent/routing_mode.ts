export function resolveRoutingMode(input: {
  requestedMode: unknown;
  hasExplicitModel: boolean;
}): "auto" | "manual" {
  return input.requestedMode === "manual"
    || (input.hasExplicitModel && input.requestedMode !== "auto")
    ? "manual"
    : "auto";
}
