-- Versioned EGP price catalog for image, video, and transcription models.
-- Provider testing is recorded separately from SULY integration verification.
begin;
create table if not exists public.suly_media_model_price_versions (
  id uuid primary key default gen_random_uuid(),
  provider_id integer not null references public.ai_providers(id) on delete restrict,
  service_type text not null check (service_type in ('image','video','audio')),
  model_identifier text not null check (length(model_identifier) between 1 and 180),
  display_name text not null check (length(display_name) between 1 and 180),
  unit_type text not null check (unit_type in ('image','video_second','audio_minute')),
  provider_cost_egp_per_unit numeric(20,8) not null check (provider_cost_egp_per_unit >= 0),
  markup_rate numeric(6,5) not null default 0.40000 check (markup_rate = 0.40000),
  selling_price_egp_per_unit numeric(20,8) generated always as (round(provider_cost_egp_per_unit * (1 + markup_rate), 8)) stored,
  currency text not null default 'EGP' check (currency = 'EGP'),
  provider_tested boolean not null default false,
  suly_integration_verified boolean not null default false,
  source_reference text not null default 'provider_catalog',
  price_version integer not null check (price_version > 0),
  is_current boolean not null default true,
  effective_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(provider_id, service_type, model_identifier, price_version)
);
create unique index if not exists suly_media_model_price_one_current_idx
  on public.suly_media_model_price_versions(provider_id,service_type,model_identifier) where is_current;
create index if not exists suly_media_model_price_history_idx
  on public.suly_media_model_price_versions(provider_id,service_type,model_identifier,price_version desc);
alter table public.suly_media_model_price_versions enable row level security;
drop policy if exists suly_media_model_price_admin_read on public.suly_media_model_price_versions;
create policy suly_media_model_price_admin_read on public.suly_media_model_price_versions
  for select to authenticated using ((select public.suly_is_admin()));
revoke all on public.suly_media_model_price_versions from anon, authenticated;
grant select on public.suly_media_model_price_versions to authenticated;
grant all on public.suly_media_model_price_versions to service_role;

create or replace function public.suly_admin_set_media_model_price(
  p_provider_id integer,p_service_type text,p_model_identifier text,p_display_name text,
  p_unit_type text,p_provider_cost_egp_per_unit numeric,p_expected_version integer default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_admin uuid := auth.uid();
  v_current_version integer;
  v_new_version integer;
  v_row public.suly_media_model_price_versions%rowtype;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if p_provider_id is null or p_service_type not in ('image','video','audio')
     or p_unit_type not in ('image','video_second','audio_minute')
     or (p_service_type='image' and p_unit_type<>'image')
     or (p_service_type='video' and p_unit_type<>'video_second')
     or (p_service_type='audio' and p_unit_type<>'audio_minute')
     or p_model_identifier is null or length(p_model_identifier) not between 1 and 180
     or p_display_name is null or length(p_display_name) not between 1 and 180
     or p_provider_cost_egp_per_unit is null or p_provider_cost_egp_per_unit < 0 then
    raise exception 'invalid media model price values' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ai_providers where id=p_provider_id) then
    raise exception 'unknown provider' using errcode = '22023';
  end if;
  select max(price_version) into v_current_version from public.suly_media_model_price_versions
    where provider_id=p_provider_id and service_type=p_service_type and model_identifier=p_model_identifier;
  if p_expected_version is not null and coalesce(v_current_version,0) <> p_expected_version then
    raise exception 'price version conflict' using errcode = '40001';
  end if;
  v_new_version := coalesce(v_current_version,0)+1;
  update public.suly_media_model_price_versions set is_current=false
    where provider_id=p_provider_id and service_type=p_service_type and model_identifier=p_model_identifier and is_current;
  insert into public.suly_media_model_price_versions(
    provider_id,service_type,model_identifier,display_name,unit_type,provider_cost_egp_per_unit,
    markup_rate,currency,provider_tested,suly_integration_verified,source_reference,price_version,
    is_current,effective_at,created_by
  ) values (
    p_provider_id,p_service_type,p_model_identifier,p_display_name,p_unit_type,p_provider_cost_egp_per_unit,
    0.40000,'EGP',true,false,'admin_price_update',v_new_version,true,now(),v_admin
  ) returning * into v_row;
  insert into public.admin_audit_logs(admin_id,action,target_table,target_id,new_value,created_at)
  values (v_admin,'media_model_price_version_created','suly_media_model_price_versions',v_row.id::text,
    jsonb_build_object('provider_id',p_provider_id,'service_type',p_service_type,'model_identifier',p_model_identifier,
      'display_name',p_display_name,'unit_type',p_unit_type,'provider_cost_egp_per_unit',v_row.provider_cost_egp_per_unit,
      'selling_price_egp_per_unit',v_row.selling_price_egp_per_unit,'markup_rate',0.40000,
      'price_version',v_new_version,'currency','EGP'),now());
  return jsonb_build_object('success',true,'provider_id',p_provider_id,'service_type',p_service_type,
    'model_identifier',p_model_identifier,'price_version',v_new_version,
    'provider_cost_egp_per_unit',v_row.provider_cost_egp_per_unit,
    'selling_price_egp_per_unit',v_row.selling_price_egp_per_unit,
    'markup_rate',0.40000,'unit_type',p_unit_type,'currency','EGP');
end;
$$;
revoke all on function public.suly_admin_set_media_model_price(integer,text,text,text,text,numeric,integer) from public,anon;
grant execute on function public.suly_admin_set_media_model_price(integer,text,text,text,text,numeric,integer) to authenticated;

create temporary table suly_media_price_seed on commit drop as
select * from (values
  ('video','kling-4','Kling 4.0','video_second',9.11),
  ('video','seedance-2.5','Seedance 2.5','video_second',27.43),
  ('video','gemini-omni-flash','Gemini Omni Flash','video_second',4.75),
  ('video','kling-4-flash','Kling 4.0 Flash','video_second',5.45),
  ('video','wan-3','Wan 3.0','video_second',5.80),
  ('video','seedance-2-fast','Seedance 2.0 Fast','video_second',14.03),
  ('video','minimax-h3','MiniMax H3 (Hailuo)','video_second',3.48),
  ('image','nano-banana-2.1','Nano Banana 2.1','image',3.48),
  ('image','gemini-3.1-flash-image-preview','Nano Banana','image',3.89),
  ('image','gemini-3-pro-image-preview','Nano Banana Pro','image',7.77),
  ('image','gpt-image-2','GPT Image 2','image',3.07),
  ('image','gpt-image-1.5','GPT Image 1.5','image',1.97),
  ('image','gpt-image-1','GPT Image 1','image',2.44),
  ('image','gemini-2.5-flash-image','Nano Banana Flash','image',2.26),
  ('image','flux-3','FLUX 3','image',2.78),
  ('image','flux-2-pro','FLUX.2 Pro','image',1.74),
  ('image','seedream-5.5','Seedream 5.5','image',1.74),
  ('image','seedream-5-flash','Seedream 5 Flash','image',1.57),
  ('image','ideogram-4.5','Ideogram 4.5','image',3.48),
  ('audio','whisper-1','Whisper','audio_minute',0.348),
  ('audio','gpt-4o-transcribe','GPT-4o Transcribe','audio_minute',0.348),
  ('audio','gpt-4o-mini-transcribe','GPT-4o Mini Transcribe','audio_minute',0.174)
) as seed(service_type,model_identifier,display_name,unit_type,provider_cost);
do $$
declare v_seeded integer;
begin
  select count(*) into v_seeded from suly_media_price_seed;
  if v_seeded <> 22 then raise exception 'expected 22 media models, found %',v_seeded; end if;
  insert into public.suly_media_model_price_versions(
    provider_id,service_type,model_identifier,display_name,unit_type,provider_cost_egp_per_unit,
    markup_rate,currency,provider_tested,suly_integration_verified,source_reference,
    price_version,is_current,effective_at
  )
  select 22,s.service_type,s.model_identifier,s.display_name,s.unit_type,s.provider_cost,
    0.40000,'EGP',true,false,'provider_catalog_2026-11-16',1,true,now()
  from suly_media_price_seed s
  on conflict(provider_id,service_type,model_identifier,price_version) do nothing;
end;
$$;
comment on table public.suly_media_model_price_versions is
  'Versioned EGP unit prices for image, video and audio models. Provider testing is user-confirmed; SULY integration remains unverified until endpoint, workflow and billing tests pass.';
commit;
