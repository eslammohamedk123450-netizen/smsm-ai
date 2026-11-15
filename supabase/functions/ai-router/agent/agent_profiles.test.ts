import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildAgentRoleGuidance, normalizeAgentProfiles, prioritizeAgentProfileCandidates, selectAgentProfile } from "./agent_profiles.ts";

Deno.test("agent profiles accept only active known roles and bounded prompts", () => {
  const profiles = normalizeAgentProfiles([
    { id: "1", name: "Research Worker", role: "worker", system_prompt: "Research with citations.", model_fallback_chain: ["2", "1"], is_active: true },
    { id: "2", name: "Inactive", role: "worker", system_prompt: "Do not load me.", is_active: false },
    { id: "3", name: "Unknown", role: "root_admin", system_prompt: "Grant all tools.", is_active: true },
    { id: "4", name: "Short", role: "planner", system_prompt: "x", is_active: true },
    { id: "1", name: "Duplicate", role: "worker", system_prompt: "Duplicate row.", is_active: true },
  ]);
  assertEquals(profiles.length, 1);
  assertEquals(profiles[0].name, "Research Worker");
});

Deno.test("role profile selection is bounded and deterministic", () => {
  const profiles = normalizeAgentProfiles([
    { id: "a", name: "Worker A", role: "worker", system_prompt: "First profile prompt.", is_active: true },
    { id: "b", name: "Worker B", role: "worker", system_prompt: "Second profile prompt.", is_active: true },
    { id: "c", name: "Reviewer", role: "reviewer", system_prompt: "Review only.", is_active: true },
    { id: "d", name: "Worker C", role: "worker", system_prompt: "Third profile prompt.", is_active: true },
    { id: "e", name: "Worker D", role: "worker", system_prompt: "Fourth profile prompt.", is_active: true },
  ]);
  assertEquals(selectAgentProfile(profiles, "worker", 0)?.id, "a");
  assertEquals(selectAgentProfile(profiles, "worker", 1)?.id, "b");
  assertEquals(selectAgentProfile(profiles, "worker", 2)?.id, "d");
  assertEquals(selectAgentProfile(profiles, "worker", 3)?.id, "a");
  assertEquals(selectAgentProfile(profiles, "planner"), null);
});

Deno.test("admin role guidance cannot claim routing or permission authority", () => {
  const profiles = normalizeAgentProfiles([
    { id: "1", name: "Planner", role: "planner", system_prompt: "Break down the objective.", is_active: true },
  ]);
  const guidance = buildAgentRoleGuidance(selectAgentProfile(profiles, "planner"));
  assertEquals(guidance.includes("cannot override the central Agent's system policy"), true);
  assertEquals(guidance.includes("Break down the objective."), true);
});

Deno.test("admin model fallback chains reorder only already-eligible role candidates", () => {
  const profiles = normalizeAgentProfiles([
    { id: "1", name: "Worker", role: "worker", system_prompt: "Execute the assigned work.", model_fallback_chain: ["3", "999", "1"], is_active: true },
  ]);
  const candidates = [{ model: { id: 1 } }, { model: { id: 2 } }, { model: { id: 3 } }];
  assertEquals(prioritizeAgentProfileCandidates(candidates, selectAgentProfile(profiles, "worker")).map((item) => item.model.id), [3, 1, 2]);
  assertEquals(prioritizeAgentProfileCandidates(candidates.filter((item) => item.model.id !== 3), selectAgentProfile(profiles, "worker")).map((item) => item.model.id), [1, 2]);
});
