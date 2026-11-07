import { supabase } from "../../lib/supabase/client";

// All uploads in the app go through the media-gateway Edge Function, which
// streams the bytes to the external object store (Cloudflare R2) and records
// only the resulting URL in Supabase. The client never writes to Supabase
// Storage, so no file bytes are stored in the database project.
//
// Size and content-type rules are authoritative on the server; the client only
// performs a fast pre-check to avoid uploading a file that will be rejected.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface UploadInput {
  featureKey?: string;
  filename: string;
  mimeType: string;
  /** Base64 payload without the data-URL prefix. */
  base64: string;
  metadata?: Record<string, unknown>;
}

export interface UploadResult {
  id: string;
  url: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  featureKey: string;
}

export interface MediaAsset {
  id: string;
  featureKey: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number;
  filename: string | null;
  createdAt: string;
}

export class MediaUploadError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MediaUploadError";
    this.code = code;
  }
}

function base64SizeBytes(base64: string): number {
  const clean = base64.replace(/\s+/g, "");
  if (!clean) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function normalizeFeatureKey(value: string | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  return /^[a-z0-9_]{1,40}$/.test(raw) ? raw : "general";
}

export function describeUploadError(status: number): string {
  if (status === 401 || status === 403) return "انتهت الجلسة أو لا تملك صلاحية الرفع. سجّل الدخول مجددًا.";
  if (status === 413) return "حجم الملف أكبر من الحد المسموح (25 ميجابايت).";
  if (status === 415) return "نوع الملف غير مدعوم.";
  if (status === 503) return "خدمة التخزين غير مهيأة على السيرفر حاليًا.";
  return "تعذر رفع الملف. حاول مرة أخرى.";
}

/** Uploads one file and returns its external URL. */
export async function uploadMedia(input: UploadInput): Promise<UploadResult> {
  const size = base64SizeBytes(input.base64);
  if (size <= 0) throw new MediaUploadError("empty", "الملف فارغ.");
  if (size > MAX_UPLOAD_BYTES) throw new MediaUploadError("too_large", "حجم الملف أكبر من الحد المسموح (25 ميجابايت).");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new MediaUploadError("unauthenticated", "سجّل الدخول مجددًا قبل رفع الملفات.");
  }

  const response = await supabase.functions.invoke("media-gateway", {
    body: {
      feature_key: normalizeFeatureKey(input.featureKey),
      filename: input.filename,
      mime_type: input.mimeType,
      content_base64: input.base64,
      metadata: input.metadata ?? {},
    },
  });

  const payload = (response.data ?? {}) as Record<string, unknown>;
  if (response.error) {
    const status = (response.error as { context?: { status?: number } })?.context?.status ?? 0;
    throw new MediaUploadError("request_failed", describeUploadError(status));
  }
  if (payload.success !== true || typeof payload.url !== "string") {
    throw new MediaUploadError("rejected", "لم يقبل السيرفر الملف. تحقق من نوعه وحجمه.");
  }
  return {
    id: String(payload.id ?? ""),
    url: payload.url,
    objectKey: String(payload.object_key ?? ""),
    mimeType: String(payload.mime_type ?? input.mimeType),
    sizeBytes: Number(payload.size_bytes ?? size),
    featureKey: String(payload.feature_key ?? normalizeFeatureKey(input.featureKey)),
  };
}

/** Converts a browser File into base64 and uploads it (web only). */
export async function uploadWebFile(file: File, featureKey = "general"): Promise<UploadResult> {
  if (typeof FileReader === "undefined") {
    throw new MediaUploadError("unsupported", "رفع الملفات من المتصفح فقط في هذا الإصدار.");
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new MediaUploadError("read_failed", "تعذر قراءة الملف."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
  return uploadMedia({
    featureKey,
    filename: file.name || "file",
    mimeType: file.type || "application/octet-stream",
    base64,
  });
}

/** Lists the signed-in user's previously uploaded files. */
export async function listMyMedia(): Promise<MediaAsset[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) return [];
  const { data, error } = await supabase.functions.invoke("media-gateway?action=list", { method: "POST" });
  if (error) return [];
  const assets = Array.isArray((data as { assets?: unknown[] })?.assets) ? (data as { assets: unknown[] }).assets : [];
  return assets.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      featureKey: String(row.feature_key ?? "general"),
      url: String(row.public_url ?? ""),
      mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
      sizeBytes: Number(row.size_bytes ?? 0),
      filename: typeof row.original_filename === "string" ? row.original_filename : null,
      createdAt: String(row.created_at ?? ""),
    };
  }).filter((asset) => asset.id && asset.url);
}