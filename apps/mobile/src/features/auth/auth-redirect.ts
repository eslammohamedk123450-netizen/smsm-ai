export function buildWebAuthRedirect(origin: string, basePath = ""): string {
  let normalizedOrigin: string;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error("Unsupported auth origin");
    }
    normalizedOrigin = parsed.origin;
  } catch {
    throw new Error("Invalid web auth origin");
  }

  const trimmedBase = basePath.trim();
  if (trimmedBase && (!/^\/[a-zA-Z0-9/_-]*$/.test(trimmedBase) || trimmedBase.includes("//"))) {
    throw new Error("Invalid web base path");
  }
  const normalizedBase = trimmedBase.replace(/\/+$/, "");
  return `${normalizedOrigin}${normalizedBase}/auth/callback`;
}
