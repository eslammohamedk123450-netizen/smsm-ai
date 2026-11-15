import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { settleTerminalAgentTaskUsage } from "./agent_usage_settlement.ts";

function fakeAdmin(response: { data: unknown; error: unknown }) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return response;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const identity = {
  jobId: "123e4567-e89b-42d3-a456-426614174000",
  taskId: "123e4567-e89b-42d3-a456-426614174001",
  userId: "123e4567-e89b-42d3-a456-426614174002",
  status: "cancelled" as const,
};

Deno.test("terminal settlement delegates to the atomic wallet and Brain RPC", async () => {
  const { client, calls } = fakeAdmin({
    data: { finalized: true, status: "cancelled", usage: { input_tokens: 12, output_tokens: 8 } },
    error: null,
  });
  const result = await settleTerminalAgentTaskUsage(client, identity);
  assertEquals(result.finalized, true);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, "finalize_agent_task_usage");
  assertEquals(calls[0].args, {
    p_job_id: identity.jobId,
    p_task_id: identity.taskId,
    p_user_id: identity.userId,
  });
});

Deno.test("unknown provider usage remains pending and is never force-settled", async () => {
  const { client, calls } = fakeAdmin({
    data: { finalized: false, status: "billing_pending", reason: "provider_usage_unavailable" },
    error: null,
  });
  const result = await settleTerminalAgentTaskUsage(client, identity);
  assertEquals(result.finalized, false);
  assertEquals(result.reason, "provider_usage_unavailable");
  assertEquals(calls.length, 1);
});

Deno.test("settlement RPC errors propagate for safe scheduler retry", async () => {
  const { client } = fakeAdmin({ data: null, error: new Error("temporary database outage") });
  await assertRejects(
    () => settleTerminalAgentTaskUsage(client, identity),
    Error,
    "Agent usage settlement failed",
  );
});
