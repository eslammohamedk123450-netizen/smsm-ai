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
