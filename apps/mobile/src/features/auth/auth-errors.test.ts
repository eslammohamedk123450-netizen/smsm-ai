import { mapAuthError } from "./auth-errors";

describe("mapAuthError", () => {
  it("explains that an unconfirmed email needs confirmation", () => {
    expect(mapAuthError(new Error("Email not confirmed"))).toContain("لم يتم تأكيد هذا البريد الإلكتروني");
  });

  it("explains invalid and expired OTP codes", () => {
    expect(mapAuthError(new Error("Token has expired or is invalid"))).toContain("رمز التحقق غير صحيح");
  });

  it("explains email-send rate limits", () => {
    expect(mapAuthError(new Error("over_email_send_rate_limit"))).toContain("أرسلت طلبات كثيرة");
  });
});
