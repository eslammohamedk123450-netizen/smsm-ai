-- Migration 012: Restrict the provider catalog view to read-only access.
begin;
revoke all on public.ai_providers_catalog from public, anon, authenticated;
grant select on public.ai_providers_catalog to authenticated;
commit;
