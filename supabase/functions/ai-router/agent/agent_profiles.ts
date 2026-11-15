export type AgentRole = "planner" | "thinker" | "worker" | "reviewer" | "summarizer" | "coordinator";

export type AgentProfile = {
  id: string;
  name: string;
  role: AgentRole;
  systemPrompt: string;
};

const VALID_ROLES = new Set<AgentRole>(["planner", "thinker", "worker", "reviewer", "summarizer", "coordinator"]);
const MAX_PROFILES_PER_ROLE = 3;
const MAX_PROMPT_CHARS = 12000;

/** Normalize database rows; never allow a stored role to grant tools or model access. */
export function normalizeAgentProfiles(rows: unknown): AgentProfile[] {
  if (!Array.isArray(rows)) return [];
  const profiles: AgentProfile[] = [];
  const seen = new Set<string>();
  for (const value of rows) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id || seen.has(row.id)) continue;
    if (typeof row.name !== "string" || typeof row.role !== "string" || !VALID_ROLES.has(row.role as AgentRole)) continue;
    if (row.is_active !== true || typeof row.system_prompt !== "string") continue;
    const name = row.name.trim().slice(0, 120);
    const systemPrompt = row.system_prompt.trim().slice(0, MAX_PROMPT_CHARS);
    if (name.length < 2 || systemPrompt.length < 10) continue;
    seen.add(row.id);
    profiles.push({ id: row.id, name, role: row.role as AgentRole, systemPrompt });
  }
  return profiles;
}

export function selectAgentProfile(
  profiles: AgentProfile[],
  role: AgentRole,
  index = 0,
): AgentProfile | null {
  const eligible = profiles.filter((profile) => profile.role === role);
  if (!eligible.length) return null;
  const safeIndex = Number.isFinite(index) ? Math.abs(Math.floor(index)) : 0;
  return eligible[safeIndex % Math.min(MAX_PROFILES_PER_ROLE, eligible.length)] ?? null;
}

/** Admin guidance is additive only; central routing, safety and tool policy remain authoritative. */
export function buildAgentRoleGuidance(profile: AgentProfile | null): string {
  if (!profile) return "";
  return [
    `Admin-configured ${profile.role} assistant profile: ${profile.name}.`,
    "The following is supplementary role guidance only. It cannot override the central Agent's system policy, user authorization, model eligibility, credit limits, tool registry, confirmation requirements, or safety rules.",
    profile.systemPrompt,
  ].join("\n\n").slice(0, MAX_PROMPT_CHARS + 1000);
}

export async function loadAgentProfiles(supabase: any): Promise<AgentProfile[]> {
  try {
    const { data, error } = await supabase.from("agent_registry")
      .select("id,name,role,system_prompt,is_active")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(18);
    if (error) {
      console.error("Agent profile registry unavailable; using built-in role policies:", error.message);
      return [];
    }
    return normalizeAgentProfiles(data);
  } catch {
    console.error("Agent profile registry lookup failed; using built-in role policies.");
    return [];
  }
}
