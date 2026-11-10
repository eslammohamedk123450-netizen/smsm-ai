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

/** Read the configured URL without exposing credentials to client code. */
export function getCloudinaryConfig(): CloudinaryConfig | null {
  const value = Deno.env.get("cloudinary_URL") ?? Deno.env.get("CLOUDINARY_URL") ?? "";
  return parseCloudinaryUrl(value);
}
