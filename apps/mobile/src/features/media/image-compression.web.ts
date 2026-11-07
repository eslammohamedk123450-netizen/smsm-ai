// Web image compression: decode, downscale to the longest edge, re-encode as
// JPEG. Runs entirely in the browser, so no server work and no extra traffic.

import { IMAGE_MAX_DIMENSION, IMAGE_QUALITY } from "./cloudinary-config";
import type { UploadFilePart } from "./cloudinary";

export interface CompressOptions {
  width?: number;
  maxDimension?: number;
  quality?: number;
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "image"}.jpg`;
}

export async function compressImageForUpload(file: UploadFilePart, options: CompressOptions = {}): Promise<UploadFilePart> {
  const source = file.blob;
  if (!source || typeof document === "undefined" || typeof createImageBitmap === "undefined") return file;
  const maxDimension = options.maxDimension ?? IMAGE_MAX_DIMENSION;
  const quality = options.quality ?? IMAGE_QUALITY;
  try {
    const bitmap = await createImageBitmap(source);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close?.(); return file; }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!compressed || compressed.size === 0 || compressed.size >= source.size) return file;
    return { blob: compressed, name: jpegName(file.name), type: "image/jpeg" };
  } catch {
    return file;
  }
}