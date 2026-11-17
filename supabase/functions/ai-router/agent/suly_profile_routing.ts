export type SulyTier = "free" | "lite" | "pro" | "max" | "ultra_team";
export type SulyProfileKey = "lite" | "pro" | "max" | "x";
export type SulyIntent = "chat" | "simple_task" | "complex_task";

export interface SulyProfileResolution {
  profileKey: SulyProfileKey;
  mode: "auto" | "manual";
  allowed: boolean;
}

/**
 * Model quality selection is independent from subscription packages.
 * The subscription controls wallet allowances and product limits only.
 * Actual model usage is charged by the authoritative server-side usage ledger.
 */
export function resolveSulyProfileKey(input: {
  requestedProfileKey?: string | null;
  userTier: string;
  intent: SulyIntent;
}): SulyProfileResolution {
  const requested = input.requestedProfileKey;
  if (requested === "lite" || requested === "pro" || requested === "max" || requested === "x") {
    return { profileKey: requested, mode: "manual", allowed: true };
  }
  const profileKey: SulyProfileKey = input.intent === "complex_task" ? "max" : "lite";
  return { profileKey, mode: "auto", allowed: true };
}
