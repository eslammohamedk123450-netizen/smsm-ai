import { supabase } from "../lib/supabase/client";

export interface ApiKey {
  id: string;
  provider: string;
  is_active: boolean;
  created_at: string;
}

export interface Model {
  id: string;
  model_name: string;
  provider: string;
  display_name: string;
  category: "free" | "premium";
  enabled: boolean;
}

export interface User {
  id: string;
  email: string;
  role: "user" | "admin";
  credit_balance: number;
}

export const adminService = {
  async getApiKeys(): Promise<ApiKey[]> {
    const { data, error } = await supabase
      .from("api_keys")
      .select("*");
    
    if (error) throw new Error(error.message);
    return data || [];
  },

  async toggleApiKey(id: string, isActive: boolean): Promise<ApiKey> {
    const { data, error } = await supabase
      .from("api_keys")
      .update({ is_active: isActive })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async getModels(): Promise<Model[]> {
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .eq("enabled", true);

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin");

    if (error) throw new Error(error.message);
    return data || [];
  },

  async updateUserCredits(userId: string, amount: number): Promise<User> {
    const { data, error } = await supabase
      .rpc('update_user_credits', { p_user_id: userId, p_amount: amount });

    if (error) throw new Error(error.message);
    return data;
  },
};