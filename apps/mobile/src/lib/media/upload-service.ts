import { supabase } from "../../lib/supabase/client";

type MediaKind = "image" | "video";

/**
 * Uploads a chat attachment through the authenticated media-gateway flow:
 * sign -> direct Cloudinary upload -> server-side registration.
 * No Cloudinary secret or unsigned upload preset is exposed to the app.
 */
export async function uploadMedia(
  fileUri: string,
  mimeType: string,
  kind: MediaKind,
  conversationId?: string | null,
): Promise<string> {
  if (!conversationId) throw new Error("لا يمكن رفع المرفق قبل إنشاء المحادثة.");

  const fileExtension = mimeType.split("/")[1] || (kind === "image" ? "jpg" : "mp4");
  const filename = `media_${Date.now()}.${fileExtension}`;
  const localResponse = await fetch(fileUri);
  if (!localResponse.ok) throw new Error("تعذر قراءة الملف من الجهاز.");
  const fileBlob = await localResponse.blob();
  if (!fileBlob.size) throw new Error("الملف فارغ أو تعذر قراءته.");

  const { data: signed, error: signError } = await supabase.functions.invoke("media-gateway", {
    body: {
      action: "sign_upload",
      feature_key: "chat",
      resource_type: kind,
      mime_type: mimeType,
      size_bytes: fileBlob.size,
      conversation_id: conversationId,
    },
  });
  if (signError || !signed?.cloud_name || !signed?.api_key || !signed?.signed_fields) {
    throw new Error(signError?.message || signed?.error || "تعذر تجهيز رفع الملف.");
  }

  const uploadForm = new FormData();
  uploadForm.append("file", fileBlob, filename);
  uploadForm.append("api_key", String(signed.api_key));
  for (const [key, value] of Object.entries(signed.signed_fields as Record<string, unknown>)) {
    uploadForm.append(key, String(value));
  }
  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(String(signed.cloud_name))}/${kind}/upload`;
  const cloudinaryResponse = await fetch(cloudinaryUrl, { method: "POST", body: uploadForm });
  const cloudinaryResult = await cloudinaryResponse.json().catch(() => ({}));
  if (!cloudinaryResponse.ok || !cloudinaryResult.public_id) {
    throw new Error(cloudinaryResult?.error?.message || "رفض Cloudinary رفع الملف.");
  }

  const { data: registered, error: registerError } = await supabase.functions.invoke("media-gateway", {
    body: {
      action: "register",
      feature_key: "chat",
      resource_type: kind,
      public_id: cloudinaryResult.public_id,
      mime_type: mimeType,
      original_filename: filename,
      conversation_id: conversationId,
    },
  });
  if (registerError || !registered?.url) {
    throw new Error(registerError?.message || registered?.error || "تم رفع الملف لكن تعذر تسجيله في مكتبة الوسائط.");
  }
  return String(registered.url);
}
