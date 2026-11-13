export const COMPOSIO_TOOLKITS = {
  gmail: { slug: "gmail", label: "Gmail", displayName: "Gmail" },
  googledrive: { slug: "googledrive", label: "Google Drive", displayName: "Google Drive" },
  github: { slug: "github", label: "GitHub", displayName: "GitHub" },
} as const;

export type ComposioToolkitKey = keyof typeof COMPOSIO_TOOLKITS;

const COMPOSIO_API = "https://backend.composio.dev/api";
const TOOLKIT_KEYS = Object.keys(COMPOSIO_TOOLKITS) as ComposioToolkitKey[];

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

export function parseComposioToolkit(value: unknown): ComposioToolkitKey | null {
  if (typeof value !== "string") return null;
  return TOOLKIT_KEYS.includes(value.trim().toLowerCase() as ComposioToolkitKey)
    ? value.trim().toLowerCase() as ComposioToolkitKey
    : null;
}

function apiUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`${COMPOSIO_API}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

async function composioRequest(apiKey: string, path: string, init: RequestInit = {}, params?: Record<string, string>): Promise<JsonRecord> {
  const response = await fetch(apiUrl(path, params), {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Do not propagate upstream response bodies: they may contain provider data.
    throw new Error(`Composio returned HTTP ${response.status}.`);
  }
  const body: unknown = await response.json();
  return asRecord(body);
}

export async function readComposioApiKey(supabase: { rpc: Function }): Promise<string> {
  const { data, error } = await supabase.rpc("suly_service_get_composio_api_key");
  if (error || typeof data !== "string" || data.trim().length === 0) {
    throw new Error("Composio is not configured on the server.");
  }
  return data.trim();
}

async function listAuthConfigs(apiKey: string, toolkit: ComposioToolkitKey): Promise<JsonRecord[]> {
  const body = await composioRequest(apiKey, "/v3.1/auth_configs", {}, {
    toolkit_slugs: COMPOSIO_TOOLKITS[toolkit].slug,
    is_composio_managed: "true",
    limit: "200",
  });
  return Array.isArray(body.items) ? body.items.map(asRecord) : [];
}

export async function getOrCreateManagedAuthConfig(apiKey: string, toolkit: ComposioToolkitKey): Promise<string> {
  const matches = await listAuthConfigs(apiKey, toolkit);
  const selected = matches.find((item) => {
    const toolkitInfo = asRecord(item.toolkit);
    return toolkitInfo.slug === COMPOSIO_TOOLKITS[toolkit].slug
      && item.is_composio_managed === true
      && item.status !== "DISABLED";
  });
  const selectedAuth = asRecord(selected?.auth_config);
  const selectedId = typeof selected?.id === "string" ? selected.id : typeof selectedAuth.id === "string" ? selectedAuth.id : null;
  if (selectedId) return selectedId;

  try {
    const created = await composioRequest(apiKey, "/v3.1/auth_configs", {
      method: "POST",
      body: JSON.stringify({
        toolkit: { slug: COMPOSIO_TOOLKITS[toolkit].slug },
        auth_config: {
          type: "use_composio_managed_auth",
          name: `Suly ${COMPOSIO_TOOLKITS[toolkit].displayName}`,
          credentials: {},
        },
      }),
    });
    const createdAuth = asRecord(created.auth_config);
    const id = typeof createdAuth.id === "string" ? createdAuth.id : typeof created.id === "string" ? created.id : null;
    if (id) return id;
  } catch {
    // A concurrent request may have created the shared managed config. Re-list once.
    const retryMatches = await listAuthConfigs(apiKey, toolkit);
    const retry = retryMatches.find((item) => asRecord(item.toolkit).slug === COMPOSIO_TOOLKITS[toolkit].slug && item.is_composio_managed === true);
    const retryAuth = asRecord(retry?.auth_config);
    const retryId = typeof retry?.id === "string" ? retry.id : typeof retryAuth.id === "string" ? retryAuth.id : null;
    if (retryId) return retryId;
    throw new Error(`Could not prepare the ${COMPOSIO_TOOLKITS[toolkit].displayName} connection.`);
  }
  throw new Error(`Composio did not return a connection configuration for ${COMPOSIO_TOOLKITS[toolkit].displayName}.`);
}

export async function createComposioConnectLink(apiKey: string, toolkit: ComposioToolkitKey, userId: string): Promise<{ redirectUrl: string; connectedAccountId: string | null }> {
  const authConfigId = await getOrCreateManagedAuthConfig(apiKey, toolkit);
  const body = await composioRequest(apiKey, "/v3.1/connected_accounts/link", {
    method: "POST",
    body: JSON.stringify({ auth_config_id: authConfigId, user_id: userId }),
  });
  const redirectUrl = typeof body.redirect_url === "string" ? body.redirect_url : "";
  let parsed: URL;
  try { parsed = new URL(redirectUrl); } catch { throw new Error("Composio returned an invalid connection link."); }
  if (parsed.protocol !== "https:" || !(parsed.hostname === "composio.dev" || parsed.hostname.endsWith(".composio.dev") || parsed.hostname === "composio.com" || parsed.hostname.endsWith(".composio.com"))) {
    throw new Error("Composio returned an unexpected connection-link host.");
  }
  return {
    redirectUrl: parsed.toString(),
    connectedAccountId: typeof body.connected_account_id === "string" ? body.connected_account_id : null,
  };
}

export async function listComposioAccounts(apiKey: string, userId: string, toolkit?: ComposioToolkitKey): Promise<JsonRecord[]> {
  const params: Record<string, string> = { user_ids: userId, limit: "100", order_by: "updated_at", order_direction: "desc" };
  if (toolkit) params.toolkit_slugs = COMPOSIO_TOOLKITS[toolkit].slug;
  const body = await composioRequest(apiKey, "/v3.1/connected_accounts", {}, params);
  return Array.isArray(body.items) ? body.items.map(asRecord) : [];
}

export function publicAccountSummary(account: JsonRecord): JsonRecord {
  const toolkitInfo = asRecord(account.toolkit);
  return {
    id: typeof account.id === "string" ? account.id : null,
    toolkit: typeof toolkitInfo.slug === "string" ? toolkitInfo.slug : null,
    status: typeof account.status === "string" ? account.status : "UNKNOWN",
    is_disabled: account.is_disabled === true,
    created_at: typeof account.created_at === "string" ? account.created_at : null,
    updated_at: typeof account.updated_at === "string" ? account.updated_at : null,
  };
}

export function detectComposioToolkitRequest(text: string): { toolkit: ComposioToolkitKey; intent: "read" | "write" } | null {
  const value = text.toLocaleLowerCase();
  const hasReadRequest = /\b(show|search|find|list|get|read|summari[sz]e|check|review|fetch|open|look up)\b|ابحث|دور|هات|جيب|اعرض|اعرضلي|أظهر|اظهر|اقرأ|لخص|لخّص|راجع|افحص|تحقق|وريني|شوف|استخرج|آخر|اخر/iu.test(value);
  const hasWriteRequest = /\b(send|forward|reply|create|update|edit|delete|remove|write|commit|push|merge|star|unstar|invite|upload|share|move|rename|archive|label|schedule|copy|close|reopen|comment|fork|publish)\b|ابعت|ابعث|أرسل|ارسل|اكتب|انشئ|أنشئ|عدّل|عدل|احذف|امسح|ارفع|شارك|غيّر|غير|انقل|ادمج|حوّل|حول|أرشف|ارشف|انسخ|صنّف|صنف|انشر|اعمل.*(?:issue|رسالة|ملف)|(?:رسالة|بريد|إيميل).*(?:إلى|لـ|لشخص)/iu.test(value);
  const toolkitMentions = [
    /\b(gmail|google mail|inbox|email|e-mail)\b|جيميل|جى ميل|بريدي|البريد|إيميلي|ايميلي|إيميل|ايميل|الايميل|الإيميل|رسائلي/iu.test(value) ? "gmail" : null,
    /\b(google drive|googledrive|drive|my drive)\b|جوجل درايف|غوغل درايف|درايف|ملفاتي على جوجل/iu.test(value) ? "googledrive" : null,
    /\b(github|git hub|repository|repo|pull request|issue)\b|جيت هاب|مستودع(?:ي|ات)?|ريبو|طلبات السحب/iu.test(value) ? "github" : null,
  ].filter((toolkit): toolkit is ComposioToolkitKey => toolkit !== null);
  const toolkit = toolkitMentions.length === 1 ? toolkitMentions[0] : null;
  if (!toolkit || (!hasReadRequest && !hasWriteRequest)) return null;
  return { toolkit, intent: hasWriteRequest ? "write" : "read" };
}

export function isMultiToolkitComposioRequest(text: string): boolean {
  const value = text.toLocaleLowerCase();
  const hasAction = /\b(show|search|find|list|get|read|summari[sz]e|check|review|fetch|open|look up|send|forward|reply|create|update|edit|delete|remove|write|commit|push|merge|star|unstar|invite|upload|share|move|rename|archive|label|schedule|copy|close|reopen|comment|fork|publish)\b|ابحث|دور|هات|جيب|اعرض|اعرضلي|أظهر|اظهر|اقرأ|لخص|لخّص|راجع|افحص|تحقق|وريني|شوف|استخرج|آخر|اخر|ابعت|ابعث|أرسل|ارسل|اكتب|انشئ|أنشئ|عدّل|عدل|احذف|امسح|ارفع|شارك|غيّر|غير|انقل|ادمج|حوّل|حول|أرشف|ارشف|انسخ|صنّف|صنف|انشر/iu.test(value);
  if (!hasAction) return false;
  const mentions = [
    /\b(gmail|google mail|inbox|email|e-mail)\b|جيميل|جى ميل|بريدي|البريد|إيميلي|ايميلي|إيميل|ايميل|الايميل|الإيميل|رسائلي/iu.test(value),
    /\b(google drive|googledrive|drive|my drive)\b|جوجل درايف|غوغل درايف|درايف|ملفاتي على جوجل/iu.test(value),
    /\b(github|git hub|repository|repo|pull request|issue)\b|جيت هاب|مستودع(?:ي|ات)?|ريبو|طلبات السحب/iu.test(value),
  ].filter(Boolean).length;
  return mentions > 1;
}

function hasReadOnlyTag(item: JsonRecord): boolean {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return tags.some((tag) => typeof tag === "string" && tag.toLowerCase().replace(/[_-]/g, "") === "readonlyhint");
}

function hasWriteTag(item: JsonRecord): boolean {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return tags.some((tag) => typeof tag === "string" && ["createhint", "updatehint", "destructivehint"].includes(tag.toLowerCase().replace(/[_-]/g, "")));
}

function safeReadOnlySlug(toolkit: ComposioToolkitKey, slug: unknown): slug is string {
  if (typeof slug !== "string") return false;
  const prefixes: Record<ComposioToolkitKey, RegExp> = {
    gmail: /^GMAIL_(?:GET|LIST|SEARCH|FETCH|FIND|READ|DOWNLOAD)_/i,
    googledrive: /^(?:GOOGLEDRIVE|GOOGLE_DRIVE)_(?:GET|LIST|SEARCH|FETCH|FIND|READ|DOWNLOAD|EXPORT)_/i,
    github: /^GITHUB_(?:GET|LIST|SEARCH|FETCH|FIND|READ|DOWNLOAD)_/i,
  };
  return prefixes[toolkit].test(slug);
}

function safeWriteSlug(toolkit: ComposioToolkitKey, slug: unknown): slug is string {
  if (typeof slug !== "string") return false;
  const prefixes: Record<ComposioToolkitKey, RegExp> = {
    gmail: /^GMAIL_(?:SEND|FORWARD|REPLY|CREATE|UPDATE|DELETE|TRASH|DRAFT|STAR|UNSTAR|ARCHIVE|LABEL|SCHEDULE|MARK)_/i,
    googledrive: /^(?:GOOGLEDRIVE|GOOGLE_DRIVE)_(?:CREATE|UPDATE|DELETE|MOVE|RENAME|UPLOAD|SHARE|COPY|PERMISSION)_/i,
    github: /^GITHUB_(?:CREATE|UPDATE|DELETE|MERGE|STAR|UNSTAR|CLOSE|REOPEN|ADD|REMOVE|COMMENT|EDIT|PUSH|FORK|PUBLISH)_/i,
  };
  return prefixes[toolkit].test(slug);
}

function connectorSearchQuery(toolkit: ComposioToolkitKey, request: string): string {
  const value = request.toLocaleLowerCase();
  if (toolkit === "gmail") {
    const sent = /sent|مبعوث|مبعت|مُرسَل|أرسلت|ارسلت|المُرسلة|المرسلة/iu.test(value);
    const received = /received|inbox|واردة|الواردة|وصلت|استلمت/iu.test(value);
    const latest = /latest|newest|recent|آخر|اخر|الأخيرة|الاخيرة/iu.test(value);
    return `${sent ? "Gmail sent mail" : received ? "Gmail inbox received mail" : "Gmail messages"} ${latest ? "most recent newest first" : "search messages"} sender subject date body content`;
  }
  return `${toolkit} search and read ${request.slice(0, 500)}`;
}

export async function runComposioReadOnlyTask(
  apiKey: string,
  userId: string,
  toolkit: ComposioToolkitKey,
  naturalLanguageTask: string,
): Promise<{ toolSlug: string; result: unknown } | { unavailable: "not_connected" | "no_read_tool" }> {
  const accounts = await listComposioAccounts(apiKey, userId, toolkit);
  const connected = accounts.some((account) => account.status === "ACTIVE" && account.is_disabled !== true);
  if (!connected) return { unavailable: "not_connected" };

  const query = new URLSearchParams({
    toolkit_slug: COMPOSIO_TOOLKITS[toolkit].slug,
    query: connectorSearchQuery(toolkit, naturalLanguageTask),
    toolkit_versions: "latest",
    limit: "20",
  });
  const catalog = await composioRequest(apiKey, `/v3.1/tools?${query.toString()}`);
  const tools = Array.isArray(catalog.items) ? catalog.items.map(asRecord) : [];
  const selected = tools.find((item) => hasReadOnlyTag(item) && safeReadOnlySlug(toolkit, item.slug))
    ?? tools.find((item) => safeReadOnlySlug(toolkit, item.slug));
  if (!selected || typeof selected.slug !== "string") return { unavailable: "no_read_tool" };

  const executed = await composioRequest(apiKey, `/v3.1/tools/execute/${encodeURIComponent(selected.slug)}`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, text: `${connectorSearchQuery(toolkit, naturalLanguageTask)}. Return sender, subject, date, and body content.`, toolkit_versions: "latest" }),
  });
  if (executed.successful === false) throw new Error("The requested connected-app read operation did not complete.");
  return { toolSlug: selected.slug, result: executed.data ?? executed };
}

export async function runComposioWriteTask(
  apiKey: string,
  userId: string,
  toolkit: ComposioToolkitKey,
  naturalLanguageTask: string,
): Promise<{ toolSlug: string; result: unknown } | { unavailable: "not_connected" | "no_write_tool" | "ambiguous_account" }> {
  const accounts = await listComposioAccounts(apiKey, userId, toolkit);
  const activeAccounts = accounts.filter((account) => account.status === "ACTIVE" && account.is_disabled !== true);
  if (activeAccounts.length === 0) return { unavailable: "not_connected" };
  if (activeAccounts.length > 1) return { unavailable: "ambiguous_account" };

  const query = new URLSearchParams({
    toolkit_slug: COMPOSIO_TOOLKITS[toolkit].slug,
    query: naturalLanguageTask.slice(0, 1000),
    toolkit_versions: "latest",
    limit: "20",
  });
  const catalog = await composioRequest(apiKey, `/v3.1/tools?${query.toString()}`);
  const tools = Array.isArray(catalog.items) ? catalog.items.map(asRecord) : [];
  const selected = tools.find((item) => hasWriteTag(item) && safeWriteSlug(toolkit, item.slug));
  if (!selected || typeof selected.slug !== "string") return { unavailable: "no_write_tool" };

  const executed = await composioRequest(apiKey, `/v3.1/tools/execute/${encodeURIComponent(selected.slug)}`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, text: naturalLanguageTask.slice(0, 1500), ...(typeof selected.version === "string" ? { version: selected.version } : {}) }),
  });
  if (executed.successful === false) throw new Error("The requested connected-app write operation did not complete.");
  return { toolSlug: selected.slug, result: executed.data ?? executed };
}
