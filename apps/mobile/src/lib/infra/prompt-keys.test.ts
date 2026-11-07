import {
  buildContentHash,
  buildContextHash,
  buildPromptHash,
  checkCacheEligibility,
  containsSensitiveText,
  normalizeFeatureKey,
  normalizeText,
  sha256Hex,
} from "../../../../../supabase/functions/_shared/prompt_keys";

describe("normalizeFeatureKey", () => {
  it("accepts strict keys", () => {
    expect(normalizeFeatureKey("hims")).toBe("hims");
    expect(normalizeFeatureKey(" University_2026 ")).toBe("university_2026");
  });

  it("falls back to general for anything unsafe", () => {
    expect(normalizeFeatureKey("../../etc")).toBe("general");
    expect(normalizeFeatureKey("with space")).toBe("general");
    expect(normalizeFeatureKey("")).toBe("general");
    expect(normalizeFeatureKey(undefined)).toBe("general");
    expect(normalizeFeatureKey("a".repeat(41))).toBe("general");
  });
});

describe("normalizeText", () => {
  it("collapses whitespace, case, and Unicode forms", () => {
    expect(normalizeText("  Explain   THE\n\ncache ")).toBe("explain the cache");
    expect(normalizeText("ＡＢＣ")).toBe("abc");
  });
});

describe("sha256Hex", () => {
  it("returns a stable 64-char digest", async () => {
    const digest = await sha256Hex("hello");
    expect(digest).toHaveLength(64);
    expect(digest).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

describe("buildPromptHash", () => {
  const base = { featureKey: "hims", userMessage: "اشرح محاضرة الشبكات" };

  it("is stable for equivalent formatting", async () => {
    const a = await buildPromptHash(base);
    const b = await buildPromptHash({ ...base, userMessage: "  اشرح   محاضرة الشبكات  " });
    expect(a).toBe(b);
  });

  it("differs per feature key", async () => {
    const a = await buildPromptHash(base);
    const b = await buildPromptHash({ ...base, featureKey: "chat" });
    expect(a).not.toBe(b);
  });

  it("differs when the temperature changes", async () => {
    const a = await buildPromptHash({ ...base, temperature: 0.2 });
    const b = await buildPromptHash({ ...base, temperature: 0.9 });
    expect(a).not.toBe(b);
  });

  it("ignores the model, so a cached answer survives model switches", async () => {
    const a = await buildPromptHash({ ...base, modelId: 1 });
    const b = await buildPromptHash({ ...base, modelId: 7 });
    expect(a).toBe(b);
  });
});

describe("buildContextHash", () => {
  const base = { featureKey: "hims", userMessage: "q", systemPrompt: "system" };

  it("changes with the system prompt", async () => {
    const a = await buildContextHash(base);
    const b = await buildContextHash({ ...base, systemPrompt: "different" });
    expect(a).not.toBe(b);
  });

  it("changes with the routing mode", async () => {
    const a = await buildContextHash({ ...base, routingMode: "auto" });
    const b = await buildContextHash({ ...base, routingMode: "manual", modelId: 3 });
    expect(a).not.toBe(b);
  });

  it("only pins the model in manual mode", async () => {
    const a = await buildContextHash({ ...base, routingMode: "auto", modelId: 1 });
    const b = await buildContextHash({ ...base, routingMode: "auto", modelId: 9 });
    expect(a).toBe(b);
  });
});

describe("buildContentHash", () => {
  it("dedupes equivalent content inside one feature", async () => {
    const a = await buildContentHash("hims", "طلب محاضرة الشبكات");
    const b = await buildContentHash("hims", "  طلب   محاضرة الشبكات ");
    const c = await buildContentHash("chat", "طلب محاضرة الشبكات");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("containsSensitiveText", () => {
  it("detects credentials", () => {
    expect(containsSensitiveText("my key is sk-abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(containsSensitiveText("password: hunter2hunter2")).toBe(true);
    expect(containsSensitiveText("Authorization: Bearer abcdefghijklmnopqrstuvwxyz")).toBe(true);
  });

  it("allows ordinary questions", () => {
    expect(containsSensitiveText("اشرح لي محاضرة الشبكات من فضلك")).toBe(false);
  });
});

describe("checkCacheEligibility", () => {
  it("rejects activation commands", () => {
    expect(checkCacheEligibility("!ACTIVATE_HIMS-2026")).toEqual({ eligible: false, reason: "activation_command" });
  });

  it("rejects very short prompts", () => {
    expect(checkCacheEligibility("hi")).toEqual({ eligible: false, reason: "too_short" });
  });

  it("rejects prompts carrying secrets", () => {
    expect(checkCacheEligibility("api_key=abcdef1234567890")).toEqual({ eligible: false, reason: "sensitive" });
  });

  it("accepts a normal question", () => {
    expect(checkCacheEligibility("اشرح لي الفرق بين TCP و UDP")).toEqual({ eligible: true });
  });
});
