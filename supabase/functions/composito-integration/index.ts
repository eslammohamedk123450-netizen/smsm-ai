import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  COMPOSIO_TOOLKITS,
  createComposioConnectLink,
  disconnectComposioAccount,
  isComposioAccountActive,
  listComposioAccounts,
  parseComposioToolkit,
  publicAccountSummary,
  readComposioApiKey,
  runComposioReadOnlyTask,
  detectComposioToolkitRequest,
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const userJwt = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Server database configuration is incomplete." }, 500);
  if (!userJwt) return jsonResponse({ error: "Authentication required." }, 401);

  // Use service_role for the server-only Vault RPC, but validate the caller's
  // access token explicitly so the function remains user-scoped.
  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(userJwt);
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
          .filter((account) => String(asRecord(account.toolkit).slug ?? account.appName ?? "").toLowerCase() === COMPOSIO_TOOLKITS[key].slug)
          .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0] ?? null;
        byToolkit[key] = match ? { ...publicAccountSummary(match), connected: isComposioAccountActive(match) } : { connected: false };
      }
      return jsonResponse({ action, user_id: user.id, service_ready: true, toolkits: byToolkit });
    }

    if (action === "preflight") {
      const task = typeof body.task === "string" ? body.task.trim() : "";
      if (!task || task.length > 50000) return jsonResponse({ error: "A task description of 1 to 50000 characters is required." }, 422);
      const request = detectComposioToolkitRequest(task);
      if (!request) return jsonResponse({ action, required: false });
      const accounts = await listComposioAccounts(apiKey, user.id, request.toolkit);
      const account = accounts
        .sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0] ?? null;
      const accountExists = Boolean(account);
      const disabled = account?.is_disabled === true;
      const connected = account ? isComposioAccountActive(account) : false;
      return jsonResponse({
        action,
        required: true,
        toolkit: request.toolkit,
        intent: request.intent,
        connected,
        account_exists: accountExists,
        disabled,
        status: account && typeof account.status === "string" ? account.status : null,
      });
    }

    if (action === "connect") {
      const toolkit = parseComposioToolkit(body.toolkit);
      if (!toolkit) return jsonResponse({ error: "Unsupported toolkit." }, 422);
      const link = await createComposioConnectLink(apiKey, toolkit, user.id);
      return jsonResponse({ action, toolkit, redirect_url: link.redirectUrl, connected_account_id: link.connectedAccountId });
    }

    if (action === "disconnect") {
      const toolkit = parseComposioToolkit(body.toolkit);
      const accountId = typeof body.account_id === "string" ? body.account_id.trim() : "";
      if (!toolkit) return jsonResponse({ error: "Unsupported toolkit." }, 422);
      if (!accountId || accountId.length > 200) return jsonResponse({ error: "A valid connected account ID is required." }, 422);
      await disconnectComposioAccount(apiKey, user.id, toolkit, accountId);
      // Verify the provider no longer reports this account as active before
      // telling the client that disconnect completed. This prevents a stale
      // or partially accepted revoke from looking like a successful logout.
      const remainingAccounts = await listComposioAccounts(apiKey, user.id, toolkit);
      const remaining = remainingAccounts.find((account) => account.id === accountId);
      if (remaining?.status === "ACTIVE" && remaining.is_disabled !== true) {
        return jsonResponse({
          error: "The provider still reports this connected account as active. Refresh the integrations page and try again.",
          error_code: "disconnect_not_confirmed",
        }, 502);
      }
      return jsonResponse({ action, toolkit, disconnected: true });
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
    // composio.ts deliberately never includes upstream response bodies, so its
    // operational messages are safe to return and let the client distinguish
    // configuration, account-state, and provider failures.
    const safeMessage = message.length <= 240 ? message : "The connected-apps service could not complete this request.";
    return jsonResponse({ error: safeMessage, error_code: "integration_operation_failed" }, 502);
  }
});
