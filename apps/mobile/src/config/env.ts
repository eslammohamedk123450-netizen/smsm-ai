import { supabaseConfig } from "../supabase/client";

declare global {
  namespace NodeJS {
    interface Process {
      env: {
        EXPO_PUBLIC_SUPABASE_URL: string;
        EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
        EXPO_PUBLIC_EDGE_FUNCTION_BASE_URL?: string;
      };
    }
  }
}

// Validate required environment variables
if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL is not set");
}

if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_ANON_KEY is not set");
}

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  edgeFunctionBaseUrl: process.env.EXPO_PUBLIC_EDGE_FUNCTION_BASE_URL,
};