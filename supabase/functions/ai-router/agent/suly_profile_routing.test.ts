import { resolveSulyProfileKey } from "./suly_profile_routing.ts";

Deno.test("automatic model selection chooses Lite for chat and Max for complex work regardless of plan", () => {
  for (const userTier of ["free", "lite", "pro", "max", "ultra_team", "unknown"]) {
    const chat = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier, intent: "chat" });
    const complex = resolveSulyProfileKey({ requestedProfileKey: "auto", userTier, intent: "complex_task" });
    if (chat.profileKey !== "lite" || !chat.allowed) throw new Error(`Chat profile incorrectly depends on plan ${userTier}.`);
    if (complex.profileKey !== "max" || !complex.allowed) throw new Error(`Complex profile incorrectly depends on plan ${userTier}.`);
  }
});

Deno.test("manual Lite, Pro, Max and X selections are independent of subscription", () => {
  for (const profileKey of ["lite", "pro", "max", "x"]) {
    for (const userTier of ["free", "lite", "pro", "max", "ultra_team"]) {
      const result = resolveSulyProfileKey({ requestedProfileKey: profileKey, userTier, intent: "chat" });
      if (result.profileKey !== profileKey || result.mode !== "manual" || !result.allowed) {
        throw new Error(`Plan ${userTier} incorrectly blocked model profile ${profileKey}.`);
      }
    }
  }
});

Deno.test("unknown model profile falls back to automatic routing, not a plan restriction", () => {
  const result = resolveSulyProfileKey({ requestedProfileKey: "legacy-free", userTier: "free", intent: "chat" });
  if (result.profileKey !== "lite" || result.mode !== "auto" || !result.allowed) {
    throw new Error("Legacy profile key should safely fall back to Lite auto routing.");
  }
});
