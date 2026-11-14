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

export function getRegisteredTool(name: string): RegisteredTool | null {
  return getAgentToolRegistry().find((tool) => tool.name === name) ?? null;
}

export function validateToolInput(tool: RegisteredTool, input: Record<string, unknown>): boolean {
  const schema = tool.inputSchema;
  const required = Array.isArray(schema.required) ? schema.required : [];
  if (required.some((key) => typeof key !== "string" || input[key] === undefined)) return false;
  if (schema.additionalProperties === false) {
    const properties = schema.properties && typeof schema.properties === "object" ? Object.keys(schema.properties as Record<string, unknown>) : [];
    if (Object.keys(input).some((key) => !properties.includes(key))) return false;
  }
  return true;
}
