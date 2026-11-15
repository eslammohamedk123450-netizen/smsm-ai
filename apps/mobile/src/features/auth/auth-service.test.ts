jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: "cancel" }),
}));

jest.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      signInWithPassword: jest.fn(),
      verifyOtp: jest.fn(),
      signInWithOAuth: jest.fn(),
      getSession: jest.fn(),
      setSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

import { supabase } from "../../lib/supabase/client";
import { authService, EMAIL_LINK_REDIRECT } from "./auth-service";

const auth = supabase.auth as unknown as {
  signInWithOtp: jest.Mock;
  signInWithPassword: jest.Mock;
  verifyOtp: jest.Mock;
  signInWithOAuth: jest.Mock;
  getSession: jest.Mock;
  setSession: jest.Mock;
  exchangeCodeForSession: jest.Mock;
};
const rpc = (supabase as unknown as { rpc: jest.Mock }).rpc;

describe("email authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-123", email: "person@example.com" }, session: { user: { id: "user-123", email: "person@example.com" } } },
      error: null,
    });
    auth.verifyOtp.mockResolvedValue({
      data: { user: { id: "user-123", email: "person@example.com" }, session: { user: { id: "user-123", email: "person@example.com" } } },
      error: null,
    });
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    rpc.mockResolvedValue({ error: null });
  });

  it("requests email OTP without enabling account creation", async () => {
    await authService.sendEmailOtp("person@example.com");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: { shouldCreateUser: false },
    });
  });

  it("signs in existing users with email and password without waiting for profile sync", async () => {
    rpc.mockImplementation(() => new Promise(() => undefined));
    const result = await authService.signInWithPassword("person@example.com", "secret123");
    expect(result.session).toBeTruthy();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "person@example.com", password: "secret123" });
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

  it("starts Google OAuth and reports cancellation without hanging", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2/auth" }, error: null });
    await expect(authService.signInWithGoogle()).rejects.toThrow("cancelled");
    expect(auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: "google",
      options: expect.objectContaining({ redirectTo: expect.any(String) }),
    }));
  });
});
