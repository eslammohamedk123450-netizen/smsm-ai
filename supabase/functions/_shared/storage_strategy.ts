// Global infrastructure: storage strategy.
//
// Business logic never talks to a bucket directly. It asks for a driver and
// hands over bytes; the driver decides where the bytes live. Today that is
// Cloudflare R2 (S3-compatible, SigV4 signed with WebCrypto, no SDK
// dependency); swapping or adding a provider means adding one driver here and
// nothing else in the app.

import { buildPublicUrl } from "./storage_keys.ts";

export interface StoragePutInput {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
}

export interface StoragePutResult {
  provider: string;
  bucket: string;
  objectKey: string;
  url: string;
  size: number;
}

export interface StorageDriver {
  readonly provider: string;
  readonly bucket: string;
  put(input: StoragePutInput): Promise<StoragePutResult>;
}

export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

export class StorageUploadError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "StorageUploadError";
    this.status = status;
  }
}

const encoder = new TextEncoder();

/**
 * Copies bytes into a view backed by a plain ArrayBuffer. WebCrypto and fetch
 * accept only ArrayBuffer-backed views, while callers may hand over views whose
 * buffer type is wider (SharedArrayBuffer), so the boundary normalizes once.
 */
function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = toBufferSource(typeof data === "string" ? encoder.encode(data) : data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await crypto.subtle.importKey("raw", toBufferSource(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return new Uint8Array(signature);
}

/** RFC 3986 encoding per path segment, as required by SigV4 canonical URIs. */
function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function amzDateParts(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  endpoint?: string;
  region?: string;
}

export function readR2Config(env: { get(name: string): string | undefined }): R2Config | null {
  const accountId = env.get("R2_ACCOUNT_ID")?.trim() ?? "";
  const accessKeyId = env.get("R2_ACCESS_KEY_ID")?.trim() ?? "";
  const secretAccessKey = env.get("R2_SECRET_ACCESS_KEY")?.trim() ?? "";
  const bucket = env.get("R2_BUCKET")?.trim() ?? "";
  const publicBaseUrl = env.get("R2_PUBLIC_BASE_URL")?.trim() ?? "";
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return null;
  if (!/^https:\/\//i.test(publicBaseUrl)) return null;
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl,
    endpoint: env.get("R2_ENDPOINT")?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
    region: env.get("R2_REGION")?.trim() || "auto",
  };
}

export class R2StorageDriver implements StorageDriver {
  readonly provider = "r2";
  readonly bucket: string;
  private readonly config: R2Config;

  constructor(config: R2Config) {
    this.config = config;
    this.bucket = config.bucket;
  }

  private async sign(method: string, canonicalUri: string, payloadHash: string, contentType: string, cacheControl?: string): Promise<Headers> {
    const url = new URL(this.config.endpoint ?? "");
    const { amzDate, dateStamp } = amzDateParts(new Date());
    const scope = `${dateStamp}/${this.config.region ?? "auto"}/s3/aws4_request`;
    const canonicalHeaders = [
      `host:${url.host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      "",
    ].join("\n");
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");
    let signingKey: Uint8Array<ArrayBuffer> = toBufferSource(encoder.encode(`AWS4${this.config.secretAccessKey}`));
    for (const step of [dateStamp, this.config.region ?? "auto", "s3", "aws4_request"]) {
      signingKey = await hmacSha256(signingKey, step);
    }
    const signature = [...await hmacSha256(signingKey, stringToSign)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const headers = new Headers({
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Authorization": `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": contentType,
    });
    if (cacheControl) headers.set("Cache-Control", cacheControl);
    return headers;
  }

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const key = input.key.replace(/^\/+/, "");
    const canonicalUri = `/${encodePathSegment(this.bucket)}/${key.split("/").map(encodePathSegment).join("/")}`;
    const payloadHash = await sha256Hex(input.body);
    const headers = await this.sign("PUT", canonicalUri, payloadHash, input.contentType, input.cacheControl);
    const endpoint = new URL(this.config.endpoint ?? "");
    const response = await fetch(`${endpoint.origin}${canonicalUri}`, {
      method: "PUT",
      headers,
      body: toBufferSource(input.body),
      redirect: "error",
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new StorageUploadError(response.status, `Object storage rejected the upload (HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}).`);
    }
    return {
      provider: this.provider,
      bucket: this.bucket,
      objectKey: key,
      url: buildPublicUrl(this.config.publicBaseUrl, key),
      size: input.body.byteLength,
    };
  }
}

/**
 * Returns the configured driver. Throws StorageNotConfiguredError when no
 * external store is configured: files must never silently fall back to being
 * stored inside Supabase.
 */
export function resolveStorageDriver(env: { get(name: string): string | undefined } = Deno.env): StorageDriver {
  const r2 = readR2Config(env);
  if (r2) return new R2StorageDriver(r2);
  throw new StorageNotConfiguredError(
    "External object storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_BASE_URL.",
  );
}

export function isStorageConfigured(env: { get(name: string): string | undefined } = Deno.env): boolean {
  return readR2Config(env) !== null;
}
