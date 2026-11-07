// Global media gateway.
//
// Single entry point for every upload in the application (chat attachments,
// HIMS lectures, future features). Responsibilities:
//   1. authenticate the caller and reject suspended accounts,
//   2. validate size and content type,
//   3. stream bytes to the configured external store (Cloudflare R2),
//   4. record only metadata + public URL in Supabase.
// Supabase Storage is intentionally unused: the database stores links, not files.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  R2StorageDriver,
  StorageNotConfiguredError,
  StorageUploadError,
  readR2Config,
  resolveStorageDriver,
  type StorageDriver,
} from "../_shared/storage_strategy.ts";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  buildObjectKey,
  checkUploadSize,
  isAllowedMimeType,
  isSafeObjectKey,
} from "../_shared/storage_keys.ts";
import { normalizeFeatureKey } from "../_shared/prompt_keys.ts";

const configuredCorsOrigin = Deno.env.get("WEB_CORS_ORIGIN")?.trim();
const corsHeaders = {
  ...(configuredCorsOrigin ? { "Access-Control-Allow-Origin": configuredCorsOrigin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function maxUploadBytes(): number {
  const configured = Number(Deno.env.get("MEDIA_MAX_UPLOAD_BYTES"));
  if (Number.isFinite(configured) && configured > 0) return Math.min(Math.floor(configured), 200 * 1024 * 1024);
  return DEFAULT_MAX_UPLOAD_BYTES;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into an ArrayBuffer-backed view: WebCrypto rejects wider buffer types.
  const source = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  source.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", source);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface UploadRequest {
  featureKey: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  metadata: Record<string, unknown>;
}

async function readUpload(req: Request, limit: number): Promise<{ ok: true; value: UploadRequest } | { ok: false; error: string; status: number }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { ok: false, error: "تعذر قراءة بيانات النموذج المرسل.", status: 400 };
    }
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, error: "لم يُرفق أي ملف في الطلب.", status: 400 };
    if (file.size > limit) return { ok: false, error: "حجم الملف يتجاوز الحد المسموح.", status: 413 };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const metadataRaw = form.get("metadata");
    let metadata: Record<string, unknown> = {};
    if (typeof metadataRaw === "string" && metadataRaw.trim()) {
      try {
        const parsed = JSON.parse(metadataRaw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
      } catch {
        metadata = {};
      }
    }
    return {
      ok: true,
      value: {
        featureKey: normalizeFeatureKey(form.get("feature_key")),
        filename: typeof file.name === "string" ? file.name : "file",
        mimeType: (file.type || "application/octet-stream").toLowerCase(),
        bytes,
        metadata,
      },
    };
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return { ok: false, error: "جسم الطلب يجب أن يكون JSON صحيحًا أو نموذج ملفات.", status: 400 };
  }
  const base64 = typeof body.content_base64 === "string" ? body.content_base64 : "";
  if (!base64) return { ok: false, error: "حقل content_base64 مطلوب لرفع الملف.", status: 400 };
  if (base64.length > Math.ceil(limit * 1.4)) return { ok: false, error: "حجم الملف يتجاوز الحد المسموح.", status: 413 };
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(base64);
  } catch {
    return { ok: false, error: "تعذر فك ترميز الملف المرسل.", status: 400 };
  }
  if (bytes.byteLength > limit) return { ok: false, error: "حجم الملف يتجاوز الحد المسموح.", status: 413 };
  return {
    ok: true,
    value: {
      featureKey: normalizeFeatureKey(body.feature_key),
      filename: typeof body.filename === "string" ? body.filename : "file",
      mimeType: typeof body.mime_type === "string" && body.mime_type.trim() ? body.mime_type.trim().toLowerCase() : "application/octet-stream",
      bytes,
      metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata as Record<string, unknown>
        : {},
    },
  };
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed; use POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Server database configuration is incomplete." }, 500);

  const userJwt = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!userJwt) return jsonResponse({ error: "A signed-in user's Bearer access token is required." }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await supabase.auth.getUser(userJwt);
  if (authError || !authData.user) return jsonResponse({ error: "Invalid or expired user access token." }, 401);
  const user = authData.user;

  const { data: profile, error: profileError } = await supabase
    .from("suly_profiles")
    .select("is_banned")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("media-gateway profile lookup failed:", profileError.message);
    return jsonResponse({ error: "Could not validate the application account." }, 500);
  }
  if (!profile) return jsonResponse({ error: "Application profile is missing. Sign out and sign in again." }, 403);
  if (profile.is_banned) return jsonResponse({ error: "This account is suspended." }, 403);

  const limit = maxUploadBytes();

  // Listing is served from the registry; file bytes are never proxied.
  const url = new URL(req.url);
  if (url.searchParams.get("action") === "list") {
    const { data, error } = await supabase
      .from("global_media_assets")
      .select("id,feature_key,bucket,object_key,public_url,mime_type,size_bytes,original_filename,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("media-gateway listing failed:", error.message);
      return jsonResponse({ error: "Could not load the media list." }, 500);
    }
    return jsonResponse({ success: true, assets: data ?? [] });
  }

  const parsedUpload = await readUpload(req, limit);
  if (!parsedUpload.ok) return jsonResponse({ error: parsedUpload.error }, parsedUpload.status);
  const upload = parsedUpload.value;

  const sizeCheck = checkUploadSize(upload.bytes.byteLength, limit);
  if (!sizeCheck.ok) {
    return jsonResponse({ error: sizeCheck.reason === "empty" ? "الملف فارغ." : "حجم الملف يتجاوز الحد المسموح." }, sizeCheck.reason === "empty" ? 400 : 413);
  }
  if (!isAllowedMimeType(upload.mimeType)) {
    return jsonResponse({ error: "نوع الملف غير مدعوم للرفع." }, 415);
  }

  let driver: StorageDriver;
  try {
    driver = resolveStorageDriver();
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      console.error("media-gateway storage is not configured.");
      return jsonResponse({ error: "التخزين الخارجي غير مهيأ على السيرفر. تواصل مع الدعم.", code: "storage_not_configured" }, 503);
    }
    throw error;
  }

  const objectKey = buildObjectKey({
    featureKey: upload.featureKey,
    userId: user.id,
    filename: upload.filename,
    uniqueId: crypto.randomUUID(),
  });
  if (!isSafeObjectKey(objectKey)) {
    return jsonResponse({ error: "تعذر تكوين مسار آمن للملف." }, 400);
  }

  let stored;
  try {
    stored = await driver.put({
      key: objectKey,
      body: upload.bytes,
      contentType: upload.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    });
  } catch (error) {
    if (error instanceof StorageUploadError) {
      console.error("media-gateway upload rejected by storage:", error.status);
      return jsonResponse({ error: "رفض التخزين الخارجي رفع الملف. حاول مرة أخرى." }, 502);
    }
    console.error("media-gateway upload failed:", error instanceof Error ? error.message : String(error));
    return jsonResponse({ error: "تعذر رفع الملف إلى التخزين الخارجي." }, 502);
  }

  const checksum = await sha256Hex(upload.bytes);
  const { data: assetId, error: registerError } = await supabase.rpc("suly_media_register", {
    p_user_id: user.id,
    p_feature_key: upload.featureKey,
    p_storage_provider: stored.provider,
    p_bucket: stored.bucket,
    p_object_key: stored.objectKey,
    p_public_url: stored.url,
    p_mime_type: upload.mimeType,
    p_size_bytes: stored.size,
    p_checksum_sha256: checksum,
    p_original_filename: upload.filename.slice(0, 300),
    p_metadata: upload.metadata,
  });
  if (registerError) {
    console.error("media-gateway could not register the asset:", registerError.message);
    return jsonResponse({ success: false, error: "تم رفع الملف لكن تعذر تسجيله في قاعدة البيانات.", url: stored.url }, 500);
  }

  return jsonResponse({
    success: true,
    id: assetId,
    feature_key: upload.featureKey,
    url: stored.url,
    object_key: stored.objectKey,
    mime_type: upload.mimeType,
    size_bytes: stored.size,
  });
}

Deno.serve(async (req: Request) => {
  try {
    return await handleRequest(req);
  } catch (error) {
    console.error("Unhandled media-gateway error:", error instanceof Error ? error.message : String(error));
    return jsonResponse({ error: "Internal media-gateway error." }, 500);
  }
});

export { R2StorageDriver, readR2Config };
