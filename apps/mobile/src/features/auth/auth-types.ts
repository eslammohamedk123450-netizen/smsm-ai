import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "misconfigured";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  configurationError: string | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, fullName: string): Promise<boolean>;
  logout(): Promise<void>;
}
