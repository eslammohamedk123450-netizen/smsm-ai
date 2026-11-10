import { strToU8, zipSync } from "npm:fflate@0.8.2";
import { extractDocxText, extractPdfText, MediaProcessingError } from "./media_content.ts";

Deno.test("extracts paragraphs, table text, and XML entities from DOCX", () => {
  const xml = '<w:document xmlns:w="urn:test"><w:body><w:p><w:r><w:t>أهلاً &amp; مرحباً</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>صف أول</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
  const bytes = zipSync({ "word/document.xml": strToU8(xml) });
  const text = extractDocxText(bytes);
  if (!text.includes("أهلاً & مرحباً") || !text.includes("صف أول")) throw new Error(`Unexpected DOCX extraction: ${text}`);
});

Deno.test("extracts text from a valid PDF", async () => {
  const encoder = new TextEncoder();
  const stream = "BT /F1 18 Tf 30 80 Td (Hello PDF routing) Tj ET\n";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) { offsets.push(encoder.encode(pdf).length); pdf += object; }
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const text = await extractPdfText(encoder.encode(pdf));
  if (!text.includes("Hello PDF routing")) throw new Error(`Unexpected PDF extraction: ${text}`);
});

Deno.test("rejects files that are not PDFs", async () => {
  try {
    await extractPdfText(new TextEncoder().encode("not a PDF"));
    throw new Error("Expected non-PDF input to be rejected.");
  } catch (error) {
    if (!(error instanceof MediaProcessingError) || error.code !== "invalid_pdf") throw error;
  }
});
