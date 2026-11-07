// Cloudinary credentials are server-side only. The client receives short-lived
// upload signatures from the authenticated Supabase media-gateway function.
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const UPLOAD_TIMEOUT_MS = 180_000;
export const IMAGE_MAX_DIMENSION = 1600;
export const IMAGE_QUALITY = 0.82;
