import { isFeatureResourceRequest, buildFeatureSystemContext, type FeatureContext } from "./feature_resource_context.ts";

Deno.test("ordinary greetings do not request private feature resources", () => {
  for (const message of ["هلا", "إزيك", "صباح الخير", "تمام", "شكراً"]) {
    if (isFeatureResourceRequest(message)) throw new Error(`unexpected resource request: ${message}`);
  }
});

Deno.test("explicit Arabic and English resource requests are detected", () => {
  for (const message of ["ابعتلي المحاضرة", "عايز ملف المحاضرة", "هات الملخص", "download the lecture", "show me the course materials"]) {
    if (!isFeatureResourceRequest(message)) throw new Error(`missed resource request: ${message}`);
  }
});

Deno.test("short follow-ups inherit only a recent resource request", () => {
  if (!isFeatureResourceRequest("ابعتها", ["هلا", "عايز محاضرة مادة المحاسبة"])) throw new Error("expected resource follow-up");
  if (isFeatureResourceRequest("ابعتها", ["هلا", "عامل ايه"])) throw new Error("unexpected resource follow-up");
});

Deno.test("study explanations are not mistaken for lecture-file requests", () => {
  if (isFeatureResourceRequest("اشرحلي محاضرة المحاسبة")) throw new Error("study explanation should stay in normal chat/search");
  if (isFeatureResourceRequest("ملخص المحاضرة")) throw new Error("a summary request is not necessarily a file request");
  if (!isFeatureResourceRequest("ابعتلي محاضرة المحاسبة")) throw new Error("explicit lecture delivery request was missed");
  if (!isFeatureResourceRequest("عايز ملخص المحاضرة")) throw new Error("explicit summary-file request was missed");
});

Deno.test("feature context never exposes internal feature labels or activation names", () => {
  const context: FeatureContext = {
    features: {
      hims: {
        label: "HIMS",
        activated: true,
        resources: [{ title: "محاضرة المحاسبة", url: "https://example.com/lecture.pdf", kind: "document", description: null }],
      },
    },
  };
  const prompt = buildFeatureSystemContext(context) ?? "";
  if (prompt.includes("HIMS") || prompt.includes("feature_key")) {
    throw new Error("internal feature details leaked into model context");
  }
  if (!prompt.includes("محاضرة المحاسبة") || !prompt.includes("https://example.com/lecture.pdf")) {
    throw new Error("authorized resource was not included");
  }
});

Deno.test("empty resource sets do not add feature context", () => {
  const context: FeatureContext = { features: { hims: { label: "HIMS", activated: true, resources: [] } } };
  if (buildFeatureSystemContext(context) !== null) throw new Error("empty feature context should be omitted");
});
