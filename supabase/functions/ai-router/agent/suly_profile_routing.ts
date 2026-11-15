export type SulyTier = "free" | "lite" | "pro" | "max";
export type SulyProfileKey = "lite" | "pro" | "max";
export type SulyIntent = "chat" | "simple_task" | "complex_task";

const TIER_RANK: Record<SulyTier, number> = { free: 0, lite: 1, pro: 2, max: 3 };
const PROFILE_MINIMUM_TIER: Record<SulyProfileKey, SulyTier> = {
  lite: "free",
  pro: "pro",
  max: "max",
};

export interface SulyProfileResolution {
  profileKey: SulyProfileKey;
  mode: "auto" | "manual";
  allowed: boolean;
}

/**
 * Auto is advisory routing: it selects the lowest profile that matches the
 * task's complexity and the user's subscription. Manual selection is honored
 * as requested and is never silently downgraded.
 */
export function resolveSulyProfileKey(input: {
  requestedProfileKey?: string | null;
  userTier: string;
  intent: SulyIntent;
}): SulyProfileResolution {
  const tier: SulyTier = input.userTier === "max" || input.userTier === "pro" || input.userTier === "lite"
    ? input.userTier
    : "free";
  const requested = input.requestedProfileKey;
  if (requested === "lite" || requested === "pro" || requested === "max") {
    return {
      profileKey: requested,
      mode: "manual",
      allowed: TIER_RANK[tier] >= TIER_RANK[PROFILE_MINIMUM_TIER[requested]],
    };
  }

  const profileKey: SulyProfileKey = input.intent === "complex_task"
    ? tier === "max" ? "max" : tier === "pro" ? "pro" : "lite"
    : "lite";
  return { profileKey, mode: "auto", allowed: true };
}
