import { capabilityForMime, parseModelCapabilities, supportsModelCapabilities } from "./model_capabilities.ts";

Deno.test("legacy model capabilities remain text-chat capable by default", () => {
  const capabilities = parseModelCapabilities('{"streaming":true}');
  if (!capabilities.chat || capabilities.vision || capabilities.pdf || capabilities.word || capabilities.video) {
    throw new Error("Legacy catalog entries must remain text-only unless a capability is explicitly enabled.");
  }
});

Deno.test("multimodal routing requires every declared capability", () => {
  const model = '{"chat":true,"vision":true,"pdf":true,"word":false,"video":false}';
  if (!supportsModelCapabilities(model, ["chat", "vision", "pdf"])) throw new Error("Expected compatible image/PDF model.");
  if (supportsModelCapabilities(model, ["chat", "vision", "word"])) throw new Error("A model without Word support must not be selected.");
  if (supportsModelCapabilities(null, ["vision"])) throw new Error("Legacy text models must not receive image requests.");
});

Deno.test("file MIME/name identifies its routing capability", () => {
  const cases: Array<[string, string, string | null]> = [
    ["image/jpeg", "photo.jpg", "vision"],
    ["application/pdf", "report.pdf", "pdf"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "report.docx", "word"],
    ["video/mp4", "clip.mp4", "video"],
    ["text/plain", "notes.txt", "chat"],
    ["application/octet-stream", "archive.bin", null],
  ];
  for (const [mime, name, expected] of cases) {
    if (capabilityForMime(mime, name) !== expected) throw new Error(`Unexpected capability for ${mime} ${name}.`);
  }
});
