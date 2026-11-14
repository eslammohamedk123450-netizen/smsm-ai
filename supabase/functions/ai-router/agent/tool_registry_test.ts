import { getAgentToolRegistry, getRegisteredTool, validateToolInput } from "./tool_registry.ts";

Deno.test("tool registry exposes explicit read/write effects and approval policy", () => {
  const tools = getAgentToolRegistry();
  const read = tools.find((tool) => tool.name === "connected_app.read");
  const write = tools.find((tool) => tool.name === "connected_app.write");
  if (!read || read.effect !== "read" || read.requiresApproval) throw new Error("Read tool policy is invalid");
  if (!write || write.effect !== "write" || !write.requiresApproval) throw new Error("Write tool policy is invalid");
});

Deno.test("tool registry rejects unknown or malformed inputs", () => {
  const tool = getRegisteredTool("connected_app.read");
  if (!tool) throw new Error("Missing registered read tool");
  if (validateToolInput(tool, {})) throw new Error("Missing required toolkit should be rejected");
  if (!validateToolInput(tool, { toolkit: "gmail" })) throw new Error("Valid toolkit should be accepted");
  if (validateToolInput(tool, { toolkit: "gmail", extra: true })) throw new Error("Unknown input should be rejected");
});
