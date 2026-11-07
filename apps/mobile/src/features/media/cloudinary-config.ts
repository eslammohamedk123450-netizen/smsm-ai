// Cloudinary holds every uploaded byte; Supabase only stores metadata and the
// resulting secure URL. Uploads are *unsigned*: the browser/device sends the
// upload preset, never an API secret, so nothing sensitive ships in the bundle.

export const CLOUDINARY_CLOUD_NAME = (process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "ejdshcla").trim();
export const CLOUDINARY_UPLOAD_PRESET = (process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "suly-ai").trim();

/** Uploads bigger than this are rejected before a single byte leaves the device. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
/** Cloudinary can take a while for video; give it room but never hang forever. */
export const UPLOAD_TIMEOUT_MS = 180_000;

/** Longest edge kept after compression. Full-resolution originals rarely matter in chat. */
export const IMAGE_MAX_DIMENSION = 1600;
/** JPEG quality used when re-encoding images on the device. */
export const IMAGE_QUALITY = 0.82;