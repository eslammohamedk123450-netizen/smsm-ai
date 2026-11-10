import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCloudinaryConfig } from "../_shared/cloudinary_config.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const config = getCloudinaryConfig();
    if (!config) return new Response(JSON.stringify({ error: "Cloudinary is not configured." }), { status: 503, headers: { "Content-Type": "application/json" } });
    const formData = await req.formData();
    const file = formData.get("file");
    const resourceType = formData.get("resource_type") || "image";
    
    if (!(file instanceof File)) return new Response("No file provided", { status: 400 });

    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = await generateSignature(timestamp, config.apiSecret);

    const cloudinaryFormData = new FormData();
    cloudinaryFormData.append("file", file);
    cloudinaryFormData.append("api_key", config.apiKey);
    cloudinaryFormData.append("timestamp", timestamp.toString());
    cloudinaryFormData.append("signature", signature);

    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/upload`;
    const response = await fetch(url, { method: "POST", body: cloudinaryFormData });
    const result = await response.json();

    if (result.error) throw new Error(result.error.message);

    return new Response(JSON.stringify({ secure_url: result.secure_url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

async function generateSignature(timestamp: number, apiSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`timestamp=${timestamp}${apiSecret}`);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
