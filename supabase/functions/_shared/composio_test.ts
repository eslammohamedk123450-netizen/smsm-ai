import { detectComposioToolkitRequest, isMultiToolkitComposioRequest } from "./composio.ts";

Deno.test("detects Arabic Gmail lookup as a read, not a write", () => {
  const request = detectComposioToolkitRequest("دورلي على آخر ايميل من الشركة");
  if (request?.toolkit !== "gmail" || request.intent !== "read") {
    throw new Error(`Expected Gmail read, got ${JSON.stringify(request)}`);
  }
});

Deno.test("detects an explicit email send as a Gmail write", () => {
  const request = detectComposioToolkitRequest("ابعت ايميل إلى أحمد أقول له الاجتماع الساعة ٣");
  if (request?.toolkit !== "gmail" || request.intent !== "write") {
    throw new Error(`Expected Gmail write, got ${JSON.stringify(request)}`);
  }
});

Deno.test("detects an upload request as a Google Drive write", () => {
  const request = detectComposioToolkitRequest("ارفع الملف ده على Google Drive");
  if (request?.toolkit !== "googledrive" || request.intent !== "write") {
    throw new Error(`Expected Google Drive write, got ${JSON.stringify(request)}`);
  }
});

Deno.test("detects issue creation as a GitHub write", () => {
  const request = detectComposioToolkitRequest("Create an issue in my GitHub repository");
  if (request?.toolkit !== "github" || request.intent !== "write") {
    throw new Error(`Expected GitHub write, got ${JSON.stringify(request)}`);
  }
});

Deno.test("rejects one action that targets multiple connected-app toolkits", () => {
  const text = "Find an email in Gmail and create an issue on GitHub";
  if (!isMultiToolkitComposioRequest(text)) throw new Error("Expected a multi-toolkit request");
  if (detectComposioToolkitRequest(text) !== null) throw new Error("A multi-toolkit request must not dispatch to one connector");
});
