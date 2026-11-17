import { isFeatureResourceRequest, buildFeatureSystemContext, shouldSearchWebForMessage, type FeatureContext } from "./feature_resource_context.ts";
import { activateFeatureByCode, checkFeatureActivationRateLimit, getFeatureContext } from "./feature_flags.ts";
import { isWebSearchRequest } from "./tavily.ts";

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
  if (!isFeatureResourceRequest("افتح المحاضرة")) throw new Error("explicit lecture opening request was missed");
  if (!isFeatureResourceRequest("عايز ملخص المحاضرة")) throw new Error("explicit summary-file request was missed");
});

Deno.test("lecture delivery requests do not trigger web search, but study explanations do", () => {
  const delivery = "ابعتلي ملخص المحاضرة";
  if (!isFeatureResourceRequest(delivery)) throw new Error("lecture delivery was not recognized");
  if (shouldSearchWebForMessage(delivery, isWebSearchRequest)) throw new Error("lecture delivery should not route to web search");
  const explanation = "اشرحلي محاضرة المحاسبة";
  if (isFeatureResourceRequest(explanation)) throw new Error("study explanation should not request a file");
  if (!shouldSearchWebForMessage(explanation, isWebSearchRequest)) throw new Error("general study explanation should trigger research");
});

Deno.test("general academic questions use research while greetings do not", () => {
  if (!isWebSearchRequest("إيه الفرق بين المحاسبة المالية والإدارية؟")) throw new Error("academic comparison should trigger research");
  if (!isWebSearchRequest("اعمل بحث عن نظم المعلومات الإدارية")) throw new Error("academic research request should trigger web search");
  if (isWebSearchRequest("هلا")) throw new Error("greeting should not trigger web search");
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


Deno.test("activation throttling fails closed when the backend is unavailable", async () => {
  let called = false;
  const result = await checkFeatureActivationRateLimit({
    rpc: async (name: string, args: Record<string, unknown>) => {
      called = name === "suly_check_feature_activation_rate_limit" && args.p_user_id === "user-1";
      return { data: null, error: new Error("backend unavailable") };
    },
  }, "user-1");
  if (!called) throw new Error("activation throttle RPC was not called with the authenticated user id");
  if (result.allowed || result.reason !== "unavailable") {
    throw new Error("activation must fail closed when throttling cannot be verified");
  }
});

Deno.test("activation throttling preserves bounded retry information", async () => {
  const result = await checkFeatureActivationRateLimit({
    rpc: async () => ({ data: { allowed: false, reason: "activation_attempt_limit", retry_after_seconds: 17 }, error: null }),
  }, "user-2");
  if (result.allowed || result.reason !== "limited" || result.retryAfterSeconds !== 17) {
    throw new Error("rate-limit response was not mapped to a bounded client result");
  }
});

Deno.test("activation RPC errors never leak raw backend details", async () => {
  const result = await activateFeatureByCode({
    rpc: async () => ({ data: null, error: new Error("sensitive SQL detail") }),
  }, "user-3", "HIMS-TEST-CODE");
  if (result.outcome !== "unavailable" || result.featureKey !== null || result.label !== null) {
    throw new Error("activation RPC error was not reduced to the safe unavailable outcome");
  }
});

Deno.test("unactivated feature context never fetches or returns private resources", async () => {
  let directTableRead = false;
  const context = await getFeatureContext({
    rpc: async () => ({
      data: { features: { hims: { label: "HIMS", activated: false, resources: [{ title: "private", url: "https://example.test/private.pdf" }] } } },
      error: null,
    }),
    from: () => {
      directTableRead = true;
      throw new Error("private resource table must not be queried for an unactivated user");
    },
  }, "user-4");
  if (directTableRead) throw new Error("unactivated user caused a private resource table read");
  if (context.features.hims?.resources.length !== 0) {
    throw new Error("unactivated user received private resources in feature context");
  }
});
