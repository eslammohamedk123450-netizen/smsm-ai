import { isSubscriptionTierEligible, resolveSulyProfileKey } from "./suly_profile_routing.ts";

Deno.test("auto uses Lite for lightweight chat even when a higher plan is available", () => {
  const result = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "pro", intent: "chat" });
  if (result.profileKey !== "lite" || result.mode !== "auto" || !result.allowed) throw new Error("Auto chat should use Lite.");
});

Deno.test("auto uses the highest subscribed profile for complex work", () => {
  const pro = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "pro", intent: "complex_task" });
  const max = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "max", intent: "complex_task" });
  const free = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier: "free", intent: "complex_task" });
  if (pro.profileKey !== "pro" || max.profileKey !== "max" || free.profileKey !== "lite") throw new Error("Auto complexity routing did not respect subscription.");
});

Deno.test("manual profile selection is never silently downgraded for a simple request", () => {
  const result = resolveSulyProfileKey({ requestedProfileKey: "pro", userTier: "pro", intent: "chat" });
  if (result.profileKey !== "pro" || result.mode !== "manual" || !result.allowed) throw new Error("Manual Pro selection must remain Pro.");
});

Deno.test("manual selection above subscription entitlement is rejected, not downgraded", () => {
  const result = resolveSulyProfileKey({ requestedProfileKey: "max", userTier: "pro", intent: "complex_task" });
  if (result.profileKey !== "max" || result.mode !== "manual" || result.allowed) throw new Error("Unavailable Max selection must be rejected.");
});

Deno.test("configured profile minimum tier is enforced from the database value", () => {
  if (!isSubscriptionTierEligible("free", "free")) throw new Error("Free should access a free minimum profile.");
  if (!isSubscriptionTierEligible("pro", "lite")) throw new Error("Pro should inherit Lite access.");
  if (!isSubscriptionTierEligible("max", "pro")) throw new Error("Max should inherit Pro access.");
  if (isSubscriptionTierEligible("pro", "max")) throw new Error("Pro must not access a Max-only profile.");
  if (isSubscriptionTierEligible("unknown", "free")) throw new Error("Unknown user tiers must fail closed.");
  if (isSubscriptionTierEligible("max", "unknown")) throw new Error("Unknown profile tiers must fail closed.");
});
