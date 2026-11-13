import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSulyIdentityContext,
  containsHimsReference,
  COMPANY_ANSWER_TEXT,
  CREATOR_ANSWER_TEXT,
  getIdentityAnswer,
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
  assert.ok(context.systemPrompt.includes("أنت Suly، مساعد ذكي."));
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
  assert.equal(getIdentityAnswer("من أنت؟"), IDENTITY_ANSWER_TEXT);
  assert.equal(getIdentityAnswer("مين طورك؟"), CREATOR_ANSWER_TEXT);
  assert.equal(getIdentityAnswer("شركة Suly-Technologies دي بتاعة مين؟"), COMPANY_ANSWER_TEXT);
  assert.equal(getIdentityAnswer("كلمني عن Suly-Technologies"), COMPANY_ANSWER_TEXT);
  assert.equal(getIdentityAnswer("مين مؤسس الشركة؟"), COMPANY_ANSWER_TEXT);
  assert.ok(IDENTITY_ANSWER_TEXT.includes("أنا Suly"));
  assert.ok(CREATOR_ANSWER_TEXT.includes("المهندس إسلام محمد البدري"));
  assert.ok(COMPANY_ANSWER_TEXT.includes("شركة مصرية ناشئة"));
  assert.ok(COMPANY_ANSWER_TEXT.includes("وكلاء ذكاء اصطناعي"));
  assert.equal(INACTIVE_UNKNOWN_ANSWER, "لا أملك معلومات حول ذلك.");
});
