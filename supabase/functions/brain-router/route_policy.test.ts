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

Deno.test("legacy synchronous Brain routing is retired for every user mode", () => {
  if (shouldLoadLegacyBrainTiers("run", false) || shouldLoadLegacyBrainTiers(undefined, false)) {
    throw new Error("legacy synchronous requests must not load a second Brain model catalog");
  }
});
