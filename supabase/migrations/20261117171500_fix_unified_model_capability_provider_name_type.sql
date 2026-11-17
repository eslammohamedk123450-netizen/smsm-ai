-- Fix provider_name's declared TEXT return type in the unified capability list.
-- The underlying ai_providers.name column is VARCHAR; cast explicitly to TEXT.
create or replace function public.suly_admin_list_unified_model_capabilities()
returns table (
  model_id uuid, provider_id integer, provider_name text, service_type text, model_identifier text,
  display_name text, lifecycle_state text, legacy_chat_model_id integer,
  legacy_media_model_id uuid, capability_key text, review_status text, vendor_claim_status text,
  vendor_evidence_url text, provider_test_status text, provider_evidence_url text,
  provider_tested_at timestamptz, suly_test_status text, suly_evidence_url text,
  suly_tested_at timestamptz, notes text, provenance jsonb, updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.provider_id,
    p.name::text,
    r.service_type,
    r.model_identifier,
    r.display_name,
    r.lifecycle_state,
    r.legacy_chat_model_id,
    r.legacy_media_model_id,
    c.capability_key,
    c.review_status,
    c.vendor_claim_status,
    c.vendor_evidence_url,
    c.provider_test_status,
    c.provider_evidence_url,
    c.provider_tested_at,
    c.suly_test_status,
    c.suly_evidence_url,
    c.suly_tested_at,
    c.notes,
    c.provenance,
    c.updated_at
  from public.suly_model_registry r
  left join public.ai_providers p on p.id = r.provider_id
  left join public.suly_model_capabilities c on c.model_id = r.id
  order by r.service_type, r.display_name, c.capability_key;
end;
$$;
