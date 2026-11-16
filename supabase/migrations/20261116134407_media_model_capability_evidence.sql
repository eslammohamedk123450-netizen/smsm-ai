begin;
create table if not exists public.suly_media_model_capability_evidence (
  provider_id integer not null references public.ai_providers(id) on delete restrict,
  service_type text not null check (service_type in ('image','video','audio')),
  model_identifier text not null check (length(btrim(model_identifier)) between 1 and 200),
  capability_key text not null check (capability_key in (
    'chat','text','vision','pdf','pdf_input','word','file_input','video','video_input',
    'audio_input','audio_output','image_generation','video_generation','transcription',
    'function_calling','structured_output','streaming','web_search','file_search',
    'computer_use','code_interpreter','mcp_tools','gmail','google_drive','github'
  )),
  vendor_claim_status text not null default 'unknown' check (vendor_claim_status in ('unknown','supported','unsupported')),
  vendor_evidence_url text,
  provider_test_status text not null default 'not_tested' check (provider_test_status in ('not_tested','passed','failed')),
  provider_evidence_url text,
  provider_tested_at timestamptz,
  suly_test_status text not null default 'not_tested' check (suly_test_status in ('not_tested','passed','failed')),
  suly_evidence_url text,
  suly_tested_at timestamptz,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(provider_id,service_type,model_identifier,capability_key),
  check(vendor_evidence_url is null or vendor_evidence_url ~* '^https://'),
  check(provider_evidence_url is null or provider_evidence_url ~* '^https://'),
  check(suly_evidence_url is null or suly_evidence_url ~* '^https://'),
  check(notes is null or length(notes)<=2000),
  check(suly_test_status<>'passed' or provider_test_status='passed'),
  check(vendor_claim_status='unknown' or vendor_evidence_url is not null),
  check(provider_test_status='not_tested' or provider_evidence_url is not null),
  check(suly_test_status='not_tested' or suly_evidence_url is not null)
);
comment on table public.suly_media_model_capability_evidence is
  'Vendor, provider-test and SULY-integration evidence for media model/service identities; distinct from versioned media pricing and runtime activation.';
alter table public.suly_media_model_capability_evidence enable row level security;
revoke all on public.suly_media_model_capability_evidence from public,anon,authenticated;

create or replace function public.suly_admin_list_media_model_capability_evidence()
returns setof public.suly_media_model_capability_evidence
language plpgsql stable security definer set search_path=public
as $$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode='42501';
  end if;
  return query select e.* from public.suly_media_model_capability_evidence e
    order by e.service_type,e.display_name nulls last,e.model_identifier,e.capability_key;
end;
$$;

create or replace function public.suly_admin_save_media_model_capability_evidence(
  p_provider_id integer,p_service_type text,p_model_identifier text,p_capability_key text,
  p_vendor_claim_status text,p_vendor_evidence_url text default null,
  p_provider_test_status text default 'not_tested',p_provider_evidence_url text default null,
  p_suly_test_status text default 'not_tested',p_suly_evidence_url text default null,p_notes text default null
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_admin uuid:=auth.uid();
  v_old jsonb;
  v_new public.suly_media_model_capability_evidence%rowtype;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode='42501';
  end if;
  if p_provider_id is null or p_service_type not in ('image','video','audio')
     or p_model_identifier is null or length(btrim(p_model_identifier)) not between 1 and 200
     or not exists(select 1 from public.suly_media_model_price_versions p
       where p.provider_id=p_provider_id and p.service_type=p_service_type and p.model_identifier=p_model_identifier)
     or p_capability_key not in (
       'chat','text','vision','pdf','pdf_input','word','file_input','video','video_input',
       'audio_input','audio_output','image_generation','video_generation','transcription',
       'function_calling','structured_output','streaming','web_search','file_search',
       'computer_use','code_interpreter','mcp_tools','gmail','google_drive','github'
     )
     or p_vendor_claim_status not in ('unknown','supported','unsupported')
     or p_provider_test_status not in ('not_tested','passed','failed')
     or p_suly_test_status not in ('not_tested','passed','failed')
     or (p_vendor_claim_status<>'unknown' and nullif(btrim(p_vendor_evidence_url),'') is null)
     or (p_provider_test_status<>'not_tested' and nullif(btrim(p_provider_evidence_url),'') is null)
     or (p_suly_test_status<>'not_tested' and nullif(btrim(p_suly_evidence_url),'') is null)
     or (p_suly_test_status='passed' and p_provider_test_status<>'passed')
     or (p_vendor_evidence_url is not null and p_vendor_evidence_url !~* '^https://')
     or (p_provider_evidence_url is not null and p_provider_evidence_url !~* '^https://')
     or (p_suly_evidence_url is not null and p_suly_evidence_url !~* '^https://')
     or length(coalesce(p_notes,''))>2000 then
    raise exception 'invalid media capability evidence values' using errcode='22023';
  end if;
  select to_jsonb(e) into v_old from public.suly_media_model_capability_evidence e
    where e.provider_id=p_provider_id and e.service_type=p_service_type
      and e.model_identifier=p_model_identifier and e.capability_key=p_capability_key;
  insert into public.suly_media_model_capability_evidence(
    provider_id,service_type,model_identifier,capability_key,vendor_claim_status,vendor_evidence_url,
    provider_test_status,provider_evidence_url,provider_tested_at,suly_test_status,suly_evidence_url,
    suly_tested_at,notes,updated_by,updated_at
  ) values (
    p_provider_id,p_service_type,p_model_identifier,p_capability_key,p_vendor_claim_status,nullif(btrim(p_vendor_evidence_url),''),
    p_provider_test_status,nullif(btrim(p_provider_evidence_url),''),
    case when p_provider_test_status in ('passed','failed') then now() else null end,
    p_suly_test_status,nullif(btrim(p_suly_evidence_url),''),
    case when p_suly_test_status in ('passed','failed') then now() else null end,
    nullif(btrim(p_notes),''),v_admin,now()
  )
  on conflict(provider_id,service_type,model_identifier,capability_key) do update set
    vendor_claim_status=excluded.vendor_claim_status,vendor_evidence_url=excluded.vendor_evidence_url,
    provider_test_status=excluded.provider_test_status,provider_evidence_url=excluded.provider_evidence_url,
    provider_tested_at=excluded.provider_tested_at,suly_test_status=excluded.suly_test_status,
    suly_evidence_url=excluded.suly_evidence_url,suly_tested_at=excluded.suly_tested_at,
    notes=excluded.notes,updated_by=excluded.updated_by,updated_at=now()
  returning * into v_new;
  insert into public.admin_audit_logs(admin_id,action,target_table,target_id,old_value,new_value,created_at)
  values(v_admin,'media_model_capability_evidence_updated','suly_media_model_capability_evidence',
    p_provider_id::text||':'||p_service_type||':'||p_model_identifier||':'||p_capability_key,
    v_old,to_jsonb(v_new),now());
  return jsonb_build_object('success',true,'provider_id',p_provider_id,'service_type',p_service_type,
    'model_identifier',p_model_identifier,'capability_key',p_capability_key,
    'vendor_claim_status',v_new.vendor_claim_status,'provider_test_status',v_new.provider_test_status,
    'suly_test_status',v_new.suly_test_status,'updated_at',v_new.updated_at);
end;
$$;
revoke all on function public.suly_admin_list_media_model_capability_evidence() from public,anon;
revoke all on function public.suly_admin_save_media_model_capability_evidence(integer,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.suly_admin_list_media_model_capability_evidence() to authenticated;
grant execute on function public.suly_admin_save_media_model_capability_evidence(integer,text,text,text,text,text,text,text,text,text,text) to authenticated;
commit;