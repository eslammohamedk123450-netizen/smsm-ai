jest.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
    },
  },
}));

import { supabase } from "../../lib/supabase/client";
import { authService, EMAIL_LINK_REDIRECT } from "./auth-service";

const auth = supabase.auth as unknown as {
  signInWithOtp: jest.Mock;
  verifyOtp: jest.Mock;
};

describe("email authentication", () => {
  beforeEach(() => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  });

  it("requests email OTP without enabling account creation", async () => {
    await authService.sendEmailOtp("person@example.com");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: { shouldCreateUser: false },
    });
  });

  it("uses the configured native callback for email-link sign-in", async () => {
    await authService.sendEmailLink("person@example.com");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: { shouldCreateUser: false, emailRedirectTo: EMAIL_LINK_REDIRECT },
    });
    expect(EMAIL_LINK_REDIRECT).toBe("suly-agent-ai://auth/callback");
  });

  it("verifies the supplied six-digit email code", async () => {
    await authService.verifyEmailOtp("person@example.com", "123456");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "person@example.com", token: "123456", type: "email" });
  });
});
