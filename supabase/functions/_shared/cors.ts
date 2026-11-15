const DEFAULT_WEB_ORIGIN = "https://eslammohamedk123450-netizen.github.io";
const DEFAULT_ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type, cache-control, x-suly-internal-brain-key, x-suly-health-check-secret";
const DEFAULT_ALLOWED_METHODS = "POST, OPTIONS";

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.origin !== value.trim()) return null;
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Exact-origin CORS for the published web app and explicitly configured preview domains. */
export function corsHeadersForRequest(
  req: Request,
  configuredOriginsRaw = "",
  allowedMethods = DEFAULT_ALLOWED_METHODS,
): Record<string, string> {
  const requestOrigin = req.headers.get("origin")?.trim() ?? "";
  const configuredOrigins = configuredOriginsRaw.split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
  const allowed = requestOrigin === DEFAULT_WEB_ORIGIN
    || configuredOrigins.includes(requestOrigin)
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);

  return {
    ...(allowed && requestOrigin ? { "Access-Control-Allow-Origin": requestOrigin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": allowedMethods,
    "Access-Control-Max-Age": "86400",
  };
}

export function handleCorsPreflight(
  req: Request,
  configuredOriginsRaw = "",
  allowedMethods = DEFAULT_ALLOWED_METHODS,
): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, {
    status: 204,
    headers: corsHeadersForRequest(req, configuredOriginsRaw, allowedMethods),
  });
}

/** Adds strict CORS headers to a response without changing its body or status. */
export function withCors(
  req: Request,
  response: Response,
  configuredOriginsRaw = "",
  allowedMethods = DEFAULT_ALLOWED_METHODS,
): Response {
  const headers = new Headers(response.headers);
  headers.delete("Access-Control-Allow-Origin");
  for (const [key, value] of Object.entries(corsHeadersForRequest(req, configuredOriginsRaw, allowedMethods))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Backward-compatible non-origin-specific defaults; callers should use the
// request-aware helpers above rather than a hard-coded placeholder origin.
export const corsHeaders = {
  "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Vary": "Origin",
};

export function handleCorsRequest(req: Request): Response | null {
  return handleCorsPreflight(req, Deno.env.get("WEB_CORS_ORIGIN") ?? "");
}
