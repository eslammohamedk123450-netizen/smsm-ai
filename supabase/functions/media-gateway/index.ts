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
const MEDIA_BUCKET = "suly-media";
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
async function deliverySignature(path: string, secret: string): Promise<string> {
  const digest = await sha1(`${path}${secret}`);
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "").slice(0, 8);
}
function cloudinaryPathPart(value: string): string { return value.split("/").map((segment) => encodeURIComponent(segment)).join("/"); }
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
  if (!url || !serviceKey || !anonKey) return json({ error: "إعدادات الخدمة غير مكتملة.", code: "server_configuration" }, 500);
  const userJwt = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!userJwt) return json({ error: "يلزم تسجيل الدخول." }, 401);
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await service.auth.getUser(userJwt);
  if (error || !data.user) return json({ error: "انتهت جلسة الدخول." }, 401);
  const user = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${userJwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: profile, error: profileError }, { data: adminData, error: adminError }] = await Promise.all([
    service.from("suly_profiles").select("is_banned,hims_activated").eq("id", data.user.id).maybeSingle(),
    user.rpc("suly_is_admin"),
  ]);
  if (profileError || adminError) return json({ error: "تعذر التحقق من صلاحيات الحساب." }, 500);
  if (!profile || profile.is_banned) return json({ error: "الحساب غير متاح." }, 403);
  return { userId: data.user.id, service, user, isAdmin: adminData === true };
}
async function verifyUploadContext(ctx: AuthContext, feature: FeatureKey, conversationId: string | null, messageId: string | null, ticketId: string | null): Promise<string | null> {
  if (feature === "chat") {
    if (!conversationId) return "يجب ربط مرفق المحادثة بمحادثة.";
    const { data, error } = await ctx.service.from("suly_conversations").select("id").eq("id", conversationId).eq("user_id", ctx.userId).maybeSingle();
    if (error || !data) return "لا تملك صلاحية الوصول إلى هذه المحادثة.";
    if (messageId) {
      const { data: message, error: messageError } = await ctx.service.from("suly_messages").select("id").eq("id", messageId).eq("conversation_id", conversationId).eq("user_id", ctx.userId).eq("role", "user").maybeSingle();
      if (messageError || !message) return "رسالة المرفق لا تخص هذه المحادثة.";
    }
  } else if (feature === "support") {
    if (!ticketId) return "يجب ربط مرفق الدعم بتذكرة.";
    const { data, error } = await ctx.service.from("suly_support_tickets").select("id,status").eq("id", ticketId).eq("user_id", ctx.userId).maybeSingle();
    if (error || !data || data.status === "closed") return "لا يمكن إرفاق ملف بهذه التذكرة.";
  } else if (!ctx.isAdmin) return "يتطلب هذا الإجراء صلاحية مشرف.";
  return null;
}

async function getDeliveryUrl(ctx: AuthContext, mediaId: string): Promise<{ id: string; url: string; mime_type: string | null } | null> {
  const { data: asset, error } = await ctx.service.from("global_media_assets")
    .select("id,user_id,feature_key,storage_provider,bucket,object_key,public_url,mime_type,metadata,delivery_type,conversation_id,support_ticket_id")
    .eq("id", mediaId).maybeSingle();
  if (error || !asset) return null;
  let authorized = asset.user_id === ctx.userId || ctx.isAdmin;
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
    authorized = profile?.hims_activated === true && Boolean(resource);
  }
  if (!authorized) return null;
  if (asset.storage_provider === "supabase" && asset.delivery_type === "authenticated") {
    const { data, error: signedError } = await ctx.service.storage.from(String(asset.bucket)).createSignedUrl(String(asset.object_key), 3600);
    if (signedError || !data?.signedUrl) return null;
    return { id: asset.id, url: data.signedUrl, mime_type: asset.mime_type };
  }
  // Existing files continue to work during the one-time transition; all new files use the private bucket above.
  if (asset.storage_provider === "cloudinary") {
    const config: CloudinaryConfig | null = await getCloudinaryConfig(ctx.service);
    if (!config) return null;
    if (asset.delivery_type !== "authenticated" && asset.public_url) return { id: asset.id, url: asset.public_url, mime_type: asset.mime_type };
    const resourceType = String(asset.bucket);
    if (!(["image", "video", "raw"] as string[]).includes(resourceType)) return null;
    const metadata = asset.metadata && typeof asset.metadata === "object" ? asset.metadata as Record<string, unknown> : {};
    const version = Number(metadata.version);
    if (!Number.isSafeInteger(version) || version < 1) return null;
    const format = safeString(metadata.format, 16).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const suffix = resourceType === "raw" ? "" : (format ? `.${format}` : "");
    const pathToSign = `v${version}/${asset.object_key}${suffix}`;
    const signature = await deliverySignature(pathToSign, config.apiSecret);
    const url = `https://res.cloudinary.com/${encodeURIComponent(config.cloudName)}/${resourceType}/authenticated/s--${signature}--/v${version}/${cloudinaryPathPart(String(asset.object_key))}${suffix}`;
    return { id: asset.id, url, mime_type: asset.mime_type };
  }
  return null;
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "الطلب غير مدعوم." }, 405);
  const ctx = await authenticate(req);
  if (ctx instanceof Response) return ctx;
  let body: Record<string, unknown>;
  try { const value = await req.json(); body = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  catch { return json({ error: "تعذر قراءة الطلب." }, 400); }
  const action = safeString(body.action, 40);
  if (!["sign_upload", "register", "get_url", "get_urls"].includes(action)) return json({ error: "الطلب غير مدعوم." }, 400);

  if (action === "sign_upload") {
    const feature = body.feature_key;
    const resourceType = body.resource_type;
    const mime = safeString(body.mime_type, 120).toLowerCase();
    const size = Number(body.size_bytes);
    const conversationId = validUuid(body.conversation_id) ? body.conversation_id : null;
    const messageId = validUuid(body.message_id) ? body.message_id : null;
    const ticketId = validUuid(body.support_ticket_id) ? body.support_ticket_id : null;
    if (!validFeature(feature) || !validResourceType(resourceType) || !mimeIsAllowed(mime, resourceType) || !Number.isSafeInteger(size) || size < 1 || size > MAX_UPLOAD_BYTES) return json({ error: "نوع الملف أو حجمه غير مدعوم." }, 400);
    const contextError = await verifyUploadContext(ctx, feature, conversationId, messageId, ticketId);
    if (contextError) return json({ error: contextError }, 403);
    const originalName = safeString(body.original_filename, 300);
    const suffix = originalName.match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]?.toLowerCase() || (resourceType === "image" ? "jpg" : resourceType === "video" ? "mp4" : "bin");
    const objectKey = `${ctx.userId}/${feature}/${crypto.randomUUID()}.${suffix}`;
    const { data, error } = await ctx.service.storage.from(MEDIA_BUCKET).createSignedUploadUrl(objectKey, { upsert: false });
    if (error || !data?.token) {
      console.error("Signed storage upload URL creation failed:", error?.message ?? "unknown");
      return json({ error: "تعذر تجهيز رفع الملف." }, 503);
    }
    return json({ bucket: MEDIA_BUCKET, object_key: objectKey, token: data.token });
  }

  if (action === "register") {
    const feature = body.feature_key;
    const resourceType = body.resource_type;
    const objectKey = safeString(body.object_key, 1024);
    const mime = safeString(body.mime_type, 120).toLowerCase();
    const conversationId = validUuid(body.conversation_id) ? body.conversation_id : null;
    const messageId = validUuid(body.message_id) ? body.message_id : null;
    const ticketId = validUuid(body.support_ticket_id) ? body.support_ticket_id : null;
    if (!validFeature(feature) || !validResourceType(resourceType) || !mimeIsAllowed(mime, resourceType) || !objectKey.startsWith(`${ctx.userId}/${feature}/`)) return json({ error: "تعذر التحقق من الملف." }, 400);
    const contextError = await verifyUploadContext(ctx, feature, conversationId, messageId, ticketId);
    if (contextError) return json({ error: contextError }, 403);
    const parts = objectKey.split("/");
    const filename = parts.pop() ?? "";
    const folder = parts.join("/");
    if (!filename || parts.length !== 2 || parts[0] !== ctx.userId || parts[1] !== feature) return json({ error: "مسار الملف غير صالح." }, 400);
    const { data: files, error: listError } = await ctx.service.storage.from(MEDIA_BUCKET).list(folder, { limit: 100, search: filename });
    if (listError) {
      console.error("Uploaded object lookup failed:", listError.message);
      return json({ error: "تعذر التحقق من الملف المحفوظ." }, 404);
    }
    const stored = (files ?? []).find((entry) => entry.name === filename);
    const bytes = Number(stored?.metadata?.size ?? 0);
    if (!stored || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_UPLOAD_BYTES) return json({ error: "الملف غير موجود أو حجمه غير مسموح." }, 413);
    const storedMime = safeString(stored.metadata?.mimetype ?? stored.metadata?.contentType, 120).toLowerCase();
    if (storedMime && storedMime !== mime) return json({ error: "نوع الملف لا يطابق الملف المحفوظ." }, 415);
    const metadata = { kind: resourceType, width: null, height: null, duration_seconds: null };
    const { data: asset, error: insertError } = await ctx.service.from("global_media_assets").insert({
      user_id: ctx.userId,
      feature_key: feature,
      storage_provider: "supabase",
      bucket: MEDIA_BUCKET,
      object_key: objectKey,
      public_url: null,
      mime_type: mime,
      size_bytes: bytes,
      original_filename: safeString(body.original_filename, 300) || filename,
      metadata,
      delivery_type: "authenticated",
      conversation_id: conversationId,
      message_id: messageId,
      support_ticket_id: ticketId,
    }).select("id").single();
    if (insertError || !asset?.id) {
      console.error("Media registration failed:", insertError?.message ?? "unknown");
      return json({ error: "تعذر حفظ الملف في المكتبة." }, 500);
    }
    const delivery = await getDeliveryUrl(ctx, String(asset.id));
    return delivery ? json({ success: true, id: asset.id, mime_type: mime, size_bytes: bytes, url: delivery.url }) : json({ error: "تم حفظ الملف لكن تعذر تجهيزه للعرض." }, 500);
  }

  if (action === "get_url") {
    const id = validUuid(body.media_id) ? body.media_id : "";
    if (!id) return json({ error: "معرّف الملف غير صالح." }, 400);
    const delivery = await getDeliveryUrl(ctx, id);
    return delivery ? json({ success: true, ...delivery }) : json({ error: "الملف غير موجود أو لا تملك صلاحية الوصول إليه." }, 404);
  }
  const ids = Array.isArray(body.media_ids) ? body.media_ids.filter(validUuid).slice(0, 100) : [];
  if (!ids.length) return json({ success: true, assets: [] });
  const results = await Promise.all(ids.map((id) => getDeliveryUrl(ctx, id)));
  return json({ success: true, assets: results.filter((item): item is NonNullable<typeof item> => Boolean(item)) });
}
Deno.serve(async (req) => {
  try { return await handle(req); }
  catch (error) {
    console.error("Unhandled media gateway error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "حدث خطأ أثناء التعامل مع الملف." }, 500);
  }
});
