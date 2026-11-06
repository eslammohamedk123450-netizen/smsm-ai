import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { env } from "../../config/env";
import { authStorage } from "./auth-storage";

// The placeholder permits a readable configuration error instead of an import-time crash.
// Auth calls are skipped unless env.isConfigured is true.
export const supabase = createClient(
  env.supabaseUrl || "https://invalid.supabase.local",
  env.supabaseAnonKey || "missing-public-key",
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
      flowType: "pkce",
    },
  },
);
