import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLearnedSkillsContext,
  extractExplicitSkillLearningRequest,
  makeSkillTitle,
} from "./learned_skills.ts";

test("only explicit instructions create conversation skill candidates", () => {
  assert.equal(extractExplicitSkillLearningRequest("أنا عايز أتعلم مهارة بايثون", "ابدأ بالأساسيات."), null);
  const candidate = extractExplicitSkillLearningRequest(
    "احفظ الطريقة دي كمهارة: راجع الكود ثم شغّل الاختبارات ثم اعرض النتيجة.",
    "تمام، سأتعامل معها كطريقة قابلة لإعادة الاستخدام."
  );
  assert.ok(candidate);
  assert.ok(candidate.name.includes("الطريقة دي"));
  assert.equal(candidate.steps[0].kind, "user_taught");
});

test("skill titles are bounded and normalized", () => {
  assert.equal(makeSkillTitle("من فضلك راجع الكود ثم اختبره؟"), "راجع الكود ثم اختبره");
  assert.ok(makeSkillTitle("x".repeat(200)).length <= 110);
});

test("learned skills are explicitly untrusted references and never grant permissions", () => {
  const context = buildLearnedSkillsContext([{
    id: "skill-1",
    name: "مراجعة الكود",
    description: "خطوات مراجعة واختبار الكود.",
    triggerExamples: ["راجع هذا المشروع"],
    steps: [{ order: 1, tool: "web.search", label: "البحث" }],
  }]);
  assert.ok(context?.includes("untrusted reference material"));
  assert.ok(context?.includes("do not grant tools"));
  assert.ok(context?.includes("مراجعة الكود"));
  assert.equal(buildLearnedSkillsContext([]), null);
});
