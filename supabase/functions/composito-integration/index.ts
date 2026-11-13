import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  COMPOSIO_TOOLKITS,
  createComposioConnectLink,
  listComposioAccounts,
  parseComposioToolkit,
  publicAccountSummary,
  readComposioApiKey,
  runComposioReadOnlyTask,
} from "../_shared/composio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Authentication required." }, 401);

  let body: JsonRecord;
  try { body = asRecord(await req.json()); } catch { return jsonResponse({ error: "Invalid JSON body." }, 400); }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    const apiKey = await readComposioApiKey(supabase);

    if (action === "status") {
      const accounts = await listComposioAccounts(apiKey, user.id);
      const byToolkit: Record<string, JsonRecord | null> = {};
      for (const key of Object.keys(COMPOSIO_TOOLKITS) as (keyof typeof COMPOSIO_TOOLKITS)[]) {
        const match = accounts
          .filter((account) => asRecord(account.toolkit).slug === COMPOSIO_TOOLKITS[key].slug)
          .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0] ?? null;
        byToolkit[key] = match ? { ...publicAccountSummary(match), connected: match.status === "ACTIVE" && match.is_disabled !== true } : { connected: false };
      }
      return jsonResponse({ action, user_id: user.id, toolkits: byToolkit });
    }

    if (action === "connect") {
      const toolkit = parseComposioToolkit(body.toolkit);
      if (!toolkit) return jsonResponse({ error: "Unsupported toolkit." }, 422);
      const link = await createComposioConnectLink(apiKey, toolkit, user.id);
      return jsonResponse({ action, toolkit, redirect_url: link.redirectUrl, connected_account_id: link.connectedAccountId });
    }

    if (action === "read") {
      const toolkit = parseComposioToolkit(body.toolkit);
      if (!toolkit) return jsonResponse({ error: "Unsupported toolkit." }, 422);
      const task = typeof body.task === "string" ? body.task.trim() : "";
      if (task.length < 3 || task.length > 1500) return jsonResponse({ error: "A task description between 3 and 1500 characters is required." }, 422);
      const outcome = await runComposioReadOnlyTask(apiKey, user.id, toolkit, task);
      if ("unavailable" in outcome) {
        return jsonResponse({ action, toolkit, available: false, reason: outcome.unavailable });
      }
      return jsonResponse({ action, toolkit, available: true, tool_slug: outcome.toolSlug, data: outcome.result });
    }

    return jsonResponse({ error: "Unsupported action." }, 422);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error("composito-integration failed:", message);
    return jsonResponse({ error: "The connected-apps service could not complete this request." }, 502);
  }
});
