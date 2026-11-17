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

test("SULY identity is consistent, concise, and professional", () => {
  const context = buildSulyIdentityContext(false);
  assert.ok(context.systemPrompt.includes("هوية ثابتة"));
  assert.ok(context.systemPrompt.includes("لا تكرر التحية"));
  assert.ok(context.systemPrompt.includes("الرسوم البيانية والمخططات"));
  assert.ok(context.systemPrompt.includes("Dashboard"));
  assert.ok(context.systemPrompt.includes("زر «وكيل»"));
  assert.equal(context.systemPrompt.includes("كالصديق المقرب"), false);
  assert.deepEqual(context.userMetadata, { badges: [] });
});

test("Agent activation guidance reflects the real execution mode", () => {
  const inactive = buildSulyIdentityContext(false, false);
  assert.ok(inactive.systemPrompt.includes("كتلة agent"));
  const active = buildSulyIdentityContext(false, true);
  assert.ok(active.systemPrompt.includes("وضع الوكيل نشط"));
  assert.equal(active.systemPrompt.includes("اعرض بطاقة تفعيل داخل الرد"), false);
});

test("active identity context preserves verified feature guidance and badge metadata", () => {
  const context = buildSulyIdentityContext(true);
  assert.ok(context.systemPrompt.includes("أنت SULY"));
  assert.ok(context.systemPrompt.includes("الموارد التعليمية"));
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
  assert.ok(IDENTITY_ANSWER_TEXT.includes("أنا SULY"));
  assert.ok(CREATOR_ANSWER_TEXT.includes("المهندس إسلام محمد البدوي"));
  assert.equal(COMPANY_ANSWER_TEXT, "Suly-Technologies شركة تقنية تعمل على تطوير منتجات وبرمجيات وحلول ذكاء اصطناعي.");
  assert.equal(INACTIVE_UNKNOWN_ANSWER, "لا أملك معلومات حول ذلك.");
});

test("verified Agent mode product guidance explains the actual composer toggle", () => {
  const activation = getSulyProductAnswer("إزاي أفعل وضع الوكيل؟");
  assert.ok(activation?.includes("زر «وكيل»"));
  assert.ok(activation?.includes("زر +"));
  assert.ok(activation?.includes("مرة أخرى"));
  const explanation = getSulyProductAnswer("يعني إيه وضع الوكيل؟");
  assert.ok(explanation?.includes("نمط التنفيذ"));
  assert.ok(getSulyProductAnswer("اشرح لي وضع الوكيل"));
  assert.ok(getSulyProductAnswer("How do I turn on Agent mode?"));
});

