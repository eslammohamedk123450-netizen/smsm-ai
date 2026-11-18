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

test("SULY identity remains consistent, useful, and professional", () => {
  const context = buildSulyIdentityContext(false);
  assert.ok(context.systemPrompt.includes("هوية ثابتة"));
  assert.ok(context.systemPrompt.includes("لا تكرر التحية"));
  assert.ok(context.systemPrompt.includes("الرسوم البيانية والمخططات"));
  assert.ok(context.systemPrompt.includes("Dashboard"));
  assert.ok(context.systemPrompt.includes("زر «وكيل»"));
  assert.equal(context.systemPrompt.toLowerCase().includes("hims"), false);
  assert.deepEqual(context.userMetadata, { badges: [] });
});

test("Agent guidance reflects the actual execution mode", () => {
  const inactive = buildSulyIdentityContext(false, false);
  assert.ok(inactive.systemPrompt.includes("كتلة agent"));
  const active = buildSulyIdentityContext(false, true);
  assert.ok(active.systemPrompt.includes("وضع الوكيل نشط"));
  assert.equal(active.systemPrompt.includes("اعرض بطاقة تفعيل داخل الرد"), false);
});

test("HIMS entitlement alone does not disclose feature-specific instructions", () => {
  const context = buildSulyIdentityContext(true, false, false);
  assert.equal(context.systemPrompt.toLowerCase().includes("الموارد التعليمية"), false);
  assert.deepEqual(context.userMetadata, { badges: ["HIMS"] });
});

test("HIMS context is included only when the current request is feature-relevant", () => {
  const context = buildSulyIdentityContext(true, false, true);
  assert.ok(context.systemPrompt.includes("الموارد التعليمية"));
  assert.deepEqual(context.userMetadata, { badges: ["HIMS"] });
  const notEntitled = buildSulyIdentityContext(false, false, true);
  assert.equal(notEntitled.systemPrompt.includes("الموارد التعليمية"), false);
});

test("unrelated history is redacted unless the current request permits HIMS context", () => {
  assert.equal(containsHimsReference("Tell me about HIMS"), true);
  assert.equal(sanitizeContextText("Previous answer mentioned HIMS lectures", false), "تم إخفاء رسالة سابقة غير مرتبطة بطلبك الحالي.");
  assert.equal(sanitizeContextText("Previous answer mentioned HIMS lectures", true), "Previous answer mentioned HIMS lectures");
});

test("identity query and company answers are deterministic", () => {
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

test("verified Agent mode answers explain the actual composer toggle", () => {
  const activation = getSulyProductAnswer("إزاي أفعل وضع الوكيل؟");
  assert.ok(activation?.includes("زر «وكيل»"));
  assert.ok(activation?.includes("زر +"));
  assert.ok(activation?.includes("مرة أخرى"));
  const explanation = getSulyProductAnswer("يعني إيه وضع الوكيل؟");
  assert.ok(explanation?.includes("نمط التنفيذ"));
  assert.ok(getSulyProductAnswer("اشرح لي وضع الوكيل"));
  assert.ok(getSulyProductAnswer("How do I turn on Agent mode?"));
});
