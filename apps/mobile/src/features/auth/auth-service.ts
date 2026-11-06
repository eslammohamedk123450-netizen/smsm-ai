import { supabase } from "../lib/supabase/client";
import { getSession, getUser, signIn, signOut, signUp } from "../lib/supabase/auth-storage";

export interface UserEntity {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role?: "user" | "admin";
  creditBalance?: number;
  subscriptionTier?: "free" | "premium" | "pro";
}

export const authService = {
  async getCurrentUser(): Promise<UserEntity | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    return {
      id: data.user.id,
      email: data.user.email ?? "",
      fullName: user?.full_name,
      avatarUrl: user?.avatar_url,
      role: user?.role,
      creditBalance: user?.credit_balance,
      subscriptionTier: user?.subscription_tier,
    };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.edgeFunctionBaseUrl}/recovery`,
    });
    if (error) throw new Error(error.message);
  },
};