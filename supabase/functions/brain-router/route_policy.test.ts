import { shouldLoadLegacyBrainTiers } from "./route_policy.ts";

Deno.test("queued Brain intake does not require the legacy Brain model catalog", () => {
  if (shouldLoadLegacyBrainTiers("enqueue", false)) {
    throw new Error("queued intake must use the central AI Router catalog");
  }
});

Deno.test("internal Brain workers do not require the legacy Brain model catalog", () => {
  if (shouldLoadLegacyBrainTiers("run", true)) {
    throw new Error("internal worker must use the central AI Router catalog");
  }
});

Deno.test("legacy synchronous Brain compatibility still reads its configured tier catalog", () => {
  if (!shouldLoadLegacyBrainTiers("run", false)) {
    throw new Error("legacy synchronous compatibility path must remain available");
  }
  if (!shouldLoadLegacyBrainTiers(undefined, false)) {
    throw new Error("legacy requests without a mode must remain backward compatible");
  }
});
