export type SulyTier = "free" | "lite" | "pro" | "max" | "ultra_team";
export type SulyProfileKey = "free" | "lite" | "pro" | "max" | "ultra_team";
export type SulyIntent = "chat" | "simple_task" | "complex_task";

const TIER_RANK: Record<SulyTier, number> = { free: 0, lite: 1, pro: 2, max: 3, ultra_team: 4 };
const PROFILE_MINIMUM_TIER: Record<SulyProfileKey, SulyTier> = {
  free: "free",
  lite: "lite",
  pro: "pro",
  max: "max",
  ultra_team: "ultra_team",
};

/** Enforce the minimum subscription tier configured on the active profile row. */
export function isSubscriptionTierEligible(userTier: string, minimumSubscriptionTier: string): boolean {
  const userRank = TIER_RANK[userTier as SulyTier];
  const minimumRank = TIER_RANK[minimumSubscriptionTier as SulyTier];
  return Number.isInteger(userRank) && Number.isInteger(minimumRank) && userRank >= minimumRank;
}

export interface SulyProfileResolution {
  profileKey: SulyProfileKey;
  mode: "auto" | "manual";
  allowed: boolean;
}

/**
 * Free is a distinct model profile and never inherits paid Lite.
 * Auto uses the lowest appropriate profile for lightweight work and the
 * subscriber's highest profile for complex work. Manual selection is honored
 * as requested but never silently downgraded.
 */
export function resolveSulyProfileKey(input: {
  requestedProfileKey?: string | null;
  userTier: string;
  intent: SulyIntent;
}): SulyProfileResolution {
  const tier: SulyTier = input.userTier in TIER_RANK
    ? input.userTier as SulyTier
    : "free";
  const requested = input.requestedProfileKey;
  if (requested === "free" || requested === "lite" || requested === "pro" || requested === "max" || requested === "ultra_team") {
    return {
      profileKey: requested,
      mode: "manual",
      allowed: TIER_RANK[tier] >= TIER_RANK[PROFILE_MINIMUM_TIER[requested]],
    };
  }

  const profileKey: SulyProfileKey = input.intent === "complex_task"
    ? tier
    : tier === "free" ? "free" : "lite";
  return { profileKey, mode: "auto", allowed: true };
}
