// Global infrastructure: generic feature-activation command parser.
//
// A user activates any feature by sending `!ACTIVATE_<CODE>` in chat. The
// parser is feature-agnostic on purpose: the code itself decides which feature
// (and therefore which profile flag) is activated, using the
// suly_activation_codes -> suly_feature_flags rows. No Edge Function knows that
// "HIMS" exists.

export interface ActivationCommand {
  /** Uppercased, trimmed activation code without the `!ACTIVATE_` prefix. */
  code: string;
  /** Original command text as typed by the user. */
  raw: string;
}

const ACTIVATION_PATTERN = /^\s*!activate[_-]([A-Za-z0-9][A-Za-z0-9._-]{3,119})\s*$/i;

export function parseActivationCommand(text: string | null | undefined): ActivationCommand | null {
  if (typeof text !== "string") return null;
  const match = ACTIVATION_PATTERN.exec(text);
  if (!match) return null;
  const code = match[1].trim().toUpperCase();
  if (code.length < 4) return null;
  return { code, raw: text.trim() };
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
}

/**
 * Maps the raw JSON returned by `suly_activate_feature` to a bounded outcome so
 * no server error text ever reaches the client.
 */
export function interpretActivationResponse(payload: unknown): ActivationResult {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const featureKey = typeof record.feature_key === "string" ? record.feature_key : null;
  const label = typeof record.label === "string" ? record.label : null;
  if (record.success === true) {
    return {
      outcome: record.already_active === true ? "already_active" : "activated",
      featureKey,
      label,
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
  return { outcome, featureKey, label };
}

const OUTCOME_TEXT: Record<ActivationOutcome, string> = {
  activated: "تم تفعيل الميزة بنجاح. يمكنك الآن طلب محتواها مباشرة في المحادثة.",
  already_active: "هذه الميزة مفعّلة على حسابك بالفعل.",
  unknown_code: "كود التفعيل غير صحيح. تأكد من نسخه كاملًا ثم أعد المحاولة.",
  code_disabled: "هذا الكود معطّل حاليًا. تواصل مع الدعم للحصول على كود جديد.",
  code_expired: "انتهت صلاحية كود التفعيل. اطلب كودًا جديدًا.",
  code_exhausted: "استُهلك هذا الكود بالكامل. اطلب كودًا جديدًا.",
  feature_disabled: "هذه الميزة غير متاحة حاليًا.",
  profile_missing: "تعذر العثور على ملف حسابك. سجّل الخروج ثم الدخول من جديد.",
  invalid_code: "صيغة كود التفعيل غير صحيحة.",
  unavailable: "تعذر إتمام التفعيل الآن. حاول مرة أخرى بعد قليل.",
};

export function activationOutcomeMessage(outcome: ActivationOutcome, label: string | null): string {
  const prefix = label ? `${label}: ` : "";
  return `${prefix}${OUTCOME_TEXT[outcome] ?? OUTCOME_TEXT.unavailable}`;
}
