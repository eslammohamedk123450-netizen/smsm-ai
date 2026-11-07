export function mapAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("not confirmed") || normalized.includes("email_not_confirmed") || normalized.includes("email not confirmed")) {
    return "لم يتم تأكيد هذا البريد الإلكتروني بعد. تحقّق من رسالة التأكيد في بريدك ثم حاول مجددًا.";
  }
  if (
    normalized.includes("invalid otp") ||
    normalized.includes("invalid token") ||
    normalized.includes("token has expired") ||
    normalized.includes("otp_expired") ||
    normalized.includes("otp is expired") ||
    normalized.includes("verification code")
  ) {
    return "رمز التحقق غير صحيح أو انتهت صلاحيته. راجعه أو اطلب رمزًا جديدًا.";
  }
  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("email rate limit")
  ) {
    return "أرسلت طلبات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مجددًا.";
  }
  if (normalized.includes("user not found") || normalized.includes("no user found")) {
    return "لا يوجد حساب بهذا البريد الإلكتروني. أنشئ حسابًا أولًا ثم سجّل الدخول.";
  }
  return "تعذّر إكمال تسجيل الدخول. تحقّق من البيانات والاتصال ثم حاول مجددًا.";
}
