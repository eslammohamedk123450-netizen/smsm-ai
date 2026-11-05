import { executeTool, toToolResultMessage } from "./executor.ts";

export async function agentLoop(
  initialMessages: any[],
  callLLM: (msgs: any[], useTools?: boolean) => Promise<any>,
  maxIter = 5,
): Promise<any> {
  const messages = [...initialMessages];
  let final: any = null;

  for (let i = 0; i < maxIter; i++) {
    const msg = await callLLM(messages, i < maxIter - 1);
    if (!msg) throw new Error("No LLM response");
    messages.push(msg);

    const calls = msg.tool_calls;
    if (!calls || calls.length === 0) {
      final = msg;
      break;
    }

    for (const tc of calls) {
      let args: any = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch { args = {}; }
      const result = await executeTool(tc.function.name, args);
      messages.push(toToolResultMessage(tc.id, result));
    }

    if (i === maxIter - 1) {
      final = messages[messages.length - 1];
    }
  }

  return final ?? messages[messages.length - 1];
}
