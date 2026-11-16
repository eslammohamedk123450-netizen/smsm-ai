-- Provider credentials must never be readable through the client Data API.
-- Admin UI uses suly_admin_list_providers(), which returns only non-secret metadata.
-- Edge Functions continue to use service_role for server-side provider access.
revoke select on table public.ai_providers from authenticated;
