import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Replaced by media-gateway, which authenticates the user, signs an authenticated
// Cloudinary upload, verifies ownership/context, and registers the asset.
serve((req) => new Response(JSON.stringify({
  error: "This upload endpoint is retired. Use the authenticated media-gateway.",
}), {
  status: req.method === "POST" ? 410 : 405,
  headers: { "Content-Type": "application/json; charset=utf-8" },
}));
