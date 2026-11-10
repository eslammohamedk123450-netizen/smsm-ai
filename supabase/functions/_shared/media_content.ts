import { getDocument } from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import { strFromU8, unzipSync } from "npm:fflate@0.8.2";

export const MAX_EXTRACTED_DOCUMENT_CHARS = 14000;
const MAX_PDF_PAGES = 40;

export class MediaProcessingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MediaProcessingError";
    this.code = code;
  }
}

function validateDocxCentralDirectory(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const start = Math.max(0, bytes.length - 65557);
  let endOfCentralDirectory = -1;
  for (let index = bytes.length - 22; index >= start; index--) {
    if (view.getUint32(index, true) === 0x06054b50) { endOfCentralDirectory = index; break; }
  }
  if (endOfCentralDirectory < 0) throw new MediaProcessingError("invalid_docx", "ملف Word المضغوط غير صالح.");
  const entries = view.getUint16(endOfCentralDirectory + 10, true);
  let offset = view.getUint32(endOfCentralDirectory + 16, true);
  if (entries < 1 || entries > 1024 || offset >= bytes.length) throw new MediaProcessingError("invalid_docx", "بنية ملف Word غير مدعومة.");
  const decoder = new TextDecoder();
  let foundDocument = false;
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new MediaProcessingError("invalid_docx", "بنية ملف Word غير مدعومة.");
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) throw new MediaProcessingError("invalid_docx", "بنية ملف Word غير مدعومة.");
    const name = decoder.decode(bytes.subarray(nameStart, nameEnd));
    if (name === "word/document.xml") {
      if (uncompressedSize === 0xffffffff || uncompressedSize > 4 * 1024 * 1024) throw new MediaProcessingError("invalid_docx", "محتوى ملف Word كبير جدًا للتحليل.");
      foundDocument = true;
    }
    offset = nameEnd + extraLength + commentLength;
  }
  if (!foundDocument) throw new MediaProcessingError("invalid_docx", "ملف Word لا يحتوي على مستند DOCX قابل للقراءة.");
}

export async function fetchCloudinaryBytes(urlValue: string, maxBytes: number): Promise<Uint8Array> {
  let url: URL;
  try { url = new URL(urlValue); } catch { throw new MediaProcessingError("invalid_media_url", "رابط المرفق غير صالح."); }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password || url.port) {
    throw new MediaProcessingError("untrusted_media_url", "تعذر التحقق من مصدر المرفق.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url.toString(), { method: "GET", redirect: "error", signal: controller.signal });
    if (!response.ok) throw new MediaProcessingError("media_download_failed", `تعذر تنزيل المرفق (HTTP ${response.status}).`);
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new MediaProcessingError("media_too_large", "حجم الملف أكبر من الحد المستخدم للتحليل.");
    const reader = response.body?.getReader();
    if (!reader) throw new MediaProcessingError("media_body_missing", "محتوى الملف غير متاح للتحليل.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new MediaProcessingError("media_too_large", "حجم الملف أكبر من الحد المستخدم للتحليل.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    if (error instanceof MediaProcessingError) throw error;
    throw new MediaProcessingError("media_download_failed", "تعذر تنزيل المرفق بأمان.");
  } finally {
    clearTimeout(timer);
  }
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

export function extractDocxText(bytes: Uint8Array, maxChars = MAX_EXTRACTED_DOCUMENT_CHARS): string {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new MediaProcessingError("invalid_docx", "ملف Word غير صالح أو ليس بصيغة DOCX.");
  validateDocxCentralDirectory(bytes);
  let documentXml: Uint8Array | undefined;
  try {
    const files = unzipSync(bytes, { filter: (file) => file.name === "word/document.xml" });
    documentXml = files["word/document.xml"];
  } catch {
    throw new MediaProcessingError("invalid_docx", "تعذر قراءة ملف Word.");
  }
  if (!documentXml || documentXml.length > 4 * 1024 * 1024) throw new MediaProcessingError("invalid_docx", "تعذر العثور على نص Word أو أن محتواه كبير جدًا.");
  const xml = strFromU8(documentXml)
    .replace(/<w:tab\b[^>]*\/?\s*>/g, "\t")
    .replace(/<\/w:p\s*>/g, "\n")
    .replace(/<\/w:tr\s*>/g, "\n")
    .replace(/<\/w:tc\s*>/g, "\t")
    .replace(/<[^>]+>/g, "");
  const text = decodeXmlText(xml).replace(/[\t ]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  if (!text) throw new MediaProcessingError("empty_docx", "لا يحتوي ملف Word على نص قابل للقراءة.");
  return text.slice(0, maxChars);
}

export async function extractPdfText(bytes: Uint8Array, maxChars = MAX_EXTRACTED_DOCUMENT_CHARS): Promise<string> {
  if (bytes.length < 5 || new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 1024))).indexOf("%PDF-") < 0) {
    throw new MediaProcessingError("invalid_pdf", "الملف المرفق ليس PDF صالحًا.");
  }
  let document: any = null;
  try {
    const task = getDocument({ data: bytes, useSystemFonts: false, isEvalSupported: false, disableFontFace: true, verbosity: 0 });
    document = await task.promise;
    const pageLimit = Math.min(document.numPages, MAX_PDF_PAGES);
    const pages: string[] = [];
    let totalChars = 0;
    for (let pageNumber = 1; pageNumber <= pageLimit && totalChars < maxChars; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: { str?: string }) => item.str ?? "").filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      if (pageText) {
        const entry = `[صفحة ${pageNumber}]\n${pageText}`;
        pages.push(entry.slice(0, Math.max(0, maxChars - totalChars)));
        totalChars += entry.length;
      }
    }
    const text = pages.join("\n\n").slice(0, maxChars).trim();
    if (!text) throw new MediaProcessingError("scanned_pdf", "لم يُعثر على نص داخل PDF؛ يبدو أنه ممسوح ضوئيًا ويحتاج OCR.");
    return text;
  } catch (error) {
    if (error instanceof MediaProcessingError) throw error;
    throw new MediaProcessingError("pdf_extract_failed", "تعذر استخراج النص من PDF.");
  } finally {
    await document?.destroy().catch(() => undefined);
  }
}
