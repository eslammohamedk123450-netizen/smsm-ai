import { buildUploadUrl, detectMediaKind, formatBytes, shouldCompressImage } from "./cloudinary";

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

  it("ignores query strings on names", () => {
    expect(detectMediaKind("", "photo.jpg?size=large")).toBe("image");
  });
});

describe("buildUploadUrl", () => {
  it("targets the unsigned endpoint for the configured cloud", () => {
    expect(buildUploadUrl("image")).toContain("api.cloudinary.com");
    expect(buildUploadUrl("image")).toContain("/image/upload");
    expect(buildUploadUrl("video")).toContain("/video/upload");
    expect(buildUploadUrl("raw")).toContain("/raw/upload");
  });
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

  it("posts an unsigned form and maps the secure url", async () => {
    const secureUrl = "https://res.cloudinary.com/ejdshcla/image/upload/v1/demo.png";
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ secure_url: secureUrl, public_id: "demo", resource_type: "image", bytes: 128, format: "png", original_filename: "demo.png" }),
    }) as unknown as typeof fetch;

    const result = await uploadToCloudinary({ uri: "file:///demo.png", name: "demo.png", type: "image/png" }, "image");
    expect(result.secureUrl).toBe(secureUrl);
    expect(result.publicId).toBe("demo");
    expect(result.bytes).toBe(128);

    const [url, init] = (globalThis.fetch as unknown as jest.Mock).mock.calls[0];
    expect(String(url)).toContain("/image/upload");
    const form = (init as { body: FormData }).body;
    expect(String(form.get("upload_preset"))).toBe("suly-ai");
    expect(form.get("file")).toBeTruthy();
  });

  it("turns a Cloudinary rejection into an Arabic error", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Upload preset not found" } }),
    }) as unknown as typeof fetch;

    await expect(uploadToCloudinary({ uri: "file:///a.jpg", name: "a.jpg", type: "image/jpeg" }, "image"))
      .rejects.toThrow(/upload preset/i);
  });
});
import { uploadToCloudinary } from "./cloudinary";
