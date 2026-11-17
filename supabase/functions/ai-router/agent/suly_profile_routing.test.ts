import { isSubscriptionTierEligible, resolveSulyProfileKey } from "./suly_profile_routing.ts";

Deno.test("auto uses Free for free users and Lite for paid subscribers on lightweight chat", () => {
  const free = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "free", intent: "chat" });
  const pro = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "pro", intent: "chat" });
  if (free.profileKey !== "free" || free.mode !== "auto" || !free.allowed) throw new Error("Free users must stay on the Free profile.");
  if (pro.profileKey !== "lite" || pro.mode !== "auto" || !pro.allowed) throw new Error("Paid chat should use the economical Lite profile by default.");
});

Deno.test("auto uses the highest entitled profile for complex work", () => {
  const free = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "free", intent: "complex_task" });
  const lite = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "lite", intent: "complex_task" });
  const pro = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "pro", intent: "complex_task" });
  const max = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "max", intent: "complex_task" });
  const team = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "ultra_team", intent: "complex_task" });
  if (free.profileKey !== "free" || lite.profileKey !== "lite" || pro.profileKey !== "pro" || max.profileKey !== "max" || team.profileKey !== "ultra_team") {
    throw new Error("Auto complexity routing did not respect the user's subscription tier.");
  }
});

Deno.test("manual profile selection is never silently downgraded", () => {
  const result = resolveSulyProfileKey({ requestedProfileKey: "pro", userTier: "pro", intent: "chat" });
  if (result.profileKey !== "pro" || result.mode !== "manual" || !result.allowed) throw new Error("Manual Pro selection must remain Pro.");
});

Deno.test("Free cannot manually select paid Lite, while Pro retains the existing Max-profile entitlement", () => {
  const freeLite = resolveSulyProfileKey({ requestedProfileKey: "lite", userTier: "free", intent: "chat" });
  const proMax = resolveSulyProfileKey({ requestedProfileKey: "max", userTier: "pro", intent: "complex_task" });
  if (freeLite.allowed || !proMax.allowed) throw new Error("Manual selection must respect the configured profile minimum tier.");
});

Deno.test("Ultra Team is the highest tier and inherits all lower profile access", () => {
  if (!isSubscriptionTierEligible("ultra_team", "max")) throw new Error("Ultra Team should inherit Max access.");
  if (!isSubscriptionTierEligible("ultra_team", "pro")) throw new Error("Ultra Team should inherit Pro access.");
  if (!isSubscriptionTierEligible("ultra_team", "lite")) throw new Error("Ultra Team should inherit Lite access.");
  if (!isSubscriptionTierEligible("ultra_team", "free")) throw new Error("Ultra Team should inherit Free access.");
  if (!isSubscriptionTierEligible("free", "free")) throw new Error("Free should access the Free profile.");
  if (isSubscriptionTierEligible("free", "lite")) throw new Error("Free must not access paid Lite.");
  const proMax = resolveSulyProfileKey({ requestedProfileKey: "max", userTier: "pro", intent: "complex_task" });
  if (!proMax.allowed) throw new Error("Pro retains access to the Max profile under the existing entitlement policy.");
  if (isSubscriptionTierEligible("unknown", "free")) throw new Error("Unknown user tiers must fail closed.");
  if (isSubscriptionTierEligible("max", "unknown")) throw new Error("Unknown profile tiers must fail closed.");
});
