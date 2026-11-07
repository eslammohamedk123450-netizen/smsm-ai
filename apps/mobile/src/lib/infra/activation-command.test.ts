import {
  activationOutcomeMessage,
  interpretActivationResponse,
  isActivationCommand,
  parseActivationCommand,
} from "../../../../../supabase/functions/_shared/activation_command";

describe("parseActivationCommand", () => {
  it("parses the documented form and uppercases the code", () => {
    expect(parseActivationCommand("!ACTIVATE_HIMS-2026")).toEqual({ code: "HIMS-2026", raw: "!ACTIVATE_HIMS-2026" });
    expect(parseActivationCommand("  !activate_hims2026  ")?.code).toBe("HIMS2026");
  });

  it("accepts a dash separator", () => {
    expect(parseActivationCommand("!ACTIVATE-HIMS2026")?.code).toBe("HIMS2026");
  });

  it("rejects ordinary messages", () => {
    expect(parseActivationCommand("اشرح لي محاضرة الشبكات")).toBeNull();
    expect(parseActivationCommand("ACTIVATE_HIMS2026")).toBeNull();
    expect(parseActivationCommand("!ACTIVATE_")).toBeNull();
    expect(parseActivationCommand("!ACTIVATE_abc")).toBeNull();
    expect(parseActivationCommand(null)).toBeNull();
    expect(parseActivationCommand(undefined)).toBeNull();
  });

  it("rejects commands embedded in a longer message", () => {
    expect(parseActivationCommand("مرحبا !ACTIVATE_HIMS2026 شكرا")).toBeNull();
  });

  it("exposes a boolean helper", () => {
    expect(isActivationCommand("!ACTIVATE_HIMS2026")).toBe(true);
    expect(isActivationCommand("hello")).toBe(false);
  });
});

describe("interpretActivationResponse", () => {
  it("maps a fresh activation", () => {
    expect(interpretActivationResponse({ success: true, feature_key: "hims", label: "HIMS" }))
      .toEqual({ outcome: "activated", featureKey: "hims", label: "HIMS" });
  });

  it("maps a repeat activation", () => {
    expect(interpretActivationResponse({ success: true, already_active: true, feature_key: "hims" }))
      .toEqual({ outcome: "already_active", featureKey: "hims", label: null });
  });

  it("keeps known failure codes", () => {
    expect(interpretActivationResponse({ success: false, error: "code_expired" }).outcome).toBe("code_expired");
    expect(interpretActivationResponse({ success: false, error: "unknown_code" }).outcome).toBe("unknown_code");
  });

  it("collapses unknown payloads to a safe outcome", () => {
    expect(interpretActivationResponse(null).outcome).toBe("unavailable");
    expect(interpretActivationResponse({ success: false, error: "relation does not exist" }).outcome).toBe("unavailable");
  });
});

describe("activationOutcomeMessage", () => {
  it("prefixes the feature label when present", () => {
    expect(activationOutcomeMessage("activated", "HIMS")).toContain("HIMS");
  });

  it("never leaks server error text", () => {
    const message = activationOutcomeMessage("unavailable", null);
    expect(message).not.toMatch(/relation|sql|exception/i);
    expect(message.length).toBeGreaterThan(10);
  });
});
