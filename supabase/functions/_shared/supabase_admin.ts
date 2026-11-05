import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}

export async function getEncryptedApiKey(provider: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('api_keys')
    .select('encrypted_key, base_url, is_active')
    .eq('provider', provider)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  const { data: decrypted, error: decryptError } = await supabase.rpc('decrypt_api_key', {
    encrypted_key: data.encrypted_key,
  });

  if (decryptError || !decrypted) {
    return null;
  }

  return decrypted as string;
}

export async function verifyUserToken(jwt: string): Promise<{ userId: string; email: string; role: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(jwt);

  if (error || !data.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, is_banned, credit_balance, subscription_tier')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  if (profile.is_banned) {
    return null;
  }

  return {
    userId: profile.id,
    email: profile.email,
    role: profile.role,
  };
}
