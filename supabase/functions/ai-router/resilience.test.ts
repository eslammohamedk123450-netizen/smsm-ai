import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildIndependentTaskPlan,
  buildTaskPlan,
  parseModelGeneratedTaskPlan,
  hasExplicitDependencyLanguage,
  executeTaskPlan,
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

Deno.test("splitTask preserves explicit ordered steps for a dependency DAG", () => {
  const request = "1. اجمع البيانات\n2. بعد ذلك حلل النتائج\n3. اكتب التوصية";
  const parts = splitTask(request, 3);
  assertEquals(parts.length, 3);
  assertEquals(hasExplicitDependencyLanguage(request), true);
  const plan = buildTaskPlan(parts, 3, true);
  assertEquals(plan?.map((step) => step.depends_on), [[], ["part-1"], ["part-2"]]);
  assertEquals(validateTaskPlan(plan ?? [], 3), true);
});

Deno.test("dependency plan selection fails closed for unstructured prose", () => {
  const request = "اجمع البيانات ثم حلل النتائج ثم اكتب التوصية";
  assertEquals(splitTask(request, 3).length, 1);
  assertEquals(buildTaskPlan(["one", "two"], 3, true)?.length, 2);
  assertEquals(buildTaskPlan(["one", "two"], 3, false)?.every((step) => step.depends_on.length === 0), true);
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
    { index: 0, content: "الجزء الأول", model: "worker-a" },
    { index: 1, content: "الجزء الثاني", model: "worker-b" },
  ]);
  assertEquals(merged.indexOf("الجزء الأول") < merged.indexOf("الجزء الثاني"), true);
});


Deno.test("dependency-aware executor runs prerequisites before dependants", async () => {
  const plan = [
    { step_id: "collect", description: "Collect", expected_inputs: {}, completion_criteria: "Collected", depends_on: [] },
    { step_id: "research", description: "Research", expected_inputs: {}, completion_criteria: "Researched", depends_on: [] },
    { step_id: "analyze", description: "Analyze", expected_inputs: {}, completion_criteria: "Analyzed", depends_on: ["collect"] },
    { step_id: "recommend", description: "Recommend", expected_inputs: {}, completion_criteria: "Recommended", depends_on: ["analyze", "research"] },
  ];
  const calls: string[] = [];
  const outcomes = await executeTaskPlan(plan, 2, async (step, _index, completed) => {
    calls.push(step.step_id);
    if (step.step_id === "analyze") {
      assertEquals(completed.get("collect"), "data");
    }
    if (step.step_id === "recommend") {
      assertEquals(completed.get("analyze"), "analysis");
      assertEquals(completed.get("research"), "sources");
    }
    return ({ collect: "data", research: "sources", analyze: "analysis", recommend: "final" } as Record<string, string>)[step.step_id];
  });
  assertEquals(outcomes.map((item) => item.status), ["completed", "completed", "completed", "completed"]);
  assertEquals(outcomes.map((item) => item.result), ["data", "sources", "analysis", "final"]);
  assertEquals(calls.indexOf("collect") < calls.indexOf("analyze"), true);
  assertEquals(calls.indexOf("analyze") < calls.indexOf("recommend"), true);
  assertEquals(calls.indexOf("research") < calls.indexOf("recommend"), true);
});

Deno.test("failed prerequisite blocks only dependent steps", async () => {
  const plan = [
    { step_id: "broken", description: "Broken", expected_inputs: {}, completion_criteria: "Done", depends_on: [] },
    { step_id: "independent", description: "Independent", expected_inputs: {}, completion_criteria: "Done", depends_on: [] },
    { step_id: "dependent", description: "Dependent", expected_inputs: {}, completion_criteria: "Done", depends_on: ["broken"] },
  ];
  const calls: string[] = [];
  const outcomes = await executeTaskPlan(plan, 2, async (step) => {
    calls.push(step.step_id);
    if (step.step_id === "broken") throw new Error("provider failed");
    return "ok";
  });
  assertEquals(calls.includes("independent"), true);
  assertEquals(calls.includes("dependent"), false);
  assertEquals(outcomes.map((item) => item.status), ["failed", "completed", "blocked"]);
});

Deno.test("dependency-aware executor rejects cyclic plans before running", async () => {
  const plan = [
    { step_id: "a", description: "A", expected_inputs: {}, completion_criteria: "Done", depends_on: ["b"] },
    { step_id: "b", description: "B", expected_inputs: {}, completion_criteria: "Done", depends_on: ["a"] },
  ];
  let called = false;
  let rejected = false;
  try {
    await executeTaskPlan(plan, 2, async () => { called = true; return "unexpected"; });
  } catch {
    rejected = true;
  }
  assertEquals(rejected, true);
  assertEquals(called, false);
});

Deno.test("model-generated DAG parser accepts branching and merging dependencies", () => {
  const raw = JSON.stringify({ steps: [
    { step_id: "collect_a", description: "Collect source A", expected_inputs: {}, completion_criteria: "Source A collected", depends_on: [] },
    { step_id: "collect_b", description: "Collect source B", expected_inputs: {}, completion_criteria: "Source B collected", depends_on: [] },
    { step_id: "analyze_a", description: "Analyze source A", expected_inputs: {}, completion_criteria: "Analysis A complete", depends_on: ["collect_a"] },
    { step_id: "synthesize", description: "Synthesize both analyses", expected_inputs: {}, completion_criteria: "Synthesis complete", depends_on: ["analyze_a", "collect_b"] },
  ] });
  const plan = parseModelGeneratedTaskPlan(raw, 5);
  assertEquals(plan?.length, 4);
  assertEquals(plan?.[3].depends_on, ["analyze_a", "collect_b"]);
  assertEquals(validateTaskPlan(plan ?? [], 5), true);
});

Deno.test("model-generated DAG parser rejects unknown dependencies, cycles, and oversized plans", () => {
  const make = (steps: unknown[]) => JSON.stringify({ steps });
  const step = (id: string, deps: string[]) => ({
    step_id: id, description: "A valid task", expected_inputs: {},
    completion_criteria: "Task complete", depends_on: deps,
  });
  assertEquals(parseModelGeneratedTaskPlan(make([step("a", ["missing"]), step("b", [])]), 4), null);
  assertEquals(parseModelGeneratedTaskPlan(make([step("a", ["b"]), step("b", ["a"])]), 4), null);
  assertEquals(parseModelGeneratedTaskPlan(make([step("a", []), step("b", []), step("c", []), step("d", []), step("e", []), step("f", [])]), 5), null);
  assertEquals(parseModelGeneratedTaskPlan(make([step("a", []), { ...step("b", []), extra: true }]), 4), null);
  assertEquals(parseModelGeneratedTaskPlan("not json", 4), null);
  assertEquals(parseModelGeneratedTaskPlan(JSON.stringify({ steps: [] }), 4), []);
});
