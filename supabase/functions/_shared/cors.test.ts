import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeadersForRequest, handleCorsPreflight, withCors } from "./cors.ts";

Deno.test("allows only the exact configured GitHub Pages origin", () => {
  const allowed = corsHeadersForRequest(new Request("https://api.example.test", {
    headers: { origin: "https://eslammohamedk123450-netizen.github.io" },
  }));
  assertEquals(allowed["Access-Control-Allow-Origin"], "https://eslammohamedk123450-netizen.github.io");

  const denied = corsHeadersForRequest(new Request("https://api.example.test", {
    headers: { origin: "https://evil.example" },
  }));
  assertEquals(denied["Access-Control-Allow-Origin"], undefined);
});

Deno.test("allows the exact SULY production domain but rejects lookalike origins", () => {
  const production = corsHeadersForRequest(new Request("https://api.example.test", {
    method: "OPTIONS",
    headers: { origin: "https://suly.cloud" },
  }));
  assertEquals(production["Access-Control-Allow-Origin"], "https://suly.cloud");

  const lookalike = corsHeadersForRequest(new Request("https://api.example.test", {
    method: "OPTIONS",
    headers: { origin: "https://www.suly.cloud" },
  }));
  assertEquals(lookalike["Access-Control-Allow-Origin"], undefined);
});

Deno.test("supports explicitly configured exact origins and local development", () => {
  const configured = corsHeadersForRequest(new Request("https://api.example.test", {
    headers: { origin: "https://preview.suly.example" },
  }), "https://preview.suly.example, https://admin.suly.example");
  assertEquals(configured["Access-Control-Allow-Origin"], "https://preview.suly.example");

  const local = corsHeadersForRequest(new Request("https://api.example.test", {
    headers: { origin: "http://localhost:8081" },
  }));
  assertEquals(local["Access-Control-Allow-Origin"], "http://localhost:8081");
});

Deno.test("preflight and response wrapper preserve status and body", async () => {
  const request = new Request("https://api.example.test", {
    method: "OPTIONS",
    headers: { origin: "https://eslammohamedk123450-netizen.github.io" },
  });
  const preflight = handleCorsPreflight(request);
  assertExists(preflight);
  assertEquals(preflight.status, 204);
  assertEquals(preflight.headers.get("Access-Control-Allow-Origin"), "https://eslammohamedk123450-netizen.github.io");

  const wrapped = withCors(new Request("https://api.example.test", {
    headers: { origin: "https://eslammohamedk123450-netizen.github.io" },
  }), new Response("ok", { status: 202 }));
  assertEquals(wrapped.status, 202);
  assertEquals(await wrapped.text(), "ok");
  assertEquals(wrapped.headers.get("Access-Control-Allow-Origin"), "https://eslammohamedk123450-netizen.github.io");
});
