export type RequestedRoutingMode = "auto" | "manual" | undefined;

export function resolveRoutingMode(input: {
  requestedMode: RequestedRoutingMode;
  hasExplicitModel: boolean;
}): "auto" | "manual" {
  return input.requestedMode === "manual"
    || (input.hasExplicitModel && input.requestedMode !== "auto")
    ? "manual"
    : "auto";
}
