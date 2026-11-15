import { resolveSulyProfileKey } from "./suly_profile_routing.ts";

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
