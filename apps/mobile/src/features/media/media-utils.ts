import { Platform } from "react-native";
import { IMAGE_MAX_DIMENSION, IMAGE_QUALITY, MAX_UPLOAD_BYTES } from "./media-config";

export type MediaKind = "image" | "video" | "raw";
export interface UploadFilePart { blob?: Blob; uri?: string; name: string; type: string; }
export interface SignedStorageUpload { bucket: string; object_key: string; token: string; }
export class MediaUploadError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = "MediaUploadError"; this.code = code; }
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
export async function uploadToStorage(
  file: UploadFilePart,
  signed: SignedStorageUpload,
  storage: { from(bucket: string): { uploadToSignedUrl(path: string, token: string, body: Blob, options: { contentType: string; upsert: false }): Promise<{ error: { message: string } | null }> } },
): Promise<void> {
  let body = file.blob;
  if (!body && Platform.OS !== "web" && file.uri) {
    try {
      const response = await fetch(file.uri);
      if (!response.ok) throw new Error("read_failed");
      body = await response.blob();
    } catch {
      throw new MediaUploadError("read_failed", "تعذر قراءة الملف من الجهاز.");
    }
  }
  if (!body) throw new MediaUploadError("no_file", "تعذر قراءة الملف.");
  if (body.size < 1) throw new MediaUploadError("empty", "الملف فارغ أو تعذر قراءته.");
  if (body.size > MAX_UPLOAD_BYTES) throw new MediaUploadError("too_large", "حجم الملف أكبر من الحد المسموح (100 ميجابايت).");
  const { error } = await storage.from(signed.bucket).uploadToSignedUrl(signed.object_key, signed.token, body, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new MediaUploadError("upload_failed", "تعذر رفع الملف. تحقق من الاتصال وحاول مرة أخرى.");
}
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export { IMAGE_MAX_DIMENSION, IMAGE_QUALITY, MAX_UPLOAD_BYTES };
