import { Platform } from "react-native";
import { MAX_UPLOAD_BYTES, UPLOAD_TIMEOUT_MS } from "./cloudinary-config";

export type MediaKind = "image" | "video" | "raw";
export interface UploadFilePart {
  blob?: Blob;
  uri?: string;
  name: string;
  type: string;
}
export interface SignedCloudinaryUpload {
  cloud_name: string;
  api_key: string;
  resource_type: MediaKind;
  signed_fields: Record<string, string>;
}
export interface CloudinaryUploadResult {
  publicId: string;
  resourceType: MediaKind;
  bytes: number;
  version: number | null;
  format: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  originalFilename: string;
}
export class CloudinaryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = "CloudinaryError"; this.code = code; }
}
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm", "avi", "mkv", "3gp", "ogv"];
function extensionOf(name: string): string {
  const clean = name.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot > 0 ? clean.slice(dot + 1).toLowerCase() : "";
}
export function detectMediaKind(mimeType: string, filename: string): MediaKind {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  const ext = extensionOf(filename);
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  return "raw";
}
export function shouldCompressImage(mimeType: string, filename: string): boolean {
  const mime = (mimeType || "").toLowerCase();
  const ext = extensionOf(filename);
  if (mime === "image/gif" || ext === "gif" || mime === "image/svg+xml" || ext === "svg") return false;
  return mime.startsWith("image/") || IMAGE_EXTENSIONS.includes(ext);
}
function humanError(payload: unknown): string {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const error = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : {};
  const message = typeof error.message === "string" ? error.message : "";
  if (/file size|too large/i.test(message)) return "حجم الملف أكبر من المسموح في Cloudinary.";
  if (/format|type/i.test(message)) return "صيغة الملف غير مدعومة في Cloudinary.";
  return "رفض Cloudinary الملف. تحقق من نوعه وحجمه ثم أعد المحاولة.";
}
export async function uploadToCloudinary(file: UploadFilePart, signed: SignedCloudinaryUpload): Promise<CloudinaryUploadResult> {
  const kind = signed.resource_type;
  const partSize = file.blob?.size;
  if (typeof partSize === "number" && partSize > MAX_UPLOAD_BYTES) throw new CloudinaryError("too_large", "حجم الملف أكبر من الحد المسموح (100 ميجابايت).");
  const form = new FormData();
  for (const [key, value] of Object.entries(signed.signed_fields)) form.append(key, value);
  form.append("api_key", signed.api_key);
  if (Platform.OS === "web") {
    if (!file.blob) throw new CloudinaryError("no_file", "تعذر قراءة الملف في المتصفح.");
    form.append("file", file.blob, file.name);
  } else {
    if (!file.uri) throw new CloudinaryError("no_file", "تعذر قراءة الملف من الجهاز.");
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS) : null;
  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloud_name)}/${kind}/upload`, { method: "POST", body: form, signal: controller?.signal });
  } catch (cause) {
    if ((cause as { name?: string })?.name === "AbortError") throw new CloudinaryError("timeout", "استغرق الرفع وقتًا طويلًا. جرّب ملفًا أصغر أو اتصالًا أفضل.");
    throw new CloudinaryError("network", "تعذر الوصول إلى Cloudinary. تحقق من الاتصال.");
  } finally { if (timer) clearTimeout(timer); }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload || typeof payload.public_id !== "string") throw new CloudinaryError("rejected", humanError(payload));
  return {
    publicId: payload.public_id,
    resourceType: kind,
    bytes: Number(payload.bytes ?? 0),
    version: typeof payload.version === "number" ? payload.version : null,
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
