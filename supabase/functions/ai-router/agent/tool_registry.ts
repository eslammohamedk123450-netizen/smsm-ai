import type { AgentTool, AgentToolEffect } from "./orchestrator.ts";

export type RegisteredTool = AgentTool & {
  provider: "composio" | "tavily" | "internal";
  effect: AgentToolEffect;
  inputSchema: Record<string, unknown>;
  requiredCapabilities: string[];
  requiresApproval: boolean;
};

const registry: RegisteredTool[] = [
  {
    name: "connected_app.status",
    description: "التحقق من حالة اتصال التطبيقات للمستخدم.",
    provider: "composio",
    effect: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    requiredCapabilities: ["tools"],
    requiresApproval: false,
    available: true,
  },
  {
    name: "connected_app.read",
    description: "قراءة بيانات من موصل واحد نشط عبر أداة آمنة.",
    provider: "composio",
    effect: "read",
    inputSchema: { type: "object", required: ["toolkit"], properties: { toolkit: { type: "string" } }, additionalProperties: false },
    requiredCapabilities: ["tools", "read"],
    requiresApproval: false,
    available: true,
  },
  {
    name: "connected_app.read_multiple",
    description: "قراءة فقط من موصلات ذكرها المستخدم صراحة.",
    provider: "composio",
    effect: "read",
    inputSchema: { type: "object", required: ["toolkits"], properties: { toolkits: { type: "array", items: { type: "string" } } }, additionalProperties: false },
    requiredCapabilities: ["tools", "read"],
    requiresApproval: false,
    available: true,
  },
  {
    name: "connected_app.write",
    description: "إرسال أو إنشاء أو تعديل عبر موصل واحد بعد موافقة صريحة.",
    provider: "composio",
    effect: "write",
    inputSchema: { type: "object", required: ["toolkit"], properties: { toolkit: { type: "string" } }, additionalProperties: false },
    requiredCapabilities: ["tools", "write"],
    requiresApproval: true,
    available: true,
  },
  {
    name: "web.search",
    description: "بحث حي في الويب عند طلب معلومة حديثة.",
    provider: "tavily",
    effect: "read",
    inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string", minLength: 1, maxLength: 2000 } }, additionalProperties: false },
    requiredCapabilities: ["web_search"],
    requiresApproval: false,
    available: true,
  },
];

export function getAgentToolRegistry(): RegisteredTool[] {
  return registry.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema }, requiredCapabilities: [...tool.requiredCapabilities] }));
}

export function getAgentTools(availability: Partial<Record<string, boolean>> = {}): AgentTool[] {
  return getAgentToolRegistry().map((tool) => ({
    name: tool.name,
    description: tool.description,
    effect: tool.effect,
    available: availability[tool.name] ?? tool.available,
    inputSchema: tool.inputSchema,
    requiresApproval: tool.requiresApproval,
  }));
}

export async function getAgentToolsFromDatabase(
  supabase: any,
  availability: Partial<Record<string, boolean>> = {},
): Promise<AgentTool[]> {
  const { data, error } = await supabase.from("agent_tool_registry").select("name,enabled");
  if (error) throw new Error("agent_tool_registry_unavailable");
  const enabledByName = new Map<string, boolean>();
  for (const row of (data ?? []) as Array<{ name?: unknown; enabled?: unknown }>) {
    if (typeof row.name === "string" && typeof row.enabled === "boolean") enabledByName.set(row.name, row.enabled);
  }
  // Database rows can enable/disable known adapters, but cannot grant new
  // execution code, downgrade write effects, or bypass approval requirements.
  return getAgentToolRegistry().map((tool) => ({
    name: tool.name,
    description: tool.description,
    effect: tool.effect,
    available: (enabledByName.get(tool.name) ?? false) && (availability[tool.name] ?? tool.available),
    inputSchema: tool.inputSchema,
    requiresApproval: tool.requiresApproval,
  }));
}

export function getRegisteredTool(name: string): RegisteredTool | null {
  return getAgentToolRegistry().find((tool) => tool.name === name) ?? null;
}

function validateSchemaValue(value: unknown, schemaValue: unknown, depth = 0): boolean {
  if (!schemaValue || typeof schemaValue !== "object" || Array.isArray(schemaValue) || depth > 8) return false;
  const schema = schemaValue as Record<string, unknown>;
  const type = schema.type;
  if (type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    const properties = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? schema.properties as Record<string, unknown> : {};
    const required = Array.isArray(schema.required) ? schema.required : [];
    if (required.some((key) => typeof key !== "string" || record[key] === undefined)) return false;
    if (schema.additionalProperties === false && Object.keys(record).some((key) => !(key in properties))) return false;
    return Object.entries(record).every(([key, child]) => key in properties ? validateSchemaValue(child, properties[key], depth + 1) : schema.additionalProperties !== false);
  }
  if (type === "string") {
    if (typeof value !== "string") return false;
    if (typeof schema.minLength === "number" && value.length < schema.minLength) return false;
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) return false;
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
    if (typeof schema.pattern === "string") {
      try { if (!new RegExp(schema.pattern).test(value)) return false; } catch { return false; }
    }
    return true;
  }
  if (type === "array") {
    if (!Array.isArray(value)) return false;
    if (typeof schema.minItems === "number" && value.length < schema.minItems) return false;
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return false;
    return schema.items === undefined || value.every((item) => validateSchemaValue(item, schema.items, depth + 1));
  }
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  return false;
}

export function validateToolInput(tool: RegisteredTool, input: Record<string, unknown>): boolean {
  return validateSchemaValue(input, tool.inputSchema);
}
