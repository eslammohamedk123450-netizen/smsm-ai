import { classifyIntent } from "./intent_classifier.ts";

Deno.test("classifies a clear Arabic compound task", () => {
  const decision = classifyIntent("اعمل لي موقع لبيع الكتب مع تسجيل دخول ولوحة تحكم");
  if (decision.intent !== "complex_task") throw new Error(`Expected complex_task, got ${decision.intent}`);
  if (decision.maxSources !== 2) throw new Error(`Expected maxSources 2, got ${decision.maxSources}`);
});

Deno.test("classifies a clear Arabic simple task", () => {
  const decision = classifyIntent("ترجم لي هذه الجملة إلى الإنجليزية");
  if (decision.intent !== "simple_task") throw new Error(`Expected simple_task, got ${decision.intent}`);
  if (decision.maxSources !== 1) throw new Error(`Expected maxSources 1, got ${decision.maxSources}`);
});

Deno.test("does not treat a long, single-sentence Arabic request as compound by length", () => {
  const decision = classifyIntent(
    "أريد أن أفهم بصورة أفضل كيف تعمل هذه الفكرة وما الجوانب الأساسية التي ينبغي الانتباه إليها قبل اتخاذ القرار.",
  );
  if (decision.intent !== "simple_task") throw new Error(`Expected simple_task, got ${decision.intent}`);
  if (decision.reason !== "default_single_reply") throw new Error(`Unexpected reason: ${decision.reason}`);
});

Deno.test("keeps short Arabic chitchat classified as chat", () => {
  const decision = classifyIntent("عامل ايه");
  if (decision.intent !== "chat") throw new Error(`Expected chat, got ${decision.intent}`);
  if (decision.maxSources !== 0) throw new Error(`Expected maxSources 0, got ${decision.maxSources}`);
});

Deno.test("routes an ordinary Arabic question through the single-reply path", () => {
  const decision = classifyIntent("اشرحلي الفرق بين الذاكرة قصيرة المدى وطويلة المدى");
  if (decision.intent !== "simple_task") throw new Error(`Expected simple_task, got ${decision.intent}`);
  if (decision.reason === "compound_task_marker") throw new Error("A one-answer request must not enter compound planning");
});

Deno.test("sends an explicit Arabic multi-step request to the compound-task path", () => {
  const decision = classifyIntent("ابحث عن أفضل الخيارات، ثم قارن الأسعار والمزايا، وبعدين اكتب توصية نهائية");
  if (decision.intent !== "complex_task") throw new Error(`Expected complex_task, got ${decision.intent}`);
  if (decision.maxSources < 2) throw new Error(`Expected multiple sources, got ${decision.maxSources}`);
});

Deno.test("classifies English compound and simple tasks", () => {
  const compound = classifyIntent("Create a roadmap for launching a small online store");
  if (compound.intent !== "complex_task") throw new Error(`Expected complex_task, got ${compound.intent}`);

  const simple = classifyIntent("translate this sentence into Arabic");
  if (simple.intent !== "simple_task") throw new Error(`Expected simple_task, got ${simple.intent}`);
});

Deno.test("raises maxSources for an Arabic multi-source research request", () => {
  const decision = classifyIntent("ابحث عن خيارات مناسبة من عدة مصادر");
  if (decision.intent !== "simple_task") throw new Error(`Expected simple_task, got ${decision.intent}`);
  if (decision.maxSources !== 3) throw new Error(`Expected maxSources 3, got ${decision.maxSources}`);
});
