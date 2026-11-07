// Global infrastructure: generic feature-activation command parser.
//
// A user activates any feature by sending `!ACTIVATE_<CODE>` in chat. The
// parser is feature-agnostic on purpose: the code itself decides which feature
// (and therefore which profile flag) is activated, using the
// suly_activation_codes -> suly_feature_flags rows. No Edge Function knows that
// "HIMS" exists.

export interface ActivationCommand {
  /** Uppercased, trimmed activation code without the `!ACTIVATE` prefix. */
  code: string;
  /** Original message text as typed by the user. */
  raw: string;
  /**
   * `true` when the user typed the `!ACTIVATE` command, `false` when the whole
   * message was nothing but a code. Explicit commands always get an activation
   * reply; bare codes only get one when they actually match, so an ordinary
   * one-word chat message is never answered with an activation error.
   */
  explicit: boolean;
}

// The command is found anywhere in the message, with any spacing or separator
// between `!ACTIVATE` and the code, so pasted text like
// "كود التفعيل: !ACTIVATE_HIMS-ABC123" still works.
const EXPLICIT_PATTERN = /!\s*activate\s*[_\s:.\-—]*\s*([A-Za-z0-9][A-Za-z0-9._-]{3,119})/i;
// A message that is nothing but a code, e.g. the admin's copy button output.
const BARE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{5,119}$/;

export function parseActivationCommand(text: string | null | undefined): ActivationCommand | null {
  if (typeof text !== "string") return null;
  const raw = text.trim();
  if (raw.length === 0 || raw.length > 500) return null;
  const explicit = EXPLICIT_PATTERN.exec(raw);
  if (explicit) {
    const code = explicit[1].trim().replace(/[._-]+$/, "").toUpperCase();
    if (code.length < 4) return null;
    return { code, raw, explicit: true };
  }
  if (BARE_CODE_PATTERN.test(raw)) {
    return { code: raw.toUpperCase(), raw, explicit: false };
  }
  return null;
}

export function isActivationCommand(text: string | null | undefined): boolean {
  return parseActivationCommand(text) !== null;
}

/** User-facing message keys; the router maps them to localized text. */
export type ActivationOutcome =
  | "activated"
  | "already_active"
  | "unknown_code"
  | "code_disabled"
  | "code_expired"
  | "code_exhausted"
  | "feature_disabled"
  | "profile_missing"
  | "invalid_code"
  | "unavailable";

export interface ActivationResult {
  outcome: ActivationOutcome;
  featureKey: string | null;
  label: string | null;
  /** Success text owned by the feature row, when it defines one. */
  activationMessage: string | null;
}

/**
 * Maps the raw JSON returned by `suly_activate_feature` to a bounded outcome so
 * no server error text ever reaches the client.
 */
export function interpretActivationResponse(payload: unknown): ActivationResult {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const featureKey = typeof record.feature_key === "string" ? record.feature_key : null;
  const label = typeof record.label === "string" ? record.label : null;
  const activationMessage = typeof record.activation_message === "string" && record.activation_message.trim().length > 0
    ? record.activation_message.trim()
    : null;
  if (record.success === true) {
    return {
      outcome: record.already_active === true ? "already_active" : "activated",
      featureKey,
      label,
      activationMessage,
    };
  }
  const error = typeof record.error === "string" ? record.error : "";
  const allowed: ActivationOutcome[] = [
    "unknown_code",
    "code_disabled",
    "code_expired",
    "code_exhausted",
    "feature_disabled",
    "profile_missing",
    "invalid_code",
  ];
  const outcome = (allowed as string[]).includes(error) ? error as ActivationOutcome : "unavailable";
  return { outcome, featureKey, label, activationMessage: null };
}

const OUTCOME_TEXT: Record<ActivationOutcome, string> = {
  activated: "تم تفعيل الميزة بنجاح. يمكنك الآن طلب محتواها مباشرة في المحادثة.",
  already_active: "هذه الميزة مفعّلة على حسابك بالفعل. يمكنك طلب محتواها مباشرة.",
  unknown_code: "كود التفعيل غير صحيح. تأكد من نسخه كاملًا ثم أعد المحاولة.",
  code_disabled: "هذا الكود معطّل حاليًا. تواصل مع الدعم للحصول على كود جديد.",
  code_expired: "انتهت صلاحية كود التفعيل. اطلب كودًا جديدًا.",
  code_exhausted: "استُهلك هذا الكود بالكامل. اطلب كودًا جديدًا.",
  feature_disabled: "هذه الميزة غير متاحة حاليًا.",
  profile_missing: "تعذر العثور على ملف حسابك. سجّل الخروج ثم الدخول من جديد.",
  invalid_code: "صيغة كود التفعيل غير صحيحة.",
  unavailable: "تعذر إتمام التفعيل الآن. حاول مرة أخرى بعد قليل.",
};

/**
 * Renders the reply for an activation attempt. A feature that ships its own
 * `activation_message` (data, not code) speaks with its own voice; otherwise the
 * generic wording is used.
 */
export function activationOutcomeMessage(
  outcome: ActivationOutcome,
  label: string | null,
  activationMessage: string | null = null,
): string {
  if (activationMessage && (outcome === "activated" || outcome === "already_active")) {
    return activationMessage;
  }
  const prefix = label ? `${label}: ` : "";
  return `${prefix}${OUTCOME_TEXT[outcome] ?? OUTCOME_TEXT.unavailable}`;
}

/**
 * A bare code that does not match any feature must not interrupt the chat, so
 * only explicit commands answer failures.
 */
export function shouldReportActivationFailure(command: ActivationCommand, outcome: ActivationOutcome): boolean {
  if (outcome === "activated" || outcome === "already_active") return true;
  return command.explicit;
}
