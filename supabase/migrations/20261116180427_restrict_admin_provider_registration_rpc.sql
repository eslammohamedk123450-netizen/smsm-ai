begin;

-- Provider onboarding is invoked only by the sync-models Edge Function.
-- That function verifies the caller JWT and suly_is_admin() before using
-- its server-only service-role client. Do not expose this SECURITY DEFINER
-- Vault-writing RPC to browser-authenticated or anonymous clients.
revoke all on function public.suly_admin_add_provider(uuid, text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.suly_admin_add_provider(uuid, text, text, text, text, text)
  to service_role;

commit;
