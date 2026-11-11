import { getCloudinaryConfig } from "./cloudinary_config.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const encoder = new TextEncoder();
function hex(bytes: Uint8Array): string { return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function sha1(value: string): Promise<Uint8Array> { return new Uint8Array(await crypto.subtle.digest("SHA-1", encoder.encode(value))); }
function pathPart(value: string): string { return value.split("/").map((segment) => encodeURIComponent(segment)).join("/"); }

/** Returns a Cloudinary authenticated-delivery URL only when server secrets are configured. */
export async function cloudinaryAuthenticatedDeliveryUrl(asset: {
  bucket: string;
  object_key: string;
  metadata: Record<string, unknown> | null;
}, service: Pick<SupabaseClient<any, "public", any>, "rpc">): Promise<string | null> {
  const config = await getCloudinaryConfig(service);
  if (!config || !["image", "video", "raw"].includes(asset.bucket)) return null;
  if (!/^suly\/[0-9a-f-]{36}\/(chat|support|hims|general)\/[0-9a-f-]{36}$/i.test(asset.object_key)) return null;
  const metadata = asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
  const version = Number(metadata.version);
  if (!Number.isSafeInteger(version) || version < 1) return null;
  const format = String(metadata.format ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 16);
  const suffix = asset.bucket === "raw" ? "" : (format ? `.${format}` : "");
  const pathToSign = `v${version}/${asset.object_key}${suffix}`;
  const digest = await sha1(`${pathToSign}${config.apiSecret}`);
  const signature = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "").slice(0, 8);
  return `https://res.cloudinary.com/${encodeURIComponent(config.cloudName)}/${asset.bucket}/authenticated/s--${signature}--/v${version}/${pathPart(asset.object_key)}${suffix}`;
}
