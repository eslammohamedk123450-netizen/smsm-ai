// Unsigned Cloudinary transport. No API secret exists on the client: the upload
// preset is the only credential, and Cloudinary decides what it allows.

import { Platform } from "react-native";
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
  MAX_UPLOAD_BYTES,
  UPLOAD_TIMEOUT_MS,
} from "./cloudinary-config";

export type MediaKind = "image" | "video" | "raw";

/** A file ready to be attached to FormData, from either platform. */
export interface UploadFilePart {
  /** Browser Blob/File, used on web. */
  blob?: Blob;
  /** Local uri, used on native (`file://...`). */
  uri?: string;
  name: string;
  type: string;
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  bytes: number;
  format: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  originalFilename: string;
}

export class CloudinaryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CloudinaryError";
    this.code = code;
  }
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm", "avi", "mkv", "3gp", "ogv"];

function extensionOf(name: string): string {
  const clean = name.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot > 0 ? clean.slice(dot + 1).toLowerCase() : "";
}

/**
 * Picks the Cloudinary endpoint. `auto` would work for everything, but naming
 * the resource type explicitly keeps images optimisable and videos streamable.
 */
export function detectMediaKind(mimeType: string, filename: string): MediaKind {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  const ext = extensionOf(filename);
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  return "raw";
}

export function buildUploadUrl(kind: MediaKind): string {
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${kind}/upload`;
}

/** Images that canvas can decode; GIF/SVG are skipped so animation is preserved. */
export function shouldCompressImage(mimeType: string, filename: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  const ext = extensionOf(filename);
  if (mime === "image/gif" || ext === "gif") return false;
  if (mime === "image/svg+xml" || ext === "svg") return false;
  return mime.startsWith("image/") || IMAGE_EXTENSIONS.includes(ext);
}

function humanError(payload: unknown): string {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const error = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : {};
  const message = typeof error.message === "string" ? error.message : "";
  if (/preset/i.test(message)) return "إعداد الرفع (upload preset) غير مسموح لهذا النوع من الملفات. راجع إعدادات Cloudinary.";
  if (/file size|too large/i.test(message)) return "حجم الملف أكبر من المسموح في Cloudinary.";
  if (/format/i.test(message)) return "صيغة الملف غير مدعومة في Cloudinary.";
  return "رفض Cloudinary الملف. تحقق من نوعه وحجمه ثم أعد المحاولة.";
}

/**
 * Uploads one file with the unsigned preset and returns Cloudinary's secure URL.
 * FormData is built per platform: web sends a Blob, native sends a file uri.
 */
export async function uploadToCloudinary(file: UploadFilePart, kind: MediaKind): Promise<CloudinaryUploadResult> {
  const form = new FormData();
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (Platform.OS === "web") {
    if (!file.blob) throw new CloudinaryError("no_file", "تعذر قراءة الملف في المتصفح.");
    if (file.blob.size > MAX_UPLOAD_BYTES) {
      throw new CloudinaryError("too_large", "حجم الملف أكبر من الحد المسموح (100 ميجابايت).");
    }
    form.append("file", file.blob, file.name);
  } else {
    if (!file.uri) throw new CloudinaryError("no_file", "تعذر قراءة الملف من الجهاز.");
    // React Native's FormData accepts this shape and streams the file directly.
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS) : null;
  let response: Response;
  try {
    response = await fetch(buildUploadUrl(kind), {
      method: "POST",
      body: form,
      signal: controller?.signal,
    });
  } catch (cause) {
    if ((cause as { name?: string })?.name === "AbortError") {
      throw new CloudinaryError("timeout", "استغرق الرفع وقتًا طويلًا. جرّب ملفًا أصغر أو اتصالًا أفضل.");
    }
    throw new CloudinaryError("network", "تعذر الوصول إلى Cloudinary. تحقق من الاتصال.");
  } finally {
    if (timer) clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload || typeof payload.secure_url !== "string") {
    throw new CloudinaryError("rejected", humanError(payload));
  }
  return {
    secureUrl: payload.secure_url,
    publicId: String(payload.public_id ?? ""),
    resourceType: String(payload.resource_type ?? kind),
    bytes: Number(payload.bytes ?? 0),
    format: typeof payload.format === "string" ? payload.format : null,
    width: typeof payload.width === "number" ? payload.width : null,
    height: typeof payload.height === "number" ? payload.height : null,
    durationSeconds: typeof payload.duration === "number" ? payload.duration : null,
    originalFilename: String(payload.original_filename ?? file.name),
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}