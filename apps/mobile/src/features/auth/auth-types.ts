import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "misconfigured";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profileFullName: string | null;
  status: AuthStatus;
  configurationError: string | null;
  sendEmailOtp(email: string): Promise<void>;
  verifyEmailOtp(email: string, token: string): Promise<void>;
  sendEmailLink(email: string): Promise<void>;
  register(email: string, password: string, fullName: string): Promise<boolean>;
  logout(): Promise<void>;
}
