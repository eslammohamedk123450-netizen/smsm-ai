// Media pipeline: pick → compress → upload to Cloudinary (unsigned) → register
// the secure URL in Supabase. Supabase never receives file bytes; Cloudinary
// never learns who the user is. The metadata row is the bridge between them.

import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase/client";
import { compressImageForUpload } from "./image-compression";
import { pickFile } from "./web-file-input";
import {
  CloudinaryError,
  detectMediaKind,
  formatBytes,
  shouldCompressImage,
  uploadToCloudinary,
  type MediaKind,
  type UploadFilePart,
} from "./cloudinary";

export { MAX_UPLOAD_BYTES } from "./cloudinary-config";
export { CloudinaryError, formatBytes } from "./cloudinary";

export interface MediaAsset {
  id: string;
  featureKey: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number;
  filename: string | null;
  kind: MediaKind;
  createdAt: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface PickedMedia {
  part: UploadFilePart;
  kind: MediaKind;
  width?: number;
  height?: number;
  sourceBytes: number;
}

export class MediaUploadError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MediaUploadError";
    this.code = code;
  }
}

function normalizeFeatureKey(value: string | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  return /^[a-z0-9_]{1,40}$/.test(raw) ? raw : "general";
}

function filenameFromUri(uri: string, fallback: string): string {
  const clean = uri.split("?")[0];
  const last = clean.slice(clean.lastIndexOf("/") + 1);
  return last && last.includes(".") ? last : fallback;
}

/** Converts an expo-image-picker asset into something FormData can carry. */
async function assetToPicked(asset: ImagePicker.ImagePickerAsset): Promise<PickedMedia> {
  const mimeType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
  const name = asset.fileName ?? filenameFromUri(asset.uri, asset.type === "video" ? "video.mp4" : "image.jpg");
  const kind = detectMediaKind(mimeType, name);
  if (Platform.OS === "web") {
    let blob: Blob | null = (asset as unknown as { file?: Blob }).file ?? null;
    if (!blob) {
      const response = await fetch(asset.uri);
      blob = await response.blob();
    }
    if (!blob) throw new MediaUploadError("read_failed", "تعذر قراءة الملف في المتصفح.");
    return { part: { blob, name, type: mimeType }, kind, width: asset.width, height: asset.height, sourceBytes: blob.size };
  }
  return { part: { uri: asset.uri, name, type: mimeType }, kind, width: asset.width, height: asset.height, sourceBytes: asset.fileSize ?? 0 };
}

export type PickKind = "image" | "video" | "document";

/** Opens the platform picker. Returns null when the user cancels. */
export async function pickMedia(kind: PickKind): Promise<PickedMedia | null> {
  if (Platform.OS === "web") return pickOnWeb(kind);
  if (kind === "document") {
    throw new MediaUploadError("unsupported", "رفع الملفات من الجهاز متاح على نسخة الويب حاليًا؛ استخدم صورة أو فيديو من المكتبة.");
  }
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new MediaUploadError("permission", "لم تُمنح صلاحية الوصول إلى الصور. فعّلها من إعدادات الجهاز.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === "video" ? ["videos"] : ["images"],
    videoMaxDuration: 120,
    quality: 1,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  return assetToPicked(result.assets[0]);
}

/** The web build uses one reusable file input instead of the native picker. */
async function pickOnWeb(kind: PickKind): Promise<PickedMedia | null> {
  const accept = kind === "video"
    ? "video/*"
    : kind === "image"
      ? "image/*"
      : "image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx,.txt";
  const file = await pickFile(accept);
  if (!file) return null;
  return pickedFromWebFile(file);
}

/** Uploads a browser File directly (used by admin uploads and web fallbacks). */
export function pickedFromWebFile(file: File): PickedMedia {
  const kind = detectMediaKind(file.type, file.name);
  return { part: { blob: file, name: file.name, type: file.type || "application/octet-stream" }, kind, sourceBytes: file.size };
}

export interface UploadMediaInput {
  picked: PickedMedia;
  featureKey?: string;
}

/**
 * Compresses images, uploads to Cloudinary and registers the row in Supabase.
 * The returned asset can be rendered immediately with `asset.url`.
 */
export async function uploadMediaFile(input: UploadMediaInput): Promise<MediaAsset> {
  const { picked } = input;
  const featureKey = normalizeFeatureKey(input.featureKey);
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) throw new MediaUploadError("unauthenticated", "سجّل الدخول مجددًا قبل رفع الملفات.");

  let part = picked.part;
  if (picked.kind === "image" && shouldCompressImage(part.type, part.name)) {
    part = await compressImageForUpload(part, { width: picked.width });
  }

  let uploaded;
  try {
    uploaded = await uploadToCloudinary(part, picked.kind);
  } catch (cause) {
    if (cause instanceof CloudinaryError) throw new MediaUploadError(cause.code, cause.message);
    throw new MediaUploadError("upload_failed", "تعذر رفع الملف إلى Cloudinary.");
  }

  const { data, error } = await supabase.rpc("suly_media_register_self", {
    p_feature_key: featureKey,
    p_storage_provider: "cloudinary",
    p_bucket: uploaded.resourceType,
    p_object_key: uploaded.publicId,
    p_public_url: uploaded.secureUrl,
    p_mime_type: part.type,
    p_size_bytes: uploaded.bytes,
    p_original_filename: uploaded.originalFilename,
    p_metadata: {
      kind: picked.kind,
      format: uploaded.format,
      width: uploaded.width,
      height: uploaded.height,
      duration: uploaded.durationSeconds,
      compressed: part !== picked.part,
    },
  });
  if (error) {
    throw new MediaUploadError("register_failed", "تم الرفع لكن تعذر حفظ الرابط في Supabase. أعد المحاولة.");
  }

  return {
    id: String(data ?? ""),
    featureKey,
    url: uploaded.secureUrl,
    mimeType: part.type,
    sizeBytes: uploaded.bytes,
    filename: uploaded.originalFilename,
    kind: picked.kind,
    createdAt: new Date().toISOString(),
    width: uploaded.width,
    height: uploaded.height,
    durationSeconds: uploaded.durationSeconds,
  };
}

function asKind(value: unknown): MediaKind {
  const text = String(value ?? "");
  return text === "video" || text === "raw" ? text : "image";
}

/** Lists the signed-in user's uploads, newest first. */
export async function listMyMedia(limit = 60): Promise<MediaAsset[]> {
  const { data, error } = await supabase.rpc("suly_media_list_self", { p_limit: limit });
  if (error) throw new MediaUploadError("list_failed", "تعذر تحميل مكتبة الوسائط.");
  const rows = Array.isArray(data) ? data : [];
  return rows.map((item) => {
    const row = item as Record<string, unknown>;
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    return {
      id: String(row.id ?? ""),
      featureKey: String(row.feature_key ?? "general"),
      url: String(row.public_url ?? ""),
      mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
      sizeBytes: Number(row.size_bytes ?? 0),
      filename: typeof row.original_filename === "string" ? row.original_filename : null,
      kind: asKind(metadata.kind ?? row.storage_provider),
      createdAt: String(row.created_at ?? ""),
      width: typeof metadata.width === "number" ? metadata.width : null,
      height: typeof metadata.height === "number" ? metadata.height : null,
      durationSeconds: typeof metadata.duration === "number" ? metadata.duration : null,
    };
  }).filter((asset) => asset.url.length > 0);
}
