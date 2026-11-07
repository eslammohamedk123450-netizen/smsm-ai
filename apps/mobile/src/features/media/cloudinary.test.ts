import { detectMediaKind, formatBytes, shouldCompressImage, uploadToCloudinary, type SignedCloudinaryUpload } from "./cloudinary";

const signedImage: SignedCloudinaryUpload = {
  cloud_name: "sample-cloud",
  api_key: "public-api-key",
  resource_type: "image",
  signed_fields: { overwrite: "false", public_id: "suly/user/chat/file", timestamp: "1700000000", type: "authenticated", signature: "signature" },
};

describe("detectMediaKind", () => {
  it("uses the mime type when present", () => {
    expect(detectMediaKind("image/png", "a.bin")).toBe("image");
    expect(detectMediaKind("video/mp4", "a.bin")).toBe("video");
    expect(detectMediaKind("application/pdf", "a.pdf")).toBe("raw");
  });
  it("falls back to the extension", () => {
    expect(detectMediaKind("", "lecture.MOV")).toBe("video");
    expect(detectMediaKind("", "shot.webp")).toBe("image");
    expect(detectMediaKind("", "notes.txt")).toBe("raw");
    expect(detectMediaKind("", "noextension")).toBe("raw");
  });
  it("ignores query strings on names", () => { expect(detectMediaKind("", "photo.jpg?size=large")).toBe("image"); });
});

describe("shouldCompressImage", () => {
  it("compresses normal images", () => {
    expect(shouldCompressImage("image/jpeg", "a.jpg")).toBe(true);
    expect(shouldCompressImage("image/webp", "a.webp")).toBe(true);
    expect(shouldCompressImage("", "a.png")).toBe(true);
  });
  it("keeps animated and vector files untouched", () => {
    expect(shouldCompressImage("image/gif", "a.gif")).toBe(false);
    expect(shouldCompressImage("", "a.svg")).toBe(false);
  });
  it("does not touch videos or documents", () => {
    expect(shouldCompressImage("video/mp4", "a.mp4")).toBe(false);
    expect(shouldCompressImage("application/pdf", "a.pdf")).toBe(false);
  });
});

describe("formatBytes", () => {
  it("renders human sizes", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });
});

describe("uploadToCloudinary", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("posts the server-signed authenticated form and maps asset metadata", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ public_id: "suly/user/chat/file", resource_type: "image", version: 7, bytes: 128, format: "png", original_filename: "demo.png" }),
    }) as unknown as typeof fetch;
    const result = await uploadToCloudinary({ uri: "file:///demo.png", name: "demo.png", type: "image/png" }, signedImage);
    expect(result.publicId).toBe("suly/user/chat/file");
    expect(result.bytes).toBe(128);
    expect(result.version).toBe(7);
    const [url, init] = (globalThis.fetch as unknown as jest.Mock).mock.calls[0];
    expect(String(url)).toContain("/v1_1/sample-cloud/image/upload");
    const form = (init as { body: FormData }).body;
    expect(String(form.get("signature"))).toBe("signature");
    expect(String(form.get("api_key"))).toBe("public-api-key");
    expect(String(form.get("type"))).toBe("authenticated");
    expect(form.get("upload_preset")).toBeNull();
    expect(form.get("file")).toBeTruthy();
  });

  it("turns a Cloudinary rejection into an Arabic error", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: "Upload preset not found" } }) }) as unknown as typeof fetch;
    await expect(uploadToCloudinary({ uri: "file:///a.jpg", name: "a.jpg", type: "image/jpeg" }, signedImage)).rejects.toThrow("رفض Cloudinary");
  });
});
