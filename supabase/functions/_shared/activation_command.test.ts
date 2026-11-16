import {
  activationOutcomeMessage,
  interpretActivationResponse,
  parseActivationCommand,
  shouldReportActivationFailure,
} from "./activation_command.ts";

Deno.test("explicit activation commands accept supported separators and normalize codes", () => {
  const inputs = [
    "!ACTIVATE_HIMS-ABC123456",
    "! activate HIMS-ABC123456",
    "كود التفعيل: !ACTIVATE_HIMS-ABC123456",
    "!ACTIVATE HIMS-ABC123456",
  ];
  for (const input of inputs) {
    const parsed = parseActivationCommand(input);
    if (!parsed || !parsed.explicit || parsed.code !== "HIMS-ABC123456") {
      throw new Error(`failed to parse explicit activation command: ${input}`);
    }
  }
});

Deno.test("bare activation codes are recognized without converting ordinary short chat into commands", () => {
  const parsed = parseActivationCommand("  hims-abc123456  ");
  if (!parsed || parsed.explicit || parsed.code !== "HIMS-ABC123456") {
    throw new Error("bare code should be trimmed and normalized");
  }
  for (const message of ["", "هلا", "تمام", "شكرا", "hello"]) {
    if (parseActivationCommand(message) !== null) throw new Error(`unexpected activation command: ${message}`);
  }
});

Deno.test("malformed and oversized activation messages are rejected", () => {
  for (const message of [null, undefined, "   ", "!ACTIVATE_", "!ACTIVATE_###", "x".repeat(501)]) {
    if (parseActivationCommand(message) !== null) throw new Error("malformed activation input was accepted");
  }
});

Deno.test("activation RPC payloads are reduced to safe known outcomes", () => {
  const success = interpretActivationResponse({
    success: true,
    feature_key: "hims",
    label: "HIMS",
    activation_message: "تم التفعيل",
  });
  if (success.outcome !== "activated" || success.activationMessage !== "تم التفعيل") {
    throw new Error("valid activation response was not interpreted");
  }
  const failure = interpretActivationResponse({ success: false, error: "database secret detail" });
  if (failure.outcome !== "unavailable" || failure.activationMessage !== null) {
    throw new Error("untrusted database error text was not safely bounded");
  }
  if (activationOutcomeMessage("activated", "HIMS", "رسالة مخصصة") !== "رسالة مخصصة") {
    throw new Error("feature activation message was not preserved");
  }
});

Deno.test("unknown bare codes do not interrupt ordinary chat, explicit failures do", () => {
  const bare = parseActivationCommand("HIMS-ABC123456");
  const explicit = parseActivationCommand("!ACTIVATE_HIMS-ABC123456");
  if (!bare || !explicit) throw new Error("test commands should parse");
  if (shouldReportActivationFailure(bare, "unknown_code")) throw new Error("unknown bare code should not interrupt chat");
  if (!shouldReportActivationFailure(explicit, "unknown_code")) throw new Error("explicit activation failure should be reported");
  if (!shouldReportActivationFailure(bare, "activated")) throw new Error("successful bare activation should be confirmed");
});
