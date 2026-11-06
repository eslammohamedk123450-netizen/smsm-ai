import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";

export const supabase: SupabaseClient = createClient(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storage: {
        getItem: (key: string) => {
          const value = typeof window !== "undefined" ? localStorage.getItem(key) : null;
          return value ? JSON.parse(value) : null;
        },
        setItem: (key: string, value: any) => {
          if (typeof window !== "undefined") {
            localStorage.setItem(key, JSON.stringify(value));
          }
        },
        removeItem: (key: string) => {
          if (typeof window !== "undefined") {
            localStorage.removeItem(key);
          }
        },
      } as any,
    },
  }
);