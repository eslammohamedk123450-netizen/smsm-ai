export type ModelCapability = "chat" | "vision" | "pdf" | "word" | "video";

export interface ModelCapabilities {
  chat: boolean;
  vision: boolean;
  pdf: boolean;
  word: boolean;
  video: boolean;
}

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  chat: true,
  vision: false,
  pdf: false,
  word: false,
  video: false,
};

export function parseModelCapabilities(value: unknown): ModelCapabilities {
  let parsed: Record<string, unknown> = {};
  if (typeof value === "string") {
    try {
      const candidate = JSON.parse(value);
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) parsed = candidate as Record<string, unknown>;
    } catch {
      return { ...DEFAULT_CAPABILITIES };
    }
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    parsed = value as Record<string, unknown>;
  }
  return {
    chat: parsed.chat !== false,
    vision: parsed.vision === true,
    pdf: parsed.pdf === true,
    word: parsed.word === true,
    video: parsed.video === true,
  };
}

export function supportsModelCapabilities(value: unknown, required: readonly ModelCapability[]): boolean {
  const capabilities = parseModelCapabilities(value);
  return required.every((capability) => capabilities[capability]);
}

export function capabilityForMime(mimeType: string, filename = ""): ModelCapability | null {
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  const extension = filename.toLowerCase().split("?")[0].split(".").pop() ?? "";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif"].includes(extension)) return "vision";
  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "m4v"].includes(extension)) return "video";
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (mime.includes("wordprocessingml") || mime === "application/msword" || ["docx", "doc"].includes(extension)) return "word";
  if (mime.startsWith("text/") || mime === "application/json" || ["txt", "md", "csv", "json"].includes(extension)) return "chat";
  return null;
}
