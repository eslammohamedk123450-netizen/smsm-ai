// Global infrastructure: object-key rules and upload validation for the global
// media storage layer. Pure functions only, so both the Edge Function and the
// client-side pre-checks share one behaviour.

export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MIN_UPLOAD_BYTES = 1;
export const MAX_OBJECT_KEY_LENGTH = 900;
export const MAX_FILENAME_LENGTH = 160;

const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/", "text/"];

const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/octet-stream",
]);

// Executables and scripts are rejected: uploaded bytes are served back to
// browsers, so the gateway never hosts runnable content.
const BLOCKED_MIME = new Set([
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
  "application/x-httpd-php",
  "text/html",
  "image/svg+xml",
]);

export function isAllowedMimeType(mimeType: string | null | undefined): boolean {
  const mime = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (!mime || BLOCKED_MIME.has(mime)) return false;
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export interface UploadSizeCheck {
  ok: boolean;
  reason?: "empty" | "too_large";
}

export function checkUploadSize(size: number, maxBytes: number = DEFAULT_MAX_UPLOAD_BYTES): UploadSizeCheck {
  if (!Number.isFinite(size) || size < MIN_UPLOAD_BYTES) return { ok: false, reason: "empty" };
  if (size > maxBytes) return { ok: false, reason: "too_large" };
  return { ok: true };
}

/** Removes path separators, control characters, and spaces from a user filename. */
export function sanitizeFilename(filename: string | null | undefined): string {
  const raw = (filename ?? "").trim().replace(/\\/g, "/").split("/").pop() ?? "";
  const cleaned = raw
    .normalize("NFKC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "");
  const withoutLeadingDots = cleaned.replace(/^\.+/, "");
  const trimmed = withoutLeadingDots.slice(0, MAX_FILENAME_LENGTH);
  if (trimmed.length === 0) return "file";
  // Non-Latin names (Arabic, Chinese, ...) lose their stem during sanitizing;
  // keep the extension so the stored object still identifies its type.
  const dot = trimmed.lastIndexOf(".");
  const stem = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const extension = dot > 0 ? trimmed.slice(dot) : "";
  if (!/[A-Za-z0-9]/.test(stem)) {
    return `file${extension}`.slice(0, MAX_FILENAME_LENGTH);
  }
  return trimmed;
}

export interface ObjectKeyInput {
  featureKey: string;
  userId: string;
  filename: string;
  uniqueId: string;
  /** Injectable clock keeps the key deterministic in tests. */
  now?: Date;
}

/**
 * Object keys are namespaced by feature, month, and user so lifecycle rules and
 * per-feature quotas can be applied later without moving files:
 * `<feature>/<yyyy>/<mm>/<user>/<uuid>-<safe-name>`
 */
export function buildObjectKey(input: ObjectKeyInput): string {
  const date = input.now ?? new Date();
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const feature = (input.featureKey || "general").toLowerCase().replace(/[^a-z0-9_]/g, "") || "general";
  const userSegment = (input.userId || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 36) || "anonymous";
  const unique = (input.uniqueId || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 36) || "0";
  const safeName = sanitizeFilename(input.filename);
  return `${feature}/${year}/${month}/${userSegment}/${unique}-${safeName}`;
}

export function isSafeObjectKey(key: string): boolean {
  if (!key || key.length > MAX_OBJECT_KEY_LENGTH) return false;
  if (key.startsWith("/") || key.includes("..") || key.includes("//")) return false;
  return key.split("/").every((segment) => SAFE_SEGMENT_PATTERN.test(segment));
}

/** Joins the public base URL and object key without double slashes. */
export function buildPublicUrl(baseUrl: string, objectKey: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const key = objectKey.replace(/^\/+/, "");
  return `${base}/${key}`;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/json": "json",
  "application/zip": "zip",
};

/** Falls back to the sanitized filename extension, then to `bin`. */
export function extensionFor(mimeType: string | null | undefined, filename?: string | null): string {
  const mime = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (MIME_EXTENSIONS[mime]) return MIME_EXTENSIONS[mime];
  const safe = sanitizeFilename(filename);
  const dot = safe.lastIndexOf(".");
  if (dot > 0 && dot < safe.length - 1) return safe.slice(dot + 1).toLowerCase().slice(0, 8);
  return "bin";
}
