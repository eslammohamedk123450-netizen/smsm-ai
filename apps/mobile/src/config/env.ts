const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const configuredEdgeBaseUrl = process.env.EXPO_PUBLIC_EDGE_FUNCTION_BASE_URL?.trim();

function validHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  edgeFunctionBaseUrl: (configuredEdgeBaseUrl || `${supabaseUrl.replace(/\/$/, "")}/functions/v1`).replace(/\/+$/, ""),
  isConfigured: validHttpsUrl(supabaseUrl) && supabaseAnonKey.length > 0,
};
