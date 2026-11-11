import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCloudinaryConfig, type CloudinaryConfig } from "../_shared/cloudinary_config.ts";

const corsOrigin = Deno.env.get("WEB_CORS_ORIGIN")?.trim();
const corsHeaders = {
  ...(corsOrigin ? { "Access-Control-Allow-Origin": corsOrigin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const encoder = new TextEncoder();

type FeatureKey = "chat" | "support" | "hims" | "general";
type ResourceType = "image" | "video" | "raw";
interface AuthContext { userId: string; service: SupabaseClient; user: SupabaseClient; isAdmin: boolean; }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function safeString(value: unknown, max = 300): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function validResourceType(value: unknown): value is ResourceType { return value === "image" || value === "video" || value === "raw"; }
function validFeature(value: unknown): value is FeatureKey { return value === "chat" || value === "support" || value === "hims" || value === "general"; }
function hex(bytes: Uint8Array): string { return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function sha1(value: string): Promise<Uint8Array> { return new Uint8Array(await crypto.subtle.digest("SHA-1", encoder.encode(value))); }
async function uploadSignature(fields: Record<string, string>, secret: string): Promise<string> {
  const serialized = Object.entries(fields).filter(([, value]) => value !== "").sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
  return hex(await sha1(`${serialized}${secret}`));
}
function cloudinaryPathPart(value: string): string { return value.split("/").map((segment) => encodeURIComponent(segment)).join("/"); }
async function deliverySignature(path: string, secret: string): Promise<string> {
  const digest = await sha1(`${path}${secret}`);
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "").slice(0, 8);
}
function mimeIsAllowed(mime: string, resourceType: ResourceType): boolean {
  const value = mime.split(";")[0].trim().toLowerCase();
  if (!value || value === "application/x-msdownload" || value === "application/x-executable" || value === "text/html" || value === "image/svg+xml") return false;
  if (resourceType === "image") return ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif"].includes(value);
  if (resourceType === "video") return ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"].includes(value);
  return ["application/pdf", "application/json", "application/zip", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain", "text/csv", "audio/mpeg", "audio/mp4", "audio/wav", "application/octet-stream"].includes(value);
}
async function authenticate(req: Request): Promise<AuthContext | Response> {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Supabase function configuration is incomplete.", code: "server_configuration" }, 500);
  const userJwt = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!userJwt) return json({ error: "Authentication required." }, 401);
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await service.auth.getUser(userJwt);
  if (error || !data.user) return json({ error: "Invalid or expired session." }, 401);
  const user = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: profile, error: profileError }, { data: adminData, error: adminError }] = await Promise.all([
    service.from("suly_profiles").select("is_banned,hims_activated").eq("id", data.user.id).maybeSingle(),
    user.rpc("suly_is_admin"),
  ]);
  if (profileError || adminError) return json({ error: "Could not validate account permissions." }, 500);
  if (!profile || profile.is_banned) return json({ error: "This account is unavailable." }, 403);
  return { userId: data.user.id, service, user, isAdmin: adminData === true };
}
async function verifyUploadContext(ctx: AuthContext, feature: FeatureKey, conversationId: string | null, messageId: string | null, ticketId: string | null): Promise<string | null> {
  if (feature === "chat") {
    if (!conversationId) return "A chat attachment must be linked to a conversation.";
    const { data, error } = await ctx.service.from("suly_conversations").select("id").eq("id", conversationId).eq("user_id", ctx.userId).maybeSingle();
    if (error || !data) return "You do not have access to that conversation.";
    if (messageId) {
      const { data: message, error: messageError } = await ctx.service.from("suly_messages").select("id").eq("id", messageId).eq("conversation_id", conversationId).eq("user_id", ctx.userId).eq("role", "user").maybeSingle();
      if (messageError || !message) return "The attachment message does not belong to this conversation.";
    }
  } else if (feature === "support") {
    if (!ticketId) return "A support attachment must be linked to a ticket.";
    const { data, error } = await ctx.service.from("suly_support_tickets").select("id,status").eq("id", ticketId).eq("user_id", ctx.userId).maybeSingle();
    if (error || !data || data.status === "closed") return "You cannot attach a file to that support ticket.";
  } else if (!ctx.isAdmin) {
    return "Administrator access is required for this media library.";
  }
  return null;
}
async function verifyCloudinaryAsset(config: CloudinaryConfig, resourceType: ResourceType, publicId: string): Promise<Record<string, unknown> | null> {
  const path = publicId.split("/").map((part) => encodeURIComponent(part)).join("/");
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/resources/${resourceType}/authenticated/${path}`;
  const response = await fetch(endpoint, { headers: { Authorization: `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`cloudinary_admin_${response.status}`);
  const data = await response.json();
  return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
}
async function buildDeliveryUrl(config: CloudinaryConfig, resourceType: ResourceType, publicId: string, versionValue: unknown, formatValue: unknown): Promise<string | null> {
  const version = Number(versionValue);
  if (!Number.isSafeInteger(version) || version < 1) return null;
  const format = safeString(formatValue, 16).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const suffix = resourceType === "raw" ? "" : (format ? `.${format}` : "");
  const pathToSign = `v${version}/${publicId}${suffix}`;
  const signature = await deliverySignature(pathToSign, config.apiSecret);
  return `https://res.cloudinary.com/${encodeURIComponent(config.cloudName)}/${resourceType}/authenticated/s--${signature}--/v${version}/${cloudinaryPathPart(publicId)}${suffix}`;
}
async function getDeliveryUrl(ctx: AuthContext, config: CloudinaryConfig, mediaId: string): Promise<{ id: string; url: string; mime_type: string | null } | null> {
  const { data: asset, error } = await ctx.service.from("global_media_assets")
    .select("id,user_id,feature_key,storage_provider,bucket,object_key,public_url,mime_type,metadata,delivery_type,conversation_id,support_ticket_id")
    .eq("id", mediaId).maybeSingle();
  if (error || !asset) return null;
  const ownsAsset = asset.user_id === ctx.userId;
  let authorized = ownsAsset || ctx.isAdmin;
  if (!authorized && asset.conversation_id) {
    const { data } = await ctx.service.from("suly_conversations").select("id").eq("id", asset.conversation_id).eq("user_id", ctx.userId).maybeSingle();
    authorized = Boolean(data);
  }
  if (!authorized && asset.support_ticket_id) {
    const { data } = await ctx.service.from("suly_support_tickets").select("id").eq("id", asset.support_ticket_id).eq("user_id", ctx.userId).maybeSingle();
    authorized = Boolean(data);
  }
  if (!authorized && asset.feature_key === "hims") {
    const { data: profile } = await ctx.service.from("suly_profiles").select("hims_activated").eq("id", ctx.userId).maybeSingle();
    const { data: resource } = await ctx.service.from("suly_feature_resources").select("id").eq("media_asset_id", asset.id).eq("feature_key", "hims").eq("is_active", true).maybeSingle();
    authorized = ctx.isAdmin || (profile?.hims_activated === true && Boolean(resource));
  }
  if (!authorized || asset.storage_provider !== "cloudinary") return null;
  if (asset.delivery_type !== "authenticated" && asset.public_url) return { id: asset.id, url: asset.public_url, mime_type: asset.mime_type };
  const resourceType = asset.bucket as ResourceType;
  if (!validResourceType(resourceType)) return null;
  const metadata = asset.metadata && typeof asset.metadata === "object" ? asset.metadata as Record<string, unknown> : {};
  const url = await buildDeliveryUrl(config, resourceType, String(asset.object_key), metadata.version, metadata.format);
  return url ? { id: asset.id, url, mime_type: asset.mime_type } : null;
}
async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;
  let body: Record<string, unknown>;
  try {
    const value = await req.json();
    body = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return json({ error: "Invalid JSON request." }, 400); }
  const action = safeString(body.action, 40);
  if (!["sign_upload", "register", "get_url", "get_urls"].includes(action)) return json({ error: "Unsupported action." }, 400);
  const config = await getCloudinaryConfig(ctx.service);
  if (!config) return json({ error: "Cloudinary server credentials are not configured.", code: "cloudinary_not_configured" }, 503);

  if (action === "sign_upload") {
    const feature = body.feature_key;
    const resourceType = body.resource_type;
    const mime = safeString(body.mime_type, 120).toLowerCase();
    const size = Number(body.size_bytes);
    const conversationId = validUuid(body.conversation_id) ? body.conversation_id : null;
    const messageId = validUuid(body.message_id) ? body.message_id : null;
    const ticketId = validUuid(body.support_ticket_id) ? body.support_ticket_id : null;
    if (!validFeature(feature) || !validResourceType(resourceType) || !mimeIsAllowed(mime, resourceType) || !Number.isSafeInteger(size) || size < 1 || size > MAX_UPLOAD_BYTES) {
      return json({ error: "The file type or size is not supported." }, 400);
    }
    const contextError = await verifyUploadContext(ctx, feature, conversationId, messageId, ticketId);
    if (contextError) return json({ error: contextError }, 403);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const publicId = `suly/${ctx.userId}/${feature}/${crypto.randomUUID()}`;
    const fields = { overwrite: "false", public_id: publicId, timestamp, type: "authenticated" };
    const signature = await uploadSignature(fields, config.apiSecret);
    return json({ cloud_name: config.cloudName, api_key: config.apiKey, resource_type: resourceType, signed_fields: { ...fields, signature } });
  }

  if (action === "register") {
    const feature = body.feature_key;
    const resourceType = body.resource_type;
    const publicId = safeString(body.public_id, 1024);
    const conversationId = validUuid(body.conversation_id) ? body.conversation_id : null;
    const messageId = validUuid(body.message_id) ? body.message_id : null;
    const ticketId = validUuid(body.support_ticket_id) ? body.support_ticket_id : null;
    if (!validFeature(feature) || !validResourceType(resourceType) || !publicId.startsWith(`suly/${ctx.userId}/`)) return json({ error: "Invalid Cloudinary asset details." }, 400);
    const contextError = await verifyUploadContext(ctx, feature, conversationId, messageId, ticketId);
    if (contextError) return json({ error: contextError }, 403);
    let resource: Record<string, unknown> | null;
    try { resource = await verifyCloudinaryAsset(config, resourceType, publicId); }
    catch (error) { console.error("Cloudinary asset verification failed:", error instanceof Error ? error.message : "unknown"); return json({ error: "Cloudinary could not verify the uploaded asset." }, 502); }
    if (!resource || String(resource.public_id ?? "") !== publicId) return json({ error: "The uploaded Cloudinary asset was not found." }, 404);
    const bytes = Number(resource.bytes);
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_UPLOAD_BYTES) return json({ error: "The uploaded asset exceeds the permitted size." }, 413);
    const mime = safeString(body.mime_type, 120).toLowerCase();
    if (!mimeIsAllowed(mime, resourceType)) return json({ error: "The file type is not permitted." }, 415);
    const { data: assetId, error: registerError } = await ctx.user.rpc("suly_media_register_self_v2", {
      p_feature_key: feature,
      p_resource_type: resourceType,
      p_object_key: publicId,
      p_mime_type: mime,
      p_size_bytes: bytes,
      p_original_filename: safeString(body.original_filename, 300),
      p_metadata: {
        version: Number(resource.version),
        format: safeString(resource.format, 16),
        kind: resourceType,
        width: Number.isFinite(Number(resource.width)) ? Number(resource.width) : null,
        height: Number.isFinite(Number(resource.height)) ? Number(resource.height) : null,
        duration_seconds: Number.isFinite(Number(resource.duration)) ? Number(resource.duration) : null,
        delivery_type: "authenticated",
        cloudinary_asset_id: safeString(resource.asset_id, 80),
      },
      p_conversation_id: conversationId,
      p_message_id: messageId,
      p_support_ticket_id: ticketId,
    });
    if (registerError || typeof assetId !== "string") {
      console.error("Cloudinary media registration failed:", registerError?.message ?? "unknown");
      return json({ error: "The uploaded file could not be registered in the media library." }, 500);
    }
    const delivery = await getDeliveryUrl(ctx, config, assetId);
    return json({ success: true, id: assetId, public_id: publicId, resource_type: resourceType, mime_type: mime, size_bytes: bytes, url: delivery?.url ?? null });
  }

  if (action === "get_url") {
    const id = validUuid(body.media_id) ? body.media_id : "";
    if (!id) return json({ error: "Invalid media ID." }, 400);
    const delivery = await getDeliveryUrl(ctx, config, id);
    return delivery ? json({ success: true, ...delivery }) : json({ error: "Media not found or access denied." }, 404);
  }
  const ids = Array.isArray(body.media_ids) ? body.media_ids.filter(validUuid).slice(0, 100) : [];
  if (!ids.length) return json({ success: true, assets: [] });
  const results = await Promise.all(ids.map((id) => getDeliveryUrl(ctx, config, id)));
  return json({ success: true, assets: results.filter((item): item is NonNullable<typeof item> => Boolean(item)) });
}
Deno.serve(async (req) => {
  try { return await handle(req); }
  catch (error) {
    console.error("Unhandled media gateway error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Internal media gateway error." }, 500);
  }
});
