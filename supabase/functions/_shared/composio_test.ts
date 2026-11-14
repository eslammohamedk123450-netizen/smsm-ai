import { composioToolCatalogParams, connectorSearchQuery, detectComposioMultiReadRequest, detectComposioToolkitRequest, detectComposioToolkitRequestFromConversation, hasExplicitComposioExecutionSuccess, hasVerifiableComposioReadResult, isComposioToolAllowed, isGmailTaglessToolAllowlisted, isMultiToolkitComposioRequest, shapeComposioReadResult } from "./composio.ts";

Deno.test("allows only the exact Gmail fallback tool names without Composio tags", () => {
  if (!isGmailTaglessToolAllowlisted("GMAIL_GET_MESSAGE", "read")) throw new Error("GMAIL_GET_MESSAGE should be allowed as a tagless read");
  if (!isGmailTaglessToolAllowlisted("GMAIL_SEND_MESSAGE", "write")) throw new Error("GMAIL_SEND_MESSAGE should be allowed as a tagless write");
  if (isGmailTaglessToolAllowlisted("GMAIL_DELETE_MESSAGE", "write")) throw new Error("Unlisted Gmail writes must remain rejected");
  if (isGmailTaglessToolAllowlisted("GMAIL_SEND_MESSAGE", "read")) throw new Error("A write tool must not be allowed as a read");
  if (!isComposioToolAllowed("gmail", "GMAIL_GET_MESSAGE", "read")) throw new Error("GMAIL_GET_MESSAGE must satisfy the Gmail read safety pattern");
  if (!isComposioToolAllowed("gmail", "GMAIL_SEND_MESSAGE", "write")) throw new Error("GMAIL_SEND_MESSAGE must satisfy the Gmail write safety pattern");
  if (isComposioToolAllowed("gmail", "GMAIL_SEND_MESSAGE", "read")) throw new Error("A send action must not satisfy the Gmail read safety pattern");
  if (isGmailTaglessToolAllowlisted("GMAIL_GET_MESSAGE", "write")) throw new Error("A read tool must not be allowed as a write");
});

Deno.test("searches Composio for the canonical Gmail email-fetch action", () => {
  const query = connectorSearchQuery("gmail", "Tell me about the latest email from Mim");
  if (!query.includes("GMAIL_FETCH_EMAILS") || !query.toLowerCase().includes("fetch up to")) {
    throw new Error(`Expected canonical Gmail fetch action in catalog query, got ${query}`);
  }
  if (!query.includes("latest email from Mim")) throw new Error("The original Gmail request should be preserved in the tool-search query");
  if (!isGmailTaglessToolAllowlisted("GMAIL_FETCH_EMAILS", "read")) throw new Error("Canonical fetch action should be allowed without tags for reads");
  if (isGmailTaglessToolAllowlisted("GMAIL_FETCH_EMAILS", "write")) throw new Error("Fetch action must not be allowed as a write");
});

Deno.test("requests GMAIL_FETCH_EMAILS directly from the Composio catalog", () => {
  const gmail = composioToolCatalogParams("gmail", "Tell me the latest email from Mim");
  if (gmail.tool_slugs !== "GMAIL_FETCH_EMAILS") throw new Error(`Expected direct Gmail slug lookup, got ${JSON.stringify(gmail)}`);
  if (gmail.query !== undefined) throw new Error("Gmail catalog lookup must not depend on a free-text query");
  if (gmail.limit !== "20") throw new Error("The Gmail tool catalog page should keep a fixed page limit, independent of message count");
  const many = composioToolCatalogParams("gmail", "هات آخر 10 رسائل فاشلة");
  if (many.limit !== "20" || !connectorSearchQuery("gmail", "هات آخر 10 رسائل فاشلة").includes("no more than 10")) {
    throw new Error(`The catalog limit must not be confused with the requested message count: ${JSON.stringify(many)}`);
  }

  const drive = composioToolCatalogParams("googledrive", "Find the latest file");
  if (drive.tool_slugs !== undefined || !drive.query?.includes("googledrive")) {
    throw new Error(`Google Drive catalog search should remain unchanged, got ${JSON.stringify(drive)}`);
  }
});

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

Deno.test("allows multi-toolkit reads only and rejects mixed read/write requests", () => {
  const toolkits = detectComposioMultiReadRequest("Find the latest email in Gmail, the latest file in Google Drive, and recent issues in GitHub");
  if (JSON.stringify(toolkits) !== JSON.stringify(["gmail", "googledrive", "github"])) {
    throw new Error(`Expected the three explicitly mentioned read sources, got ${JSON.stringify(toolkits)}`);
  }
  if (detectComposioMultiReadRequest("Find an email in Gmail and create an issue on GitHub") !== null) {
    throw new Error("Mixed multi-toolkit reads and writes must not be dispatched as a multi-read");
  }
  if (detectComposioMultiReadRequest("Send an email from Gmail and upload a file to Drive") !== null) {
    throw new Error("Multi-toolkit writes must remain unsupported");
  }
});

Deno.test("normalizes Gmail read output, enforces requested result count, and filters returned failure records", () => {
  const shaped = shapeComposioReadResult("gmail", "Find the last 2 failed emails", {
    messages: [
      { from: "ops@example.com", subject: "Delivery failure", date: "2026-11-13", body: "The message failed." },
      { from: "team@example.com", subject: "Weekly update", date: "2026-11-12", body: "All systems are well." },
      { from: "alerts@example.com", subject: "Failure notice", date: "2026-11-11", body: "A failure was detected." },
    ],
  });
  const records = shaped.records as Array<Record<string, string>>;
  if (records.length !== 2 || shaped.requested_limit !== 2) throw new Error(`Expected at most two filtered records, got ${JSON.stringify(shaped)}`);
  if (records[0].sender !== "ops@example.com" || records[0].title !== "Delivery failure" || records[0].date !== "2026-11-13" || !records[0].content.includes("failed")) {
    throw new Error(`Expected normalized sender, title, date, and content fields, got ${JSON.stringify(records[0])}`);
  }
  if (shaped.filter_scope !== "returned records only") throw new Error("The result must not imply filtering beyond records actually returned by Composio");
});

Deno.test("inherits Gmail for a follow-up that says use the same tool", () => {
  const request = detectComposioToolkitRequestFromConversation("استخدم نفس الأداة وهات آخر 5 رسائل", ["شوف آخر رسالة على Gmail"]);
  if (request?.toolkit !== "gmail" || request.intent !== "read") throw new Error(`Expected contextual Gmail read, got ${JSON.stringify(request)}`);
});

Deno.test("requires an explicit successful tool result, not only an HTTP-shaped response", () => {
  if (!hasExplicitComposioExecutionSuccess({ successful: true, data: { messages: [] } })) throw new Error("Explicit success should be accepted");
  if (hasExplicitComposioExecutionSuccess({ data: { messages: [] } })) throw new Error("A 200-style data object without successful=true must be rejected");
  if (hasExplicitComposioExecutionSuccess({ successful: false, data: {} })) throw new Error("Explicit failure must be rejected");
  if (hasExplicitComposioExecutionSuccess({ successful: "true" })) throw new Error("Success must be boolean true");
});

Deno.test("accepts an empty read list as a verified no-results response", () => {
  if (!hasVerifiableComposioReadResult([])) throw new Error("An empty successful list can mean no matching email exists");
  if (hasVerifiableComposioReadResult({ successful: true })) throw new Error("A success marker without returned data is not verifiable");
  if (hasVerifiableComposioReadResult({ error: "read failed" })) throw new Error("Error payloads are not read data");
  if (!hasVerifiableComposioReadResult({ messages: [] })) throw new Error("A structured empty messages field is still a valid response");
});
