// Native image compression. Re-encoding before upload keeps Cloudinary usage
// low and makes the upload noticeably faster on mobile data.

import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { IMAGE_MAX_DIMENSION, IMAGE_QUALITY } from "./cloudinary-config";
import type { UploadFilePart } from "./cloudinary";

export interface CompressOptions {
  /** Source width reported by the picker, when known. */
  width?: number;
  maxDimension?: number;
  quality?: number;
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "image"}.jpg`;
}

export async function compressImageForUpload(file: UploadFilePart, options: CompressOptions = {}): Promise<UploadFilePart> {
  const maxDimension = options.maxDimension ?? IMAGE_MAX_DIMENSION;
  if (!file.uri) return file;
  const actions = options.width && options.width > maxDimension ? [{ resize: { width: maxDimension } }] : [];
  try {
    const result = await manipulateAsync(file.uri, actions, {
      compress: options.quality ?? IMAGE_QUALITY,
      format: SaveFormat.JPEG,
    });
    return { uri: result.uri, name: jpegName(file.name), type: "image/jpeg" };
  } catch {
    // A format the native decoder cannot handle (e.g. HEIC on old devices) is
    // uploaded untouched rather than failing the whole action.
    return file;
  }
}