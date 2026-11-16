import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { extractBearerToken } from "./auth.ts";

const webOrigin = Deno.env.get("WEB_CORS_ORIGIN") ?? "";

function json(req: Request, body: unknown, status = 200): Response {
  return withCors(req, new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  }), webOrigin);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req, webOrigin);
  if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(req, { error: "Server configuration is incomplete" }, 500);

  const userJwt = extractBearerToken(req.headers.get("Authorization"));
  if (!userJwt) return json(req, { error: "Authentication required" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(userJwt);
  if (authError || !authData.user) return json(req, { error: "Invalid or expired session" }, 401);

  const { data: isAdmin, error: adminError } = await userClient.rpc("suly_is_admin");
  if (adminError || isAdmin !== true) return json(req, { error: "Administrator access required" }, 403);

  let body: Record<string, unknown>;
  try { body = asRecord(await req.json()); } catch { return json(req, { error: "Invalid JSON body" }, 400); }
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (body.action === "list_buckets") {
      const { data, error } = await service.storage.listBuckets();
      if (error) return json(req, { error: "Storage bucket inventory is unavailable" }, 503);
      return json(req, {
        buckets: (data ?? []).map((bucket) => ({
          id: bucket.id,
          name: bucket.name,
          public: bucket.public,
          file_size_limit: bucket.file_size_limit ?? null,
          allowed_mime_types: bucket.allowed_mime_types ?? null,
          created_at: bucket.created_at ?? null,
          updated_at: bucket.updated_at ?? null,
        })),
      });
    }

    if (body.action === "list_objects") {
      const bucketId = typeof body.bucket_id === "string" ? body.bucket_id.trim() : "";
      const path = typeof body.path === "string" ? body.path.trim() : "";
      if (!bucketId || bucketId.length > 100 || path.length > 1024 || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => part === "." || part === "..")) {
        return json(req, { error: "Invalid bucket or storage path" }, 400);
      }
      const { data: bucket, error: bucketError } = await service.storage.getBucket(bucketId);
      if (bucketError || !bucket) return json(req, { error: "Storage bucket not found" }, 404);
      const { data, error } = await service.storage.from(bucketId).list(path, {
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) return json(req, { error: "Storage objects could not be listed" }, 503);
      return json(req, {
        bucket: { id: bucket.id, name: bucket.name, public: bucket.public },
        objects: (data ?? []).map((item) => ({
          name: item.name,
          id: item.id ?? null,
          updated_at: item.updated_at ?? null,
          created_at: item.created_at ?? null,
          metadata: item.metadata ? {
            size: typeof item.metadata.size === "number" ? item.metadata.size : null,
            mimetype: typeof item.metadata.mimetype === "string" ? item.metadata.mimetype : null,
          } : null,
        })),
      });
    }

    return json(req, { error: "Unsupported storage action" }, 400);
  } catch {
    return json(req, { error: "Storage request failed" }, 500);
  }
}

Deno.serve(main);
