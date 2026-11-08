import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../lib/supabase/client";
import { parseAuthCallbackUrl } from "./auth-callback";

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
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async sendEmailOtp(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
  },

  async verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
    return { user: data.user, session: data.session };
  },

  async sendEmailLink(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: getAuthRedirect(),
      },
    });
    if (error) throw error;
  },

  async signUp(email: string, password: string, fullName: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: getAuthRedirect() },
    });
    if (error) throw error;
    return { user: data.user, session: data.session };
  },

  async signInWithGoogle(): Promise<void> {
    const redirectTo = Platform.OS === "web"
      ? `${window.location.origin}/auth/callback`
      : GOOGLE_AUTH_REDIRECT;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: Platform.OS !== "web",
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error("OAuth redirect URL was not returned.");
    if (Platform.OS !== "web") {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "cancel" || result.type === "dismiss") {
        throw new Error("Authentication session was cancelled.");
      }
      if (result.type === "success") {
        const current = await supabase.auth.getSession();
        if (!current.data.session) {
          const params = parseAuthCallbackUrl(result.url);
          if (params.accessToken && params.refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({ access_token: params.accessToken, refresh_token: params.refreshToken });
            if (sessionError) throw sessionError;
          } else if (params.code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
            if (exchangeError) throw exchangeError;
          } else {
            throw new Error("Google authentication did not return a session.");
          }
        }
        const session = (await supabase.auth.getSession()).data.session;
        if (session?.user) await this.syncProfile(session.user);
      }
    }
  },

  async syncProfile(user: User): Promise<void> {
    const metadata = user.user_metadata ?? {};
    const fullName = typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string" ? metadata.name : null;
    const avatarUrl = typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string" ? metadata.picture : null;
    const { error } = await supabase.rpc("suly_upsert_my_profile", {
      p_email: user.email ?? null,
      p_full_name: fullName,
      p_avatar_url: avatarUrl,
    });
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
