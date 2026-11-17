-- Canonical model registry and unified capability evidence.
-- This is an additive migration: operational model tables, routing, pricing,
-- wallet, provider credentials and activation flags remain unchanged.
create table if not exists public.suly_model_registry (
  id uuid primary key default gen_random_uuid(),
  provider_id integer not null,
  service_type text not null check (service_type in ('chat','image','video','audio')),
  model_identifier text not null check (length(btrim(model_identifier)) between 1 and 200),
  display_name text not null check (length(btrim(display_name)) between 1 and 180),
  lifecycle_state text not null default 'candidate' check (lifecycle_state in ('active','candidate','archived')),
  legacy_chat_model_id integer,
  legacy_media_model_id uuid,
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, service_type, model_identifier)
);

create index if not exists suly_model_registry_provider_idx
  on public.suly_model_registry(provider_id, service_type);
create index if not exists suly_model_registry_state_idx
  on public.suly_model_registry(lifecycle_state, service_type);

create table if not exists public.suly_model_capabilities (
  model_id uuid not null references public.suly_model_registry(id) on delete cascade,
  capability_key text not null,
  review_status text not null default 'suggested' check (review_status in ('suggested','legacy_unreviewed','approved','rejected')),
  vendor_claim_status text not null default 'unknown' check (vendor_claim_status in ('unknown','supported','unsupported')),
  vendor_evidence_url text,
  provider_test_status text not null default 'not_tested' check (provider_test_status in ('not_tested','passed','failed')),
  provider_evidence_url text,
  provider_tested_at timestamptz,
  suly_test_status text not null default 'not_tested' check (suly_test_status in ('not_tested','passed','failed')),
  suly_evidence_url text,
  suly_tested_at timestamptz,
  notes text check (notes is null or length(notes) <= 2000),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(model_id, capability_key),
  check (vendor_evidence_url is null or vendor_evidence_url ~* '^https://'),
  check (provider_evidence_url is null or provider_evidence_url ~* '^https://'),
  check (suly_evidence_url is null or suly_evidence_url ~* '^https://'),
  check (vendor_claim_status = 'unknown' or vendor_evidence_url is not null),
  check (provider_test_status = 'not_tested' or provider_evidence_url is not null),
  check (suly_test_status = 'not_tested' or suly_evidence_url is not null),
  check (suly_test_status <> 'passed' or provider_test_status = 'passed')
);

create table if not exists public.suly_model_registry_audit (
  id bigint generated always as identity primary key,
  model_id uuid references public.suly_model_registry(id) on delete set null,
  capability_key text,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists suly_model_registry_audit_model_idx
  on public.suly_model_registry_audit(model_id, created_at desc);

alter table public.suly_model_registry enable row level security;
alter table public.suly_model_capabilities enable row level security;
alter table public.suly_model_registry_audit enable row level security;

drop policy if exists suly_model_registry_admin_all on public.suly_model_registry;
create policy suly_model_registry_admin_all on public.suly_model_registry
  for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());
drop policy if exists suly_model_capabilities_admin_all on public.suly_model_capabilities;
create policy suly_model_capabilities_admin_all on public.suly_model_capabilities
  for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());
drop policy if exists suly_model_registry_audit_admin_read on public.suly_model_registry_audit;
create policy suly_model_registry_audit_admin_read on public.suly_model_registry_audit
  for select to authenticated using (public.suly_is_admin());

-- Backfill all operational chat models without changing their activation/routing fields.
insert into public.suly_model_registry
  (provider_id, service_type, model_identifier, display_name, lifecycle_state, legacy_chat_model_id, source_metadata)
select m.provider_id, 'chat', m.model_identifier, m.name,
       case when m.enabled then 'active' else 'candidate' end,
       m.id, jsonb_build_object('source_table','ai_models','legacy_model_id',m.id)
from public.ai_models m
on conflict (provider_id, service_type, model_identifier) do update
set legacy_chat_model_id = excluded.legacy_chat_model_id,
    display_name = excluded.display_name,
    source_metadata = suly_model_registry.source_metadata || excluded.source_metadata,
    updated_at = now();

-- Backfill media catalog entries. Pricing and activation remain in their original tables.
insert into public.suly_model_registry
  (provider_id, service_type, model_identifier, display_name, lifecycle_state, legacy_media_model_id, source_metadata)
select m.provider_id, m.service_type, m.model_identifier, m.display_name,
       case when m.is_active then 'active' else 'candidate' end,
       m.id, jsonb_build_object('source_table','suly_media_generation_models','legacy_model_id',m.id,'protocol',m.protocol)
from public.suly_media_generation_models m
on conflict (provider_id, service_type, model_identifier) do update
set legacy_media_model_id = excluded.legacy_media_model_id,
    display_name = excluded.display_name,
    source_metadata = suly_model_registry.source_metadata || excluded.source_metadata,
    updated_at = now();

-- Preserve evidence-only and price-history-only media identities as candidates;
-- never infer that such a record is enabled or currently routable.
insert into public.suly_model_registry
  (provider_id, service_type, model_identifier, display_name, lifecycle_state, source_metadata)
select distinct e.provider_id, e.service_type, e.model_identifier, e.model_identifier,
       'candidate', jsonb_build_object('source_table','suly_media_model_capability_evidence','historical_or_evidence_only',true)
from public.suly_media_model_capability_evidence e
on conflict (provider_id, service_type, model_identifier) do nothing;

insert into public.suly_model_registry
  (provider_id, service_type, model_identifier, display_name, lifecycle_state, source_metadata)
select distinct p.provider_id, p.service_type, p.model_identifier, p.display_name,
       'candidate', jsonb_build_object('source_table','suly_media_model_price_versions','historical_or_price_only',true)
from public.suly_media_model_price_versions p
on conflict (provider_id, service_type, model_identifier) do nothing;

-- Import existing text capability evidence.
insert into public.suly_model_capabilities
  (model_id, capability_key, review_status, vendor_claim_status, vendor_evidence_url,
   provider_test_status, provider_evidence_url, provider_tested_at,
   suly_test_status, suly_evidence_url, suly_tested_at, notes, updated_by, updated_at, provenance)
select r.id, e.capability_key, 'legacy_unreviewed', e.vendor_claim_status, e.vendor_evidence_url,
       e.provider_test_status, e.provider_evidence_url, e.provider_tested_at,
       e.suly_test_status, e.suly_evidence_url, e.suly_tested_at, e.notes,
       e.updated_by, e.updated_at, jsonb_build_object('source_table','ai_model_capability_evidence','legacy_model_id',e.model_id)
from public.ai_model_capability_evidence e
join public.ai_models m on m.id=e.model_id
join public.suly_model_registry r on r.provider_id=m.provider_id and r.service_type='chat' and r.model_identifier=m.model_identifier
on conflict (model_id, capability_key) do nothing;

-- Import all media evidence, including historical identities that are no longer catalogued.
insert into public.suly_model_capabilities
  (model_id, capability_key, review_status, vendor_claim_status, vendor_evidence_url,
   provider_test_status, provider_evidence_url, provider_tested_at,
   suly_test_status, suly_evidence_url, suly_tested_at, notes, updated_by, updated_at, provenance)
select r.id, e.capability_key, 'legacy_unreviewed', e.vendor_claim_status, e.vendor_evidence_url,
       e.provider_test_status, e.provider_evidence_url, e.provider_tested_at,
       e.suly_test_status, e.suly_evidence_url, e.suly_tested_at, e.notes,
       e.updated_by, e.updated_at, jsonb_build_object('source_table','suly_media_model_capability_evidence','provider_id',e.provider_id,'service_type',e.service_type,'model_identifier',e.model_identifier)
from public.suly_media_model_capability_evidence e
join public.suly_model_registry r on r.provider_id=e.provider_id and r.service_type=e.service_type and r.model_identifier=e.model_identifier
on conflict (model_id, capability_key) do nothing;

create or replace function public.suly_admin_list_unified_model_capabilities()
returns table (
  model_id uuid, provider_id integer, service_type text, model_identifier text,
  display_name text, lifecycle_state text, legacy_chat_model_id integer,
  legacy_media_model_id uuid, capability_key text, review_status text, vendor_claim_status text,
  vendor_evidence_url text, provider_test_status text, provider_evidence_url text,
  provider_tested_at timestamptz, suly_test_status text, suly_evidence_url text,
  suly_tested_at timestamptz, notes text, provenance jsonb, updated_at timestamptz
)
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if not public.suly_is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  return query
  select r.id,r.provider_id,r.service_type,r.model_identifier,r.display_name,r.lifecycle_state,
         r.legacy_chat_model_id,r.legacy_media_model_id,c.capability_key,c.review_status,c.vendor_claim_status,
         c.vendor_evidence_url,c.provider_test_status,c.provider_evidence_url,c.provider_tested_at,
         c.suly_test_status,c.suly_evidence_url,c.suly_tested_at,c.notes,c.provenance,c.updated_at
  from public.suly_model_registry r
  left join public.suly_model_capabilities c on c.model_id=r.id
  order by r.service_type,r.display_name,c.capability_key;
end;
$$;

create or replace function public.suly_admin_save_unified_model_capability(
  p_model_id uuid, p_capability_key text, p_vendor_claim_status text default 'unknown',
  p_vendor_evidence_url text default null, p_provider_test_status text default 'not_tested',
  p_provider_evidence_url text default null, p_suly_test_status text default 'not_tested',
  p_suly_evidence_url text default null, p_notes text default null,
  p_review_status text default 'legacy_unreviewed'
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_model public.suly_model_registry%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_actor uuid := auth.uid();
begin
  if not public.suly_is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_capability_key not in ('chat','text','vision','pdf','pdf_input','word','file_input','video','video_input','audio_input','audio_output','image_generation','video_generation','transcription','function_calling','structured_output','streaming','web_search','file_search','computer_use','code_interpreter','mcp_tools','gmail','google_drive','github') then
    raise exception 'invalid_capability_key' using errcode='22023';
  end if;
  if p_review_status not in ('suggested','legacy_unreviewed','approved','rejected') then
    raise exception 'invalid_review_status' using errcode='22023';
  end if;
  if p_vendor_claim_status not in ('unknown','supported','unsupported')
     or p_provider_test_status not in ('not_tested','passed','failed')
     or p_suly_test_status not in ('not_tested','passed','failed') then
    raise exception 'invalid_capability_status' using errcode='22023';
  end if;
  if p_suly_test_status='passed' and p_provider_test_status<>'passed' then
    raise exception 'provider_test_required_before_suly_pass' using errcode='23514';
  end if;
  if p_review_status='approved'
     and p_vendor_claim_status<>'supported'
     and p_provider_test_status<>'passed' then
    raise exception 'evidence_required_for_approval' using errcode='23514';
  end if;
  if length(coalesce(p_notes,''))>2000
     or (p_vendor_evidence_url is not null and p_vendor_evidence_url !~* '^https://')
     or (p_provider_evidence_url is not null and p_provider_evidence_url !~* '^https://')
     or (p_suly_evidence_url is not null and p_suly_evidence_url !~* '^https://')
     or (p_vendor_claim_status<>'unknown' and p_vendor_evidence_url is null)
     or (p_provider_test_status<>'not_tested' and p_provider_evidence_url is null)
     or (p_suly_test_status<>'not_tested' and p_suly_evidence_url is null) then
    raise exception 'invalid_capability_evidence' using errcode='22023';
  end if;
  select * into v_model from public.suly_model_registry where id=p_model_id for update;
  if not found then raise exception 'model_not_found' using errcode='P0002'; end if;
  if v_model.service_type='image' and p_capability_key not in ('text','image_generation','vision') then
    raise exception 'capability_not_applicable_to_image_model' using errcode='22023';
  elsif v_model.service_type='video' and p_capability_key not in ('text','video_generation','video_input','vision','audio_output') then
    raise exception 'capability_not_applicable_to_video_model' using errcode='22023';
  elsif v_model.service_type='audio' and p_capability_key not in ('text','audio_input','audio_output','transcription') then
    raise exception 'capability_not_applicable_to_audio_model' using errcode='22023';
  end if;
  select to_jsonb(c) into v_before from public.suly_model_capabilities c
    where c.model_id=p_model_id and c.capability_key=p_capability_key;
  insert into public.suly_model_capabilities
    (model_id,capability_key,review_status,vendor_claim_status,vendor_evidence_url,provider_test_status,
     provider_evidence_url,provider_tested_at,suly_test_status,suly_evidence_url,suly_tested_at,
     notes,updated_by,updated_at,provenance)
  values (p_model_id,p_capability_key,p_review_status,p_vendor_claim_status,nullif(p_vendor_evidence_url,''),
     p_provider_test_status,nullif(p_provider_evidence_url,''),
     case when p_provider_test_status='passed' then now() else null end,
     p_suly_test_status,nullif(p_suly_evidence_url,''),
     case when p_suly_test_status='passed' then now() else null end,
     nullif(p_notes,''),v_actor,now(),jsonb_build_object('source','unified_model_control_center'))
  on conflict (model_id,capability_key) do update set
    review_status=excluded.review_status,vendor_claim_status=excluded.vendor_claim_status,vendor_evidence_url=excluded.vendor_evidence_url,
    provider_test_status=excluded.provider_test_status,provider_evidence_url=excluded.provider_evidence_url,
    provider_tested_at=case when excluded.provider_test_status='passed' then now() else null end,
    suly_test_status=excluded.suly_test_status,suly_evidence_url=excluded.suly_evidence_url,
    suly_tested_at=case when excluded.suly_test_status='passed' then now() else null end,
    notes=excluded.notes,updated_by=v_actor,updated_at=now(),provenance=excluded.provenance;
  select to_jsonb(c) into v_after from public.suly_model_capabilities c
    where c.model_id=p_model_id and c.capability_key=p_capability_key;
  insert into public.suly_model_registry_audit(model_id,capability_key,action,before_state,after_state,actor_id)
  values(p_model_id,p_capability_key,case when p_review_status='approved' then 'capability_approved' when p_review_status='rejected' then 'capability_rejected' else 'capability_upsert' end,v_before,v_after,v_actor);

  -- Compatibility writes keep existing runtime/admin readers coherent during cutover.
  if v_model.service_type='chat' and v_model.legacy_chat_model_id is not null then
    insert into public.ai_model_capability_evidence
      (model_id,capability_key,vendor_claim_status,vendor_evidence_url,provider_test_status,
       provider_evidence_url,provider_tested_at,suly_test_status,suly_evidence_url,suly_tested_at,notes,updated_by,updated_at)
    values(v_model.legacy_chat_model_id,p_capability_key,p_vendor_claim_status,nullif(p_vendor_evidence_url,''),
       p_provider_test_status,nullif(p_provider_evidence_url,''),
       case when p_provider_test_status='passed' then now() else null end,
       p_suly_test_status,nullif(p_suly_evidence_url,''),
       case when p_suly_test_status='passed' then now() else null end,nullif(p_notes,''),v_actor,now())
    on conflict(model_id,capability_key) do update set
      vendor_claim_status=excluded.vendor_claim_status,vendor_evidence_url=excluded.vendor_evidence_url,
      provider_test_status=excluded.provider_test_status,provider_evidence_url=excluded.provider_evidence_url,
      provider_tested_at=excluded.provider_tested_at,suly_test_status=excluded.suly_test_status,
      suly_evidence_url=excluded.suly_evidence_url,suly_tested_at=excluded.suly_tested_at,
      notes=excluded.notes,updated_by=v_actor,updated_at=now();
  elsif v_model.service_type in ('image','video','audio') then
    insert into public.suly_media_model_capability_evidence
      (provider_id,service_type,model_identifier,capability_key,vendor_claim_status,vendor_evidence_url,
       provider_test_status,provider_evidence_url,provider_tested_at,suly_test_status,suly_evidence_url,
       suly_tested_at,notes,updated_by,updated_at)
    values(v_model.provider_id,v_model.service_type,v_model.model_identifier,p_capability_key,
       p_vendor_claim_status,nullif(p_vendor_evidence_url,''),p_provider_test_status,nullif(p_provider_evidence_url,''),
       case when p_provider_test_status='passed' then now() else null end,p_suly_test_status,nullif(p_suly_evidence_url,''),
       case when p_suly_test_status='passed' then now() else null end,nullif(p_notes,''),v_actor,now())
    on conflict(provider_id,service_type,model_identifier,capability_key) do update set
      vendor_claim_status=excluded.vendor_claim_status,vendor_evidence_url=excluded.vendor_evidence_url,
      provider_test_status=excluded.provider_test_status,provider_evidence_url=excluded.provider_evidence_url,
      provider_tested_at=excluded.provider_tested_at,suly_test_status=excluded.suly_test_status,
      suly_evidence_url=excluded.suly_evidence_url,suly_tested_at=excluded.suly_tested_at,
      notes=excluded.notes,updated_by=v_actor,updated_at=now();
  end if;
  return jsonb_build_object('success',true,'model_id',p_model_id,'capability_key',p_capability_key);
end;
$$;

revoke all on public.suly_model_registry, public.suly_model_capabilities, public.suly_model_registry_audit from anon, authenticated;
grant select,insert,update,delete on public.suly_model_registry, public.suly_model_capabilities to authenticated;
grant select on public.suly_model_registry_audit to authenticated;
revoke all on function public.suly_admin_list_unified_model_capabilities() from public,anon;
revoke all on function public.suly_admin_save_unified_model_capability(uuid,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.suly_admin_list_unified_model_capabilities() to authenticated;
grant execute on function public.suly_admin_save_unified_model_capability(uuid,text,text,text,text,text,text,text,text,text) to authenticated;

-- Keep the canonical projection synchronized with legacy runtime writes while
-- existing routing/media services are migrated in later steps.
alter table public.suly_model_capabilities
  add constraint suly_model_capabilities_key_check check (capability_key in
  ('chat','text','vision','pdf','pdf_input','word','file_input','video','video_input',
   'audio_input','audio_output','image_generation','video_generation','transcription',
   'function_calling','structured_output','streaming','web_search','file_search',
   'computer_use','code_interpreter','mcp_tools','gmail','google_drive','github'));

create or replace function public.suly_sync_chat_model_to_registry()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_registry_id uuid;
begin
  if tg_op='UPDATE' then
    if old.provider_id<>new.provider_id or old.model_identifier<>new.model_identifier then
      update public.suly_model_registry set lifecycle_state='archived',legacy_chat_model_id=null,updated_at=now()
      where legacy_chat_model_id=old.id and provider_id=old.provider_id and service_type='chat' and model_identifier=old.model_identifier;
    end if;
  end if;
  insert into public.suly_model_registry
    (provider_id,service_type,model_identifier,display_name,lifecycle_state,legacy_chat_model_id,source_metadata)
  values (new.provider_id,'chat',new.model_identifier,new.name,
    case when new.enabled then 'active' else 'candidate' end,new.id,
    jsonb_build_object('source_table','ai_models','legacy_model_id',new.id))
  on conflict(provider_id,service_type,model_identifier) do update set
    display_name=excluded.display_name,legacy_chat_model_id=excluded.legacy_chat_model_id,
    lifecycle_state=excluded.lifecycle_state,
    source_metadata=suly_model_registry.source_metadata || excluded.source_metadata,
    updated_at=now()
  returning id into v_registry_id;
  -- Model-list discovery is only a suggestion, never proof or automatic approval.
  insert into public.suly_model_capabilities(model_id,capability_key,review_status,provenance)
  values
    (v_registry_id,'chat','suggested',jsonb_build_object('source','provider_model_discovery')),
    (v_registry_id,'text','suggested',jsonb_build_object('source','provider_model_discovery'))
  on conflict(model_id,capability_key) do nothing;
  return new;
end; $$;

create or replace function public.suly_sync_media_model_to_registry()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_registry_id uuid; v_capability text;
begin
  if tg_op='UPDATE' then
    if old.provider_id<>new.provider_id or old.service_type<>new.service_type or old.model_identifier<>new.model_identifier then
      update public.suly_model_registry set lifecycle_state='archived',legacy_media_model_id=null,updated_at=now()
      where legacy_media_model_id=old.id and provider_id=old.provider_id and service_type=old.service_type and model_identifier=old.model_identifier;
    end if;
  end if;
  insert into public.suly_model_registry
    (provider_id,service_type,model_identifier,display_name,lifecycle_state,legacy_media_model_id,source_metadata)
  values (new.provider_id,new.service_type,new.model_identifier,new.display_name,
    case when new.is_active then 'active' else 'candidate' end,new.id,
    jsonb_build_object('source_table','suly_media_generation_models','legacy_model_id',new.id,'protocol',new.protocol))
  on conflict(provider_id,service_type,model_identifier) do update set
    display_name=excluded.display_name,legacy_media_model_id=excluded.legacy_media_model_id,
    lifecycle_state=excluded.lifecycle_state,
    source_metadata=suly_model_registry.source_metadata || excluded.source_metadata,
    updated_at=now()
  returning id into v_registry_id;
  v_capability := case when new.service_type='image' then 'image_generation' else 'video_generation' end;
  -- A configured media service suggests its matching capability for review only.
  insert into public.suly_model_capabilities(model_id,capability_key,review_status,provenance)
  values(v_registry_id,v_capability,'suggested',jsonb_build_object('source','media_service_catalog'))
  on conflict(model_id,capability_key) do nothing;
  return new;
end; $$;

create or replace function public.suly_sync_legacy_capability_to_registry()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_provider_id integer;
  v_service_type text;
  v_identifier text;
  v_chat_id integer;
  v_model_id uuid;
begin
  if tg_table_name='ai_model_capability_evidence' then
    select provider_id,model_identifier into v_provider_id,v_identifier
      from public.ai_models where id=new.model_id;
    v_service_type := 'chat';
    v_chat_id := new.model_id;
  else
    v_provider_id := new.provider_id;
    v_service_type := new.service_type;
    v_identifier := new.model_identifier;
  end if;
  if v_provider_id is null or v_identifier is null then return new; end if;
  insert into public.suly_model_registry
    (provider_id,service_type,model_identifier,display_name,lifecycle_state,legacy_chat_model_id,source_metadata)
  values(v_provider_id,v_service_type,v_identifier,v_identifier,'candidate',v_chat_id,
    jsonb_build_object('source_table',tg_table_name,'legacy_model_id',case when v_chat_id is not null then v_chat_id::text else null end))
  on conflict(provider_id,service_type,model_identifier) do update set
    legacy_chat_model_id=coalesce(excluded.legacy_chat_model_id,public.suly_model_registry.legacy_chat_model_id),
    updated_at=now()
  returning id into v_model_id;
  insert into public.suly_model_capabilities
    (model_id,capability_key,review_status,vendor_claim_status,vendor_evidence_url,provider_test_status,
     provider_evidence_url,provider_tested_at,suly_test_status,suly_evidence_url,suly_tested_at,
     notes,updated_by,updated_at,provenance)
  values(v_model_id,new.capability_key,'legacy_unreviewed',new.vendor_claim_status,new.vendor_evidence_url,
     new.provider_test_status,new.provider_evidence_url,new.provider_tested_at,
     new.suly_test_status,new.suly_evidence_url,new.suly_tested_at,
     new.notes,new.updated_by,new.updated_at,jsonb_build_object('source_table',tg_table_name))
  on conflict(model_id,capability_key) do update set
     vendor_claim_status=excluded.vendor_claim_status,vendor_evidence_url=excluded.vendor_evidence_url,
     provider_test_status=excluded.provider_test_status,provider_evidence_url=excluded.provider_evidence_url,
     provider_tested_at=excluded.provider_tested_at,suly_test_status=excluded.suly_test_status,
     suly_evidence_url=excluded.suly_evidence_url,suly_tested_at=excluded.suly_tested_at,
     notes=excluded.notes,updated_by=excluded.updated_by,updated_at=excluded.updated_at,
     provenance=excluded.provenance;
  return new;
end; $$;

drop trigger if exists suly_sync_chat_model_registry on public.ai_models;
create trigger suly_sync_chat_model_registry after insert or update of provider_id,model_identifier,name,enabled
  on public.ai_models for each row execute function public.suly_sync_chat_model_to_registry();
drop trigger if exists suly_sync_media_model_registry on public.suly_media_generation_models;
create trigger suly_sync_media_model_registry after insert or update of provider_id,service_type,model_identifier,display_name,is_active,protocol
  on public.suly_media_generation_models for each row execute function public.suly_sync_media_model_to_registry();
-- Seed conservative review suggestions for existing catalog entries as well.
insert into public.suly_model_capabilities(model_id,capability_key,review_status,provenance)
select id,capability_key,'suggested',jsonb_build_object('source','existing_model_catalog')
from public.suly_model_registry
cross join lateral (values ('chat'),('text')) as suggested(capability_key)
where service_type='chat'
on conflict(model_id,capability_key) do nothing;

insert into public.suly_model_capabilities(model_id,capability_key,review_status,provenance)
select id,case when service_type='image' then 'image_generation' else 'video_generation' end,
       'suggested',jsonb_build_object('source','existing_media_catalog')
from public.suly_model_registry
where service_type in ('image','video') and legacy_media_model_id is not null
on conflict(model_id,capability_key) do nothing;

drop trigger if exists suly_sync_chat_capability_registry on public.ai_model_capability_evidence;
create trigger suly_sync_chat_capability_registry after insert or update
  on public.ai_model_capability_evidence for each row execute function public.suly_sync_legacy_capability_to_registry();
drop trigger if exists suly_sync_media_capability_registry on public.suly_media_model_capability_evidence;
create trigger suly_sync_media_capability_registry after insert or update
  on public.suly_media_model_capability_evidence for each row execute function public.suly_sync_legacy_capability_to_registry();

revoke all on function public.suly_sync_chat_model_to_registry() from public,anon,authenticated;
revoke all on function public.suly_sync_media_model_to_registry() from public,anon,authenticated;
revoke all on function public.suly_sync_legacy_capability_to_registry() from public,anon,authenticated;
