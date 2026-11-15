import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../lib/supabase/client";
import { parseAuthCallbackUrl } from "./auth-callback";

const AUTH_REQUEST_TIMEOUT_MS = 20_000;
const OAUTH_BROWSER_TIMEOUT_MS = 120_000;

function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number, action: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${action} timed out after ${Math.round(timeoutMs / 1000)} seconds. Please check your connection and try again.`)), timeoutMs);
    }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
}

function syncProfileInBackground(user: User): void {
  void authService.syncProfile(user).catch(() => undefined);
}

export const EMAIL_LINK_REDIRECT = "suly-agent-ai://auth/callback";
export const GOOGLE_AUTH_REDIRECT = EMAIL_LINK_REDIRECT;

function getAuthRedirect(): string {
  return Platform.OS === "web" ? `${window.location.origin}/auth/callback` : EMAIL_LINK_REDIRECT;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
}

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(), AUTH_REQUEST_TIMEOUT_MS, "Loading your session",
    );
    if (error) throw error;
    return data.session;
  },

  async sendEmailOtp(email: string): Promise<void> {
    const { error } = await withTimeout(
      supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }),
      AUTH_REQUEST_TIMEOUT_MS,
      "Sending the email verification code",
    );
    if (error) throw error;
  },

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      AUTH_REQUEST_TIMEOUT_MS,
      "Signing in",
    );
    if (error) throw error;
    if (!data.session?.user) throw new Error("Password authentication did not return a session.");
    syncProfileInBackground(data.session.user);
    return { user: data.user, session: data.session };
  },

  async verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
    const { data, error } = await withTimeout(
      supabase.auth.verifyOtp({ email, token, type: "email" }),
      AUTH_REQUEST_TIMEOUT_MS,
      "Verifying the email code",
    );
    if (error) throw error;
    if (!data.session?.user) throw new Error("Email verification did not return a session.");
    syncProfileInBackground(data.session.user);
    return { user: data.user, session: data.session };
  },

  async sendEmailLink(email: string): Promise<void> {
    const { error } = await withTimeout(
      supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: getAuthRedirect() },
      }),
      AUTH_REQUEST_TIMEOUT_MS,
      "Sending the sign-in link",
    );
    if (error) throw error;
  },

  async signUp(email: string, password: string, fullName: string): Promise<AuthResult> {
    const { data, error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: getAuthRedirect() },
      }),
      AUTH_REQUEST_TIMEOUT_MS,
      "Creating your account",
    );
    if (error) throw error;
    return { user: data.user, session: data.session };
  },

  async signInWithGoogle(): Promise<Session> {
    const redirectTo = getAuthRedirect();
    const { data, error } = await withTimeout(
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== "web" },
      }),
      AUTH_REQUEST_TIMEOUT_MS,
      "Starting Google sign-in",
    );
    if (error) throw error;
    if (!data.url) throw new Error("OAuth redirect URL was not returned.");

    if (Platform.OS !== "web") {
      const result = await withTimeout(
        WebBrowser.openAuthSessionAsync(data.url, redirectTo),
        OAUTH_BROWSER_TIMEOUT_MS,
        "Waiting for Google sign-in",
      );
      if (result.type === "cancel" || result.type === "dismiss") {
        throw new Error("Authentication session was cancelled.");
      }
      if (result.type !== "success") {
        throw new Error("Google authentication did not complete.");
      }

      const params = parseAuthCallbackUrl(result.url);
      if (params.errorDescription) throw new Error(params.errorDescription);

      if (params.accessToken && params.refreshToken) {
        const { error: sessionError } = await withTimeout(
          supabase.auth.setSession({ access_token: params.accessToken, refresh_token: params.refreshToken }),
          AUTH_REQUEST_TIMEOUT_MS,
          "Finishing Google sign-in",
        );
        if (sessionError) throw sessionError;
      } else if (params.code) {
        const { error: exchangeError } = await withTimeout(
          supabase.auth.exchangeCodeForSession(params.code),
          AUTH_REQUEST_TIMEOUT_MS,
          "Finishing Google sign-in",
        );
        if (exchangeError) throw exchangeError;
      } else {
        const current = await withTimeout(
          supabase.auth.getSession(), AUTH_REQUEST_TIMEOUT_MS, "Checking the Google session",
        );
        if (!current.data.session) throw new Error("Google authentication did not return a session.");
      }
    }

    const { data: sessionData, error: sessionError } = await withTimeout(
      supabase.auth.getSession(), AUTH_REQUEST_TIMEOUT_MS, "Loading the signed-in session",
    );
    if (sessionError) throw sessionError;
    if (!sessionData.session?.user) throw new Error("Google authentication did not return a session.");
    // Profile creation must never block successful authentication or navigation.
    syncProfileInBackground(sessionData.session.user);
    return sessionData.session;
  },

  async syncProfile(user: User): Promise<void> {
    const metadata = user.user_metadata ?? {};
    const fullName = typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string" ? metadata.name : null;
    const avatarUrl = typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string" ? metadata.picture : null;
    const { error } = await withTimeout(
      supabase.rpc("suly_upsert_my_profile", {
        p_email: user.email ?? null,
        p_full_name: fullName,
        p_avatar_url: avatarUrl,
      }),
      AUTH_REQUEST_TIMEOUT_MS,
      "Syncing your profile",
    );
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    const { error } = await withTimeout(
      supabase.auth.signOut(), AUTH_REQUEST_TIMEOUT_MS, "Signing out",
    );
    if (error) throw error;
  },
};
