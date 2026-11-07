import {
  DEFAULT_MAX_UPLOAD_BYTES,
  buildObjectKey,
  buildPublicUrl,
  checkUploadSize,
  extensionFor,
  isAllowedMimeType,
  isSafeObjectKey,
  sanitizeFilename,
} from "../../../../../supabase/functions/_shared/storage_keys";

describe("isAllowedMimeType", () => {
  it("accepts images, video, audio, documents", () => {
    expect(isAllowedMimeType("image/png")).toBe(true);
    expect(isAllowedMimeType("video/mp4")).toBe(true);
    expect(isAllowedMimeType("audio/mpeg")).toBe(true);
    expect(isAllowedMimeType("application/pdf")).toBe(true);
    expect(isAllowedMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
  });

  it("strips parameters before checking", () => {
    expect(isAllowedMimeType("text/plain; charset=utf-8")).toBe(true);
  });

  it("rejects executable and script content", () => {
    expect(isAllowedMimeType("text/html")).toBe(false);
    expect(isAllowedMimeType("image/svg+xml")).toBe(false);
    expect(isAllowedMimeType("application/x-msdownload")).toBe(false);
    expect(isAllowedMimeType("")).toBe(false);
    expect(isAllowedMimeType(null)).toBe(false);
  });
});

describe("checkUploadSize", () => {
  it("rejects empty and oversized payloads", () => {
    expect(checkUploadSize(0)).toEqual({ ok: false, reason: "empty" });
    expect(checkUploadSize(DEFAULT_MAX_UPLOAD_BYTES + 1)).toEqual({ ok: false, reason: "too_large" });
  });

  it("accepts a normal file", () => {
    expect(checkUploadSize(1024)).toEqual({ ok: true });
    expect(checkUploadSize(DEFAULT_MAX_UPLOAD_BYTES)).toEqual({ ok: true });
  });

  it("honours a custom limit", () => {
    expect(checkUploadSize(2048, 1024)).toEqual({ ok: false, reason: "too_large" });
  });
});

describe("sanitizeFilename", () => {
  it("removes path traversal and separators", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\lecture 1.pdf")).toBe("lecture_1.pdf");
  });

  it("keeps unicode content but drops unsafe characters", () => {
    expect(sanitizeFilename("محاضرة الشبكات.pdf")).toBe("file.pdf");
    expect(sanitizeFilename("lecture-1_notes.pdf")).toBe("lecture-1_notes.pdf");
  });

  it("falls back when nothing is left", () => {
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename(null)).toBe("file");
    expect(sanitizeFilename("....")).toBe("file");
  });

  it("truncates very long names", () => {
    expect(sanitizeFilename(`${"a".repeat(400)}.pdf`).length).toBeLessThanOrEqual(160);
  });
});

describe("buildObjectKey", () => {
  const now = new Date(Date.UTC(2026, 10, 7));

  it("namespaces by feature, month, and user", () => {
    expect(buildObjectKey({
      featureKey: "hims",
      userId: "22222222-2222-2222-2222-222222222222",
      filename: "lecture 1.pdf",
      uniqueId: "abc-123",
      now,
    })).toBe("hims/2026/11/22222222-2222-2222-2222-222222222222/abc-123-lecture_1.pdf");
  });

  it("sanitizes every segment", () => {
    const key = buildObjectKey({
      featureKey: "hi ms/../x",
      userId: "../evil",
      filename: "../../secret.txt",
      uniqueId: "id",
      now,
    });
    expect(isSafeObjectKey(key)).toBe(true);
    expect(key).not.toContain("..");
  });

  it("produces keys accepted by the safety check", () => {
    expect(isSafeObjectKey(buildObjectKey({
      featureKey: "chat",
      userId: "u1",
      filename: "a.png",
      uniqueId: "1",
      now,
    }))).toBe(true);
  });
});

describe("isSafeObjectKey", () => {
  it("rejects traversal, absolute paths, and empty segments", () => {
    expect(isSafeObjectKey("../a/b.png")).toBe(false);
    expect(isSafeObjectKey("/a/b.png")).toBe(false);
    expect(isSafeObjectKey("a//b.png")).toBe(false);
    expect(isSafeObjectKey("")).toBe(false);
    expect(isSafeObjectKey(`${"a".repeat(1000)}`)).toBe(false);
  });

  it("accepts a well formed key", () => {
    expect(isSafeObjectKey("hims/2026/11/user/abc-lecture.pdf")).toBe(true);
  });
});

describe("buildPublicUrl", () => {
  it("joins without duplicate slashes", () => {
    expect(buildPublicUrl("https://cdn.example.test/", "/hims/a.pdf")).toBe("https://cdn.example.test/hims/a.pdf");
    expect(buildPublicUrl("https://cdn.example.test", "hims/a.pdf")).toBe("https://cdn.example.test/hims/a.pdf");
  });
});

describe("extensionFor", () => {
  it("prefers the mime type", () => {
    expect(extensionFor("image/jpeg", "photo.unknown")).toBe("jpg");
    expect(extensionFor("application/pdf")).toBe("pdf");
  });

  it("falls back to the filename, then to bin", () => {
    expect(extensionFor("application/x-custom", "notes.md")).toBe("md");
    expect(extensionFor("application/x-custom", "noext")).toBe("bin");
  });
});
