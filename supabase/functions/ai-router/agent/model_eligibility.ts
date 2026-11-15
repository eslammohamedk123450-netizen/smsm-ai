import { supportsModelCapabilities, type ModelCapability } from "../../_shared/model_capabilities.ts";

export type ModelTaskRole = "chat" | "planner" | "worker" | "reviewer" | "summarizer";
export type ModelRoutingGroup = "free_race" | "paid_fallback" | "disabled";

export interface ModelEligibilityInput {
  enabled: boolean;
  healthy: boolean;
  providerEnabled?: boolean;
  allowedTiers: readonly string[];
  userTier: string;
  capabilities: unknown;
  requiredCapabilities: readonly ModelCapability[];
  taskRoles?: readonly string[] | null;
  requiredRole?: ModelTaskRole;
  routingGroup: ModelRoutingGroup;
  allowedRoutingGroups?: readonly ModelRoutingGroup[];
}

/**
 * Canonical, side-effect-free eligibility policy for model selection.
 * Priority and preferred-model settings must only rank models after this check.
 */
export function isModelEligibleForRequest(input: ModelEligibilityInput): boolean {
  if (!input.enabled || !input.healthy || input.providerEnabled === false) return false;
  if (input.routingGroup === "disabled") return false;
  if (input.allowedRoutingGroups && !input.allowedRoutingGroups.includes(input.routingGroup)) return false;
  const tierRank: Record<string, number> = { free: 0, lite: 1, pro: 2, max: 3 };
  const userTierRank = tierRank[input.userTier];
  const hasTierAccess = userTierRank === undefined
    ? input.allowedTiers.includes(input.userTier)
    : input.allowedTiers.some((tier) => tierRank[tier] !== undefined && tierRank[tier] <= userTierRank);
  if (!hasTierAccess) return false;
  if (!supportsModelCapabilities(input.capabilities, input.requiredCapabilities)) return false;
  if (input.requiredRole && !modelSupportsRole(input.taskRoles, input.requiredRole)) return false;
  return true;
}

/** Empty role configuration retains the legacy "general" behavior. */
export function modelSupportsRole(
  taskRoles: readonly string[] | null | undefined,
  role: ModelTaskRole,
): boolean {
  const roles = taskRoles && taskRoles.length > 0 ? taskRoles : ["general"];
  if (roles.includes("general")) return true;
  if (role === "worker") return roles.includes("worker") || roles.includes("executor");
  return roles.includes(role);
}
