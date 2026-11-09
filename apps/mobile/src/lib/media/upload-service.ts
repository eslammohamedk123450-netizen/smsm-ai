import { supabase } from "../../lib/supabase/client";

export async function uploadMedia(fileUri: string, mimeType: string, kind: 'image' | 'video'): Promise<string> {
  const fileExtension = mimeType.split('/')[1] || (kind === 'image' ? 'jpg' : 'mp4');
  const filename = `media_${Date.now()}.${fileExtension}`;
  
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: filename,
    type: mimeType,
  } as any);
  formData.append('resource_type', kind);

  const { data, error } = await supabase.functions.invoke('upload-media', {
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (error || !data?.secure_url) {
    throw new Error(error?.message || "تعذر رفع الميديا.");
  }
  return data.secure_url;
}
