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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setStatus(nextSession?.user ? "authenticated" : "unauthenticated");
    });

    void authService.getSession().then((initialSession) => {
      if (!active) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setStatus(initialSession?.user ? "authenticated" : "unauthenticated");
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setUser(null);
      setStatus("unauthenticated");
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
      subscription.unsubscribe();
      appStateSubscription?.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    status,
    configurationError,
    async login(email, password) {
      await authService.signIn(email.trim(), password);
    },
    async register(email, password, fullName) {
      const result = await authService.signUp(email.trim(), password, fullName.trim());
      return result.session !== null;
    },
    async logout() {
      await authService.signOut();
    },
  }), [user, session, status, configurationError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
