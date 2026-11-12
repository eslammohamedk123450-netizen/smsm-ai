import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../../lib/supabase/client";
import { env } from "../../config/env";
import { compressImageForUpload } from "./image-compression";
import { pickFile } from "./web-file-input";
import {
  detectMediaKind,
  formatBytes,
  shouldCompressImage,
  uploadToStorage,
  type MediaKind,
  type SignedStorageUpload,
  type UploadFilePart,
  MediaUploadError,
} from "./media-utils";

export { MAX_UPLOAD_BYTES, formatBytes, MediaUploadError } from "./media-utils";
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
export interface PickedMedia { part: UploadFilePart; kind: MediaKind; width?: number; height?: number; sourceBytes: number; }
function normalizeFeatureKey(value: string | undefined): "chat" | "support" | "hims" | "general" {
  return value === "chat" || value === "support" || value === "hims" || value === "general" ? value : "general";
}
function filenameFromUri(uri: string, fallback: string): string {
  const clean = uri.split("?")[0];
  const last = clean.slice(clean.lastIndexOf("/") + 1);
  return last && last.includes(".") ? last : fallback;
}
async function assetToPicked(asset: ImagePicker.ImagePickerAsset): Promise<PickedMedia> {
  const mimeType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
  const name = asset.fileName ?? filenameFromUri(asset.uri, asset.type === "video" ? "video.mp4" : "image.jpg");
  const kind = detectMediaKind(mimeType, name);
  if (Platform.OS === "web") {
    let blob: Blob | null = (asset as unknown as { file?: Blob }).file ?? null;
    if (!blob) blob = await (await fetch(asset.uri)).blob();
    if (!blob) throw new MediaUploadError("read_failed", "تعذر قراءة الملف في المتصفح.");
    return { part: { blob, name, type: mimeType }, kind, width: asset.width, height: asset.height, sourceBytes: blob.size };
  }
  return { part: { uri: asset.uri, name, type: mimeType }, kind, width: asset.width, height: asset.height, sourceBytes: asset.fileSize ?? 0 };
}
export type PickKind = "image" | "video" | "document";
export async function pickMedia(kind: PickKind): Promise<PickedMedia | null> {
  if (Platform.OS === "web") return pickOnWeb(kind);
  if (kind === "document") {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? "application/octet-stream";
    return { part: { uri: asset.uri, name: asset.name, type: mimeType }, kind: detectMediaKind(mimeType, asset.name), sourceBytes: asset.size ?? 0 };
  }
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new MediaUploadError("permission", "لم تُمنح صلاحية الوصول إلى الصور. فعّلها من إعدادات الجهاز.");
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === "video" ? ["videos"] : ["images"], videoMaxDuration: 120, quality: 1, allowsMultipleSelection: false });
  if (result.canceled || !result.assets?.length) return null;
  return assetToPicked(result.assets[0]);
}
async function pickOnWeb(kind: PickKind): Promise<PickedMedia | null> {
  const accept = kind === "video" ? "video/*" : kind === "image" ? "image/*" : "image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx,.txt";
  const file = await pickFile(accept);
  if (!file) return null;
  return pickedFromWebFile(file);
}
export function pickedFromWebFile(file: File): PickedMedia {
  const kind = detectMediaKind(file.type, file.name);
  return { part: { blob: file, name: file.name, type: file.type || "application/octet-stream" }, kind, sourceBytes: file.size };
}
export interface UploadMediaInput { picked: PickedMedia; featureKey?: string; conversationId?: string; messageId?: string; supportTicketId?: string; }
interface GatewayError { error?: string; }
function gatewayMessage(error: unknown, data: unknown, fallback: string): string {
  const response = data && typeof data === "object" ? data as GatewayError : null;
  const fromData = response?.error;
  const context = (error as { context?: { status?: number } } | null)?.context;
  if (context?.status === 401) return "انتهت جلسة الدخول. سجّل الدخول مرة أخرى.";
  if (context?.status === 404) return "الخدمة غير متاحة الآن. حاول مرة أخرى لاحقًا.";
  return typeof fromData === "string" ? fromData : fallback;
}
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || env.supabaseAnonKey;
  return { Authorization: `Bearer ${token}`, apikey: env.supabaseAnonKey };
}
export async function getMediaDeliveryUrl(mediaId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("media-gateway", { body: { action: "get_url", media_id: mediaId }, headers: await getAuthHeaders() });
  if (error || !data || typeof data.url !== "string") throw new MediaUploadError("media_access_denied", gatewayMessage(error, data, "تعذر استرجاع الملف أو لا تملك صلاحية الوصول إليه."));
  return data.url;
}
export async function getMediaDeliveryUrls(mediaIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(mediaIds)].filter(Boolean).slice(0, 500);
  if (!ids.length) return new Map();
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += 100) chunks.push(ids.slice(index, index + 100));
  const headers = await getAuthHeaders();
  const results = await Promise.all(chunks.map(async (chunk) => {
    const { data, error } = await supabase.functions.invoke("media-gateway", { body: { action: "get_urls", media_ids: chunk }, headers });
    if (error || !Array.isArray(data?.assets)) throw new MediaUploadError("resolve_failed", gatewayMessage(error, data, "تعذر التحقق من صلاحية عرض الملفات."));
    return data.assets as unknown[];
  }));
  return new Map<string, string>(results.flat()
    .filter((asset: unknown): asset is { id: string; url: string } => !!asset && typeof asset === "object" && typeof (asset as { id?: unknown }).id === "string" && typeof (asset as { url?: unknown }).url === "string")
    .map((asset: { id: string; url: string }) => [asset.id, asset.url]));
}
export async function uploadMediaFile(input: UploadMediaInput): Promise<MediaAsset> {
  const { picked } = input;
  const featureKey = normalizeFeatureKey(input.featureKey);
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) throw new MediaUploadError("unauthenticated", "سجّل الدخول مجددًا قبل رفع الملفات.");
  let part = picked.part;
  if (picked.kind === "image" && shouldCompressImage(part.type, part.name)) part = await compressImageForUpload(part, { width: picked.width });
  const uploadSize = part.blob?.size ?? picked.sourceBytes;
  if (!Number.isFinite(uploadSize) || uploadSize < 1) throw new MediaUploadError("empty", "الملف فارغ أو تعذر معرفة حجمه.");
  if (uploadSize > 100 * 1024 * 1024) throw new MediaUploadError("too_large", "حجم الملف أكبر من الحد المسموح (100 ميجابايت).");
  const headers = { Authorization: `Bearer ${sessionData.session.access_token}`, apikey: env.supabaseAnonKey };
  const context = { feature_key: featureKey, resource_type: picked.kind, mime_type: part.type, size_bytes: uploadSize, original_filename: part.name, conversation_id: input.conversationId ?? null, message_id: input.messageId ?? null, support_ticket_id: input.supportTicketId ?? null };
  const { data: signedData, error: signError } = await supabase.functions.invoke("media-gateway", { body: { action: "sign_upload", ...context }, headers });
  if (signError || !signedData?.bucket || !signedData?.object_key || !signedData?.token) throw new MediaUploadError("sign_failed", gatewayMessage(signError, signedData, "تعذر تجهيز رفع الملف."));
  const signed = signedData as SignedStorageUpload;
  await uploadToStorage(part, signed, supabase.storage);
  const { data: registered, error: registerError } = await supabase.functions.invoke("media-gateway", { body: { action: "register", ...context, object_key: signed.object_key }, headers });
  if (registerError || !registered?.success || typeof registered.id !== "string") throw new MediaUploadError("register_failed", gatewayMessage(registerError, registered, "تعذر حفظ الملف في المكتبة."));
  if (typeof registered.url !== "string") throw new MediaUploadError("delivery_failed", "تم حفظ الملف لكن تعذر تجهيزه للعرض.");
  return {
    id: registered.id,
    featureKey,
    url: registered.url,
    mimeType: part.type,
    sizeBytes: Number(registered.size_bytes ?? uploadSize),
    filename: part.name,
    kind: picked.kind,
    createdAt: new Date().toISOString(),
    width: picked.width ?? null,
    height: picked.height ?? null,
    durationSeconds: null,
  };
}
function asKind(value: unknown): MediaKind { const text = String(value ?? ""); return text === "video" || text === "raw" ? text : "image"; }
export async function listMyMedia(limit = 60): Promise<MediaAsset[]> {
  const { data, error } = await supabase.rpc("suly_media_list_self", { p_limit: Math.min(Math.max(limit, 1), 200) });
  if (error) throw new MediaUploadError("list_failed", "تعذر تحميل مكتبة الوسائط.");
  const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
  if (!rows.length) return [];
  const { data: resolved, error: resolveError } = await supabase.functions.invoke("media-gateway", { body: { action: "get_urls", media_ids: rows.map((row) => String(row.id)).filter(Boolean) }, headers: await getAuthHeaders() });
  if (resolveError) throw new MediaUploadError("resolve_failed", gatewayMessage(resolveError, resolved, "تعذر التحقق من صلاحية عرض الملفات."));
  const urlById = new Map<string, string>((resolved?.assets ?? []).map((item: { id: string; url: string }) => [String(item.id), String(item.url)]));
  return rows.map((row) => {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    return {
      id: String(row.id ?? ""), featureKey: String(row.feature_key ?? "general"), url: urlById.get(String(row.id)) ?? "",
      mimeType: typeof row.mime_type === "string" ? row.mime_type : null, sizeBytes: Number(row.size_bytes ?? 0),
      filename: typeof row.original_filename === "string" ? row.original_filename : null, kind: asKind(metadata.kind ?? row.storage_provider),
      createdAt: String(row.created_at ?? ""), width: typeof metadata.width === "number" ? metadata.width : null,
      height: typeof metadata.height === "number" ? metadata.height : null, durationSeconds: typeof metadata.duration_seconds === "number" ? metadata.duration_seconds : null,
    };
  }).filter((asset) => asset.url.length > 0);
}
