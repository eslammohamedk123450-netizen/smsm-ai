import { isModelEligibleForRequest, modelSupportsRole } from "./model_eligibility.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const base = {
  enabled: true,
  healthy: true,
  providerEnabled: true,
  allowedTiers: ["free", "pro"],
  userTier: "pro",
  capabilities: { chat: true, read: true, vision: true, tools: true },
  requiredCapabilities: ["chat"] as const,
  taskRoles: ["general"],
  routingGroup: "free_race" as const,
};

Deno.test("eligible model passes only when all access and capability constraints pass", () => {
  assert(isModelEligibleForRequest(base), "eligible model should pass");
  assert(!isModelEligibleForRequest({ ...base, enabled: false }), "disabled model must fail");
  assert(!isModelEligibleForRequest({ ...base, healthy: false }), "unhealthy model must fail");
  assert(!isModelEligibleForRequest({ ...base, providerEnabled: false }), "disabled provider must fail");
  assert(!isModelEligibleForRequest({ ...base, userTier: "free", allowedTiers: ["pro"] }), "plan-ineligible model must fail");
  assert(!isModelEligibleForRequest({ ...base, requiredCapabilities: ["vision", "audio"] }), "missing capability must fail");
  assert(!isModelEligibleForRequest({ ...base, routingGroup: "disabled" }), "disabled routing group must fail");
});

Deno.test("higher subscription tiers inherit access to lower-tier models", () => {
  assert(isModelEligibleForRequest({ ...base, userTier: "max", allowedTiers: ["pro"] }), "Max should be able to use a Pro-eligible model");
  assert(isModelEligibleForRequest({ ...base, userTier: "max", allowedTiers: ["lite"] }), "Max should be able to use a Lite-eligible model");
  assert(isModelEligibleForRequest({ ...base, userTier: "pro", allowedTiers: ["lite"] }), "Pro should be able to use a Lite-eligible model");
  assert(!isModelEligibleForRequest({ ...base, userTier: "pro", allowedTiers: ["max"] }), "Pro must not access a Max-only model");
  assert(!isModelEligibleForRequest({ ...base, userTier: "free", allowedTiers: ["pro"] }), "Free must not access a Pro-only model");
});

Deno.test("Ultra Team inherits every lower model tier while Free remains isolated", () => {
  assert(isModelEligibleForRequest({ ...base, userTier: "ultra_team", allowedTiers: ["max"] }), "Ultra Team should inherit Max-eligible models");
  assert(isModelEligibleForRequest({ ...base, userTier: "ultra_team", allowedTiers: ["pro"] }), "Ultra Team should inherit Pro-eligible models");
  assert(isModelEligibleForRequest({ ...base, userTier: "ultra_team", allowedTiers: ["lite"] }), "Ultra Team should inherit Lite-eligible models");
  assert(isModelEligibleForRequest({ ...base, userTier: "ultra_team", allowedTiers: ["free"] }), "Ultra Team should inherit Free-eligible models");
  assert(!isModelEligibleForRequest({ ...base, userTier: "free", allowedTiers: ["lite"] }), "Free must not access Lite-only models");
});

Deno.test("role eligibility preserves general and worker/executor compatibility", () => {
  assert(modelSupportsRole(undefined, "planner"), "missing role config retains legacy general role");
  assert(modelSupportsRole(["general"], "reviewer"), "general role supports all task roles");
  assert(modelSupportsRole(["executor"], "worker"), "executor remains a worker-compatible role");
  assert(!modelSupportsRole(["planner"], "worker"), "planner-only model cannot act as worker");
  assert(isModelEligibleForRequest({ ...base, taskRoles: ["planner"], requiredRole: "planner" }), "matching role should pass");
  assert(!isModelEligibleForRequest({ ...base, taskRoles: ["planner"], requiredRole: "reviewer" }), "wrong role should fail");
});

Deno.test("routing allowlist restricts eligible model pools without changing model priority", () => {
  assert(isModelEligibleForRequest({ ...base, routingGroup: "paid_fallback", allowedRoutingGroups: ["paid_fallback"] }), "allowed fallback group should pass");
  assert(!isModelEligibleForRequest({ ...base, routingGroup: "paid_fallback", allowedRoutingGroups: ["free_race"] }), "unlisted routing group should fail");
});
