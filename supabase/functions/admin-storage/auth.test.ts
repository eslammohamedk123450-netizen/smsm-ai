import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractBearerToken } from "./auth.ts";

Deno.test("extractBearerToken accepts a single Bearer token", () => {
  assertEquals(extractBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  assertEquals(extractBearerToken("bearer abc.def.ghi"), "abc.def.ghi");
});

Deno.test("extractBearerToken rejects missing or malformed authorization", () => {
  assertEquals(extractBearerToken(null), null);
  assertEquals(extractBearerToken(""), null);
  assertEquals(extractBearerToken("Basic abc"), null);
  assertEquals(extractBearerToken("Bearer"), null);
  assertEquals(extractBearerToken("Bearer token extra"), null);
});
