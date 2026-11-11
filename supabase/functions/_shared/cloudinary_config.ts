import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** Parse Cloudinary's cloudinary://API_KEY:API_SECRET@CLOUD_NAME connection URL. */
export function parseCloudinaryUrl(value: string): CloudinaryConfig | null {
  if (!value || value.length > 2048) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "cloudinary:" || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== "/")) return null;
    const cloudName = parsed.hostname;
    const apiKey = decodeURIComponent(parsed.username);
    const apiSecret = decodeURIComponent(parsed.password);
    if (!/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret) return null;
    return { cloudName, apiKey, apiSecret };
  } catch {
    return null;
  }
}

/** Read the credential from Vault first; retain the old server secret as a safe migration fallback. */
export async function getCloudinaryConfig(service: Pick<SupabaseClient<any, "public", any>, "rpc">): Promise<CloudinaryConfig | null> {
  try {
    const { data, error } = await service.rpc("suly_service_get_cloudinary_url");
    if (!error && typeof data === "string" && data.trim()) return parseCloudinaryUrl(data);
  } catch { /* fall back only to a server-side environment secret */ }
  const value = Deno.env.get("cloudinary_URL") ?? Deno.env.get("CLOUDINARY_URL") ?? "";
  return parseCloudinaryUrl(value);
}
