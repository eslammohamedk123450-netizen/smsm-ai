import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildIndependentTaskPlan,
  mapWithConcurrency,
  mergePartAnswers,
  splitTask,
  validateTaskPlan,
} from "./resilience.ts";

Deno.test("splits an explicit numbered list of independent asks", () => {
  const parts = splitTask("1. اكتب مقدمة عن الذكاء الاصطناعي\n2. اذكر ثلاث فوائد\n3. اختم بجملة", 4);
  assertEquals(parts.length, 3);
  assert(parts[0].includes("مقدمة"));
  assert(parts[2].includes("اختم"));
});

Deno.test("splits an explicit bulleted list", () => {
  const parts = splitTask("- عرف المصطلح\n- أعط مثالًا\n- اذكر التحذيرات", 4);
  assertEquals(parts.length, 3);
});

Deno.test("never splits on length alone", () => {
  const long = "اكتب لي مقالًا مفصلًا عن تاريخ الأندلس. ".repeat(60);
  assertEquals(splitTask(long, 4).length, 1);
});

Deno.test("never splits when the list has dependencies", () => {
  const text = "1. ابحث عن المصادر\n2. ثم لخص ما وجدته\n3. بعد ذلك اكتب التقرير";
  assertEquals(splitTask(text, 4).length, 1);
});

Deno.test("keeps a single short question intact", () => {
  assertEquals(splitTask("ما هي عاصمة اليابان؟", 4).length, 1);
});

Deno.test("rejects mixed list styles instead of guessing", () => {
  const text = "1. أولًا\n- ثانيًا\n2. ثالثًا";
  assertEquals(splitTask(text, 4).length, 1);
});

Deno.test("builds and validates an acyclic independent plan", () => {
  const plan = buildIndependentTaskPlan(["أ", "ب", "ج"], 4);
  assert(plan !== null);
  assertEquals(plan!.length, 3);
  assert(validateTaskPlan(plan!, 4));
  assert(plan!.every((step) => step.depends_on.length === 0));
});

Deno.test("rejects a plan above the hard step limit", () => {
  const parts = Array.from({ length: 6 }, (_, index) => `مهمة ${index + 1}`);
  assertEquals(buildIndependentTaskPlan(parts, 4, null), null);
});

Deno.test("detects duplicate ids and dependency cycles", () => {
  const base = buildIndependentTaskPlan(["أ", "ب"], 4)!;
  const duplicate = [base[0], { ...base[1], step_id: base[0].step_id }];
  assertFalse(validateTaskPlan(duplicate, 4));
  const cyclic = [
    { ...base[0], depends_on: ["part-2"] },
    { ...base[1], depends_on: ["part-1"] },
  ];
  assertFalse(validateTaskPlan(cyclic, 4));
  const unknownParent = [{ ...base[0], depends_on: ["missing"] }, base[1]];
  assertFalse(validateTaskPlan(unknownParent, 4));
});

Deno.test("bounded pool never exceeds the concurrency limit", async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4, 5], 3, async (item) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 20));
    active -= 1;
    return item * 2;
  });
  assertEquals(results, [2, 4, 6, 8, 10]);
  assertEquals(peak, 3);
});

Deno.test("merge keeps part order and reports missing parts honestly", () => {
  const merged = mergePartAnswers([
    { index: 0, content: "الأول", model: "m1" },
    { index: 1, content: "", model: null },
    { index: 2, content: "الثالث", model: "m2" },
  ]);
  assert(merged.indexOf("الأول") < merged.indexOf("الثالث"));
  assert(merged.includes("لم يتمكن أي نموذج"));
});
