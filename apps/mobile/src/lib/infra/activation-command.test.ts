import {
  activationOutcomeMessage,
  interpretActivationResponse,
  isActivationCommand,
  parseActivationCommand,
  shouldReportActivationFailure,
} from "../../../../../supabase/functions/_shared/activation_command";

describe("parseActivationCommand", () => {
  it("parses the documented form and uppercases the code", () => {
    expect(parseActivationCommand("!ACTIVATE_HIMS-2026")).toEqual({ code: "HIMS-2026", raw: "!ACTIVATE_HIMS-2026", explicit: true });
    expect(parseActivationCommand("  !activate_hims2026  ")?.code).toBe("HIMS2026");
  });

  it("accepts a dash separator and loose spacing", () => {
    expect(parseActivationCommand("!ACTIVATE-HIMS2026")?.code).toBe("HIMS2026");
    expect(parseActivationCommand("!ACTIVATE HIMS2026")?.code).toBe("HIMS2026");
    expect(parseActivationCommand("! ACTIVATE : HIMS2026")?.code).toBe("HIMS2026");
  });

  it("finds the command inside a longer message", () => {
    expect(parseActivationCommand("مرحبا !ACTIVATE_HIMS2026 شكرا")).toEqual({
      code: "HIMS2026",
      raw: "مرحبا !ACTIVATE_HIMS2026 شكرا",
      explicit: true,
    });
    expect(parseActivationCommand("كود التفعيل: !activate_HIMS-2026")?.explicit).toBe(true);
  });

  it("treats a message that is only a code as an implicit attempt", () => {
    expect(parseActivationCommand("HIMS-2026ABCD")).toEqual({ code: "HIMS-2026ABCD", raw: "HIMS-2026ABCD", explicit: false });
  });

  it("rejects ordinary messages", () => {
    expect(parseActivationCommand("اشرح لي محاضرة الشبكات")).toBeNull();
    // Without the `!` it is read as a bare code: an attempt, not a command.
    expect(parseActivationCommand("ACTIVATE_HIMS2026")?.explicit).toBe(false);
    expect(parseActivationCommand("!ACTIVATE_")).toBeNull();
    expect(parseActivationCommand("!ACTIVATE_abc")).toBeNull();
    expect(parseActivationCommand("hello")).toBeNull();
    expect(parseActivationCommand("")).toBeNull();
    expect(parseActivationCommand(null)).toBeNull();
    expect(parseActivationCommand(undefined)).toBeNull();
  });

  it("exposes a boolean helper", () => {
    expect(isActivationCommand("!ACTIVATE_HIMS2026")).toBe(true);
    expect(isActivationCommand("hello")).toBe(false);
  });
});

describe("interpretActivationResponse", () => {
  it("maps a fresh activation with the feature's own message", () => {
    expect(interpretActivationResponse({ success: true, feature_key: "hims", label: "HIMS", activation_message: "تم التفعيل" }))
      .toEqual({ outcome: "activated", featureKey: "hims", label: "HIMS", activationMessage: "تم التفعيل" });
  });

  it("maps a repeat activation", () => {
    expect(interpretActivationResponse({ success: true, already_active: true, feature_key: "hims" }))
      .toEqual({ outcome: "already_active", featureKey: "hims", label: null, activationMessage: null });
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
  it("prefers the feature's own success message", () => {
    expect(activationOutcomeMessage("activated", "HIMS", "تم تفعيل نظام HIMS. مرحبًا بك.")).toBe("تم تفعيل نظام HIMS. مرحبًا بك.");
    expect(activationOutcomeMessage("already_active", "HIMS", "تم تفعيل نظام HIMS. مرحبًا بك.")).toBe("تم تفعيل نظام HIMS. مرحبًا بك.");
  });

  it("prefixes the feature label when the feature has no message", () => {
    expect(activationOutcomeMessage("activated", "HIMS")).toContain("HIMS");
  });

  it("never leaks server error text", () => {
    const message = activationOutcomeMessage("unavailable", null);
    expect(message).not.toMatch(/relation|sql|exception/i);
    expect(message.length).toBeGreaterThan(10);
  });
});

describe("shouldReportActivationFailure", () => {
  const explicit = { code: "X1", raw: "!ACTIVATE_X1", explicit: true };
  const implicit = { code: "X1", raw: "X1", explicit: false };

  it("always answers a successful activation", () => {
    expect(shouldReportActivationFailure(implicit, "activated")).toBe(true);
    expect(shouldReportActivationFailure(explicit, "already_active")).toBe(true);
  });

  it("answers failures only for explicit commands", () => {
    expect(shouldReportActivationFailure(explicit, "unknown_code")).toBe(true);
    expect(shouldReportActivationFailure(implicit, "unknown_code")).toBe(false);
  });
});
