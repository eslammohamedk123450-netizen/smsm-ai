import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSulyIdentityContext,
  containsHimsReference,
  IDENTITY_ANSWER_TEXT,
  INACTIVE_UNKNOWN_ANSWER,
  isIdentityQuestion,
  sanitizeContextText,
} from "./identity_context.ts";

test("inactive identity context never mentions HIMS and has no badge", () => {
  const context = buildSulyIdentityContext(false);
  assert.equal(context.systemPrompt.includes("HIMS"), false);
  assert.deepEqual(context.userMetadata, { badges: [] });
});

test("active identity context includes the HIMS instructions and verified badge metadata", () => {
  const context = buildSulyIdentityContext(true);
  assert.ok(context.systemPrompt.includes("Suly Agent"));
  assert.ok(context.systemPrompt.includes("نظام HIMS"));
  assert.ok(context.systemPrompt.includes(JSON.stringify({ badges: ["HIMS"] })));
  assert.deepEqual(context.userMetadata, { badges: ["HIMS"] });
});

test("inactive HIMS references in prior context are replaced", () => {
  assert.equal(containsHimsReference("Tell me about HIMS"), true);
  assert.equal(sanitizeContextText("Previous answer mentioned HIMS lectures", false), "تم إخفاء رسالة سابقة غير متاحة لهذا الطلب.");
  assert.equal(sanitizeContextText("Previous answer mentioned HIMS lectures", true), "Previous answer mentioned HIMS lectures");
  assert.equal(buildSulyIdentityContext(false).systemPrompt.toLowerCase().includes("hims"), false);
});

test("identity query and unknown-feature response are deterministic", () => {
  assert.equal(isIdentityQuestion("من أنت؟"), true);
  assert.equal(isIdentityQuestion("من انت"), true);
  assert.equal(isIdentityQuestion("من تكون؟"), false);
  assert.ok(IDENTITY_ANSWER_TEXT.includes("Suly Agent"));
  assert.equal(INACTIVE_UNKNOWN_ANSWER, "لا أملك معلومات حول ذلك.");
});
