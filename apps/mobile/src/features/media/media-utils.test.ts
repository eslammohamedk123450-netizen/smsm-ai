import { detectMediaKind, formatBytes, shouldCompressImage, uploadToStorage, MediaUploadError } from "./media-utils";

describe("media utilities", () => {
  test("detects common image, video, and document types", () => {
    expect(detectMediaKind("image/jpeg", "photo.jpg")).toBe("image");
    expect(detectMediaKind("video/mp4", "clip.mp4")).toBe("video");
    expect(detectMediaKind("application/pdf", "report.pdf")).toBe("raw");
  });

  test("compresses supported images but leaves GIF and SVG untouched", () => {
    expect(shouldCompressImage("image/jpeg", "photo.jpg")).toBe(true);
    expect(shouldCompressImage("image/gif", "animation.gif")).toBe(false);
    expect(shouldCompressImage("image/svg+xml", "graphic.svg")).toBe(false);
  });

  test("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  test("uploads file bytes using the signed storage path and token", async () => {
    const uploadToSignedUrl = jest.fn().mockResolvedValue({ error: null });
    const storage = { from: jest.fn(() => ({ uploadToSignedUrl })) };
    await uploadToStorage({ blob: new Blob(["image"]), name: "image.png", type: "image/png" }, { bucket: "suly-media", object_key: "user/general/image.png", token: "temporary" }, storage);
    expect(storage.from).toHaveBeenCalledWith("suly-media");
    expect(uploadToSignedUrl).toHaveBeenCalledWith("user/general/image.png", "temporary", expect.any(Blob), { contentType: "image/png", upsert: false });
  });

  test("converts upload failures to a user-safe error", async () => {
    const storage = { from: () => ({ uploadToSignedUrl: jest.fn().mockResolvedValue({ error: { message: "private backend detail" } }) }) };
    await expect(uploadToStorage({ blob: new Blob(["image"]), name: "image.png", type: "image/png" }, { bucket: "suly-media", object_key: "user/general/image.png", token: "temporary" }, storage)).rejects.toMatchObject({
      code: "upload_failed",
      message: "تعذر رفع الملف. تحقق من الاتصال وحاول مرة أخرى.",
    } satisfies Partial<MediaUploadError>);
  });
});
