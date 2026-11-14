export type ModelCapability =
  | "chat"
  | "read"
  | "write"
  | "vision"
  | "audio"
  | "convert"
  | "tools"
  | "pdf"
  | "word"
  | "video"
  | "gmail"
  | "google_drive"
  | "github";

export interface ModelCapabilities {
  chat: boolean;
  read: boolean;
  write: boolean;
  vision: boolean;
  audio: boolean;
  convert: boolean;
  tools: boolean;
  pdf: boolean;
  word: boolean;
  video: boolean;
  gmail: boolean;
  google_drive: boolean;
  github: boolean;
}

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  chat: true,
  read: true,
  write: false,
  vision: false,
  audio: false,
  convert: false,
  tools: false,
  pdf: false,
  word: false,
  video: false,
  gmail: false,
  google_drive: false,
  github: false,
};

export function parseModelCapabilities(value: unknown): ModelCapabilities {
  let parsed: Record<string, unknown> = {};
  if (typeof value === "string") {
    try {
      const candidate = JSON.parse(value);
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      return { ...DEFAULT_CAPABILITIES };
    }
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    parsed = value as Record<string, unknown>;
  }
  return {
    chat: parsed.chat !== false,
    read: parsed.read !== false,
    write: parsed.write === true,
    vision: parsed.vision === true,
    audio: parsed.audio === true,
    convert: parsed.convert === true,
    tools: parsed.tools === true,
    pdf: parsed.pdf === true,
    word: parsed.word === true,
    video: parsed.video === true,
    gmail: parsed.gmail === true,
    google_drive: parsed.google_drive === true,
    github: parsed.github === true,
  };
}

export function supportsModelCapabilities(
  value: unknown,
  required: readonly ModelCapability[]
): boolean {
  const capabilities = parseModelCapabilities(value);
  return required.every((capability) => capabilities[capability]);
}

export function capabilityForMime(mimeType: string, filename = ""): ModelCapability | null {
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  const extension = filename.toLowerCase().split("?")[0].split(".").pop() ?? "";
  if (
    mime.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif"].includes(extension)
  ) {
    return "vision";
  }
  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "m4a", "ogg", "webm", "flac", "aac"].includes(extension)
  ) {
    return "audio";
  }
  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "m4v"].includes(extension)) {
    return "video";
  }
  if (mime === "application/pdf" || extension === "pdf") return "pdf";
  if (
    mime.includes("wordprocessingml") ||
    mime === "application/msword" ||
    ["docx", "doc"].includes(extension)
  ) {
    return "word";
  }
  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    ["txt", "md", "csv", "json"].includes(extension)
  ) {
    return "chat";
  }
  return null;
}
