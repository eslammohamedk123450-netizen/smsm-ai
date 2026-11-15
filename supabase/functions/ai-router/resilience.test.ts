import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildIndependentTaskPlan,
  mapWithConcurrency,
  mergePartAnswers,
  splitTask,
  validateTaskPlan,
} from "./resilience.ts";

Deno.test("splitTask splits only explicit same-level independent lists", () => {
  const parts = splitTask("1. حلل السوق\n2. قارن المنافسين\n3. اكتب التوصيات", 3);
  assertEquals(parts.length, 3);
  assertEquals(parts[0].startsWith("1."), true);
});

Deno.test("splitTask keeps dependency-ordered work together", () => {
  const parts = splitTask("1. اجمع البيانات\n2. بعد ذلك حلل النتائج\n3. اكتب التوصية", 3);
  assertEquals(parts.length, 1);
});

Deno.test("splitTask does not split long prose or mixed list types", () => {
  assertEquals(splitTask("هذا شرح طويل لكنه طلب واحد وليس قائمة مهام مستقلة.", 4).length, 1);
  assertEquals(splitTask("1. المهمة الأولى\n- المهمة الثانية", 4).length, 1);
});

Deno.test("independent task plans are valid and have no dependencies", () => {
  const plan = buildIndependentTaskPlan(["تحليل السوق", "تحليل المنافسين"], 4);
  assertEquals(plan?.length, 2);
  assertEquals(plan?.every((step) => step.depends_on.length === 0), true);
  assertEquals(validateTaskPlan(plan ?? [], 4), true);
});

Deno.test("task plan validation rejects dependency cycles", () => {
  const plan = [
    { step_id: "a", description: "A", expected_inputs: {}, completion_criteria: "done", depends_on: ["b"] },
    { step_id: "b", description: "B", expected_inputs: {}, completion_criteria: "done", depends_on: ["a"] },
  ];
  assertEquals(validateTaskPlan(plan, 4), false);
});

Deno.test("bounded worker pool preserves input order", async () => {
  const results = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
    await new Promise((resolve) => setTimeout(resolve, value * 2));
    return value * 10;
  });
  assertEquals(results, [30, 10, 20]);
});

Deno.test("part merger preserves original part ordering", () => {
  const merged = mergePartAnswers([
    { index: 1, content: "الجزء الثاني", model: "worker-b" },
    { index: 0, content: "الجزء الأول", model: "worker-a" },
  ]);
  assertEquals(merged.indexOf("الجزء الأول") < merged.indexOf("الجزء الثاني"), true);
});
