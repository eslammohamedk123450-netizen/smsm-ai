import { AppState, Platform } from "react-native";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { env } from "../../config/env";
import { supabase } from "../../lib/supabase/client";
import { authService } from "./auth-service";
import type { AuthContextValue } from "./auth-types";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profileFullName, setProfileFullName] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const configurationError = env.isConfigured
    ? null
    : "أضف EXPO_PUBLIC_SUPABASE_URL وEXPO_PUBLIC_SUPABASE_ANON_KEY إلى ملف .env باستخدام القيم العامة للمشروع.";

  useEffect(() => {
    if (!env.isConfigured) {
      setStatus("misconfigured");
      return;
    }

    let active = true;
    let currentUserId: string | null = null;
    let bootstrapTimer: ReturnType<typeof setTimeout> | undefined;
    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      if (bootstrapTimer) {
        clearTimeout(bootstrapTimer);
        bootstrapTimer = undefined;
      }
      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      if (currentUserId !== nextUserId) setProfileFullName(null);
      currentUserId = nextUserId;
      setSession(nextSession);
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "unauthenticated");
      // Profile sync is started by the auth service and must not block auth state.
    };

    // Never leave the browser trapped on the initial spinner if session storage
    // or the first Supabase auth event stalls. A late session result can still
    // upgrade this temporary signed-out state to the real authenticated state.
    if (Platform.OS === "web") {
      bootstrapTimer = setTimeout(() => applySession(null), 5000);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    void authService.getSession().then(applySession).catch(() => {
      if (!active || currentUserId) return;
      // A transient session-read failure must not erase a session already restored by an auth event.
      applySession(null);
    });

    const appStateSubscription = Platform.OS === "web"
      ? null
      : AppState.addEventListener("change", (nextState) => {
          if (nextState === "active") void supabase.auth.startAutoRefresh();
          else void supabase.auth.stopAutoRefresh();
        });
    if (Platform.OS !== "web" && AppState.currentState === "active") {
      void supabase.auth.startAutoRefresh();
    }

    return () => {
      active = false;
      if (bootstrapTimer) clearTimeout(bootstrapTimer);
      subscription.unsubscribe();
      appStateSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setProfileFullName(null);
      return;
    }
    let active = true;
    void Promise.resolve(supabase.from("suly_profiles").select("full_name").eq("id", userId).maybeSingle())
      .then(({ data }) => {
        if (active) setProfileFullName(typeof data?.full_name === "string" ? data.full_name : null);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [user?.id]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profileFullName,
    status,
    configurationError,
    async sendEmailOtp(email) {
      await authService.sendEmailOtp(email.trim());
    },
    async signInWithPassword(email, password) {
      const result = await authService.signInWithPassword(email.trim(), password);
      if (!result.session?.user) throw new Error("Password authentication did not return a session.");
      return result.session;
    },
    async verifyEmailOtp(email, token) {
      const result = await authService.verifyEmailOtp(email.trim(), token.trim());
      if (!result.session?.user) throw new Error("Email verification did not return a session.");
      return result.session;
    },
    async sendEmailLink(email) {
      await authService.sendEmailLink(email.trim());
    },
    async signInWithGoogle() {
      return authService.signInWithGoogle();
    },
    async register(email, password, fullName) {
      const result = await authService.signUp(email.trim(), password, fullName.trim());
      return result.session !== null;
    },
    async logout() {
      await authService.signOut();
    },
  }), [user, session, profileFullName, status, configurationError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
