import { createContext, useContext, useEffect, useState, ReactNode, Dispatch, SetStateAction } from "react";
import { supabase } from "../lib/supabase/client";
import { getSession, getUser, signIn, signOut } from "../lib/supabase/auth-storage";
import { env } from "../config/env";

type AuthContextType = {
  user: any;
  session: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    getSession().then((session) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === "SIGNED_IN" || event === "SIGNED_UP") {
          // User signed in - check if email is confirmed
          const { data: userData } = await supabase
            .from("profiles")
            .select("email_confirmed")
            .eq("id", session.user.id)
            .single();

          if (!userData?.email_confirmed) {
            // Email not confirmed - sign out
            await supabase.auth.signOut();
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const data = await signIn(email, password);
    setUser(data.user);
    setSession(data.session);
  };

  const register = async (email: string, password: string) => {
    const data = await signUp(email, password);
    setUser(data.user);
    setSession(data.session);
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    setSession(null);
  };

  const refreshSession = async () => {
    const data = await getSession();
    setSession(data);
    if (data?.user) {
      setUser(data.user);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, register, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};