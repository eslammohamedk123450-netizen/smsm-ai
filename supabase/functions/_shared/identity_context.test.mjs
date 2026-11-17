import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSulyIdentityContext,
  containsHimsReference,
  COMPANY_ANSWER_TEXT,
  CREATOR_ANSWER_TEXT,
  getIdentityAnswer,
  getSulyProductAnswer,
  IDENTITY_ANSWER_TEXT,
  INACTIVE_UNKNOWN_ANSWER,
  isIdentityQuestion,
  sanitizeContextText,
} from "./identity_context.ts";

test("default identity is stable and does not introduce HIMS", () => {
  const context = buildSulyIdentityContext(false);
  assert.equal(context.systemPrompt.toLowerCase().includes("hims"), false);
  assert.ok(context.systemPrompt.includes("هوية واحدة ثابتة"));
  assert.ok(context.systemPrompt.includes("لا تكرر التحية"));
  assert.deepEqual(context.userMetadata, { badges: [] });
});

test("feature entitlement alone does not add feature-specific instructions", () => {
  const context = buildSulyIdentityContext(true, false);
  assert.equal(context.systemPrompt.toLowerCase().includes("hims"), false);
  assert.deepEqual(context.userMetadata, { badges: ["HIMS"] });
});

test("feature guidance is available only when the current conversation asks about it", () => {
  const context = buildSulyIdentityContext(true, true);
  assert.ok(context.systemPrompt.includes("الموارد التعليمية"));
  assert.equal(context.systemPrompt.toLowerCase().includes("hims"), false);
});

test("unrelated conversation context is redacted even when the feature is activated", () => {
  assert.equal(containsHimsReference("Tell me about HIMS"), true);
  assert.equal(sanitizeContextText("Previous answer mentioned HIMS lectures", false), "تم إخفاء رسالة سابقة غير مرتبطة بطلبك الحالي.");
  assert.equal(sanitizeContextText("Previous answer mentioned HIMS lectures", true), "Previous answer mentioned HIMS lectures");
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
  assert.ok(IDENTITY_ANSWER_TEXT.includes("أنا SULY"));
  assert.ok(CREATOR_ANSWER_TEXT.includes("المهندس إسلام محمد البدوي"));
  assert.equal(COMPANY_ANSWER_TEXT, "Suly-Technologies شركة تقنية تعمل على تطوير منتجات وبرمجيات وحلول ذكاء اصطناعي.");
  assert.equal(INACTIVE_UNKNOWN_ANSWER, "لا أملك معلومات حول ذلك.");
});

test("verified Agent mode guidance answers how to activate the actual UI toggle", () => {
  const answer = getSulyProductAnswer("إزاي أفعل وضع الوكيل؟");
  assert.ok(answer?.includes("زر «وكيل»"));
  assert.ok(answer?.includes("زر +"));
  assert.ok(answer?.includes("مرة أخرى"));
  assert.equal(getSulyProductAnswer("اشرح لي وضع الوكيل"), null);
  assert.ok(getSulyProductAnswer("How do I turn on Agent mode?"));
});
