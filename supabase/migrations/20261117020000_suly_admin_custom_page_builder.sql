begin;

create table if not exists public.suly_admin_custom_pages (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique,
  title text not null,
  config jsonb not null default '{"components":[]}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suly_admin_custom_pages_key_format check (page_key ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  constraint suly_admin_custom_pages_title_length check (char_length(title) between 2 and 100),
  constraint suly_admin_custom_pages_config_object check (jsonb_typeof(config) = 'object')
);

create table if not exists public.suly_admin_custom_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.suly_admin_custom_pages(id) on delete restrict,
  version integer not null check (version > 0),
  title text not null,
  config jsonb not null,
  status text not null check (status in ('draft','published','hidden')),
  changed_by uuid not null references auth.users(id) on delete restrict,
  change_note text,
  created_at timestamptz not null default now(),
  unique(page_id, version)
);

alter table public.suly_admin_custom_pages enable row level security;
alter table public.suly_admin_custom_page_versions enable row level security;
revoke all on public.suly_admin_custom_pages from anon, authenticated;
revoke all on public.suly_admin_custom_page_versions from anon, authenticated;

create or replace function public.suly_admin_validate_custom_page_config(p_config jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_component jsonb;
  v_type text;
  v_source text;
  v_count integer;
begin
  if jsonb_typeof(p_config) is distinct from 'object'
     or jsonb_typeof(p_config->'components') is distinct from 'array' then
    return false;
  end if;
  v_count := jsonb_array_length(p_config->'components');
  if v_count > 20 then return false; end if;

  for v_component in select value from jsonb_array_elements(p_config->'components')
  loop
    if jsonb_typeof(v_component) <> 'object' then return false; end if;
    v_type := v_component->>'type';
    if coalesce(v_type,'') not in ('text','notice','metric','status','list','table') then return false; end if;
    if length(coalesce(v_component->>'title','')) > 100
       or length(coalesce(v_component->>'content','')) > 600
       or length(coalesce(v_component->>'label','')) > 100 then
      return false;
    end if;
    v_source := coalesce(v_component->>'source','none');
    if v_source not in ('none','system_health_summary','model_catalog_summary','admin_activity_summary') then
      return false;
    end if;
    if v_component ? 'sql' or v_component ? 'query' or v_component ? 'rpc'
       or v_component ? 'secret' or v_component ? 'service_role_key' then
      return false;
    end if;
    if v_type = 'table' then
      if jsonb_typeof(v_component->'columns') is distinct from 'array'
         or jsonb_typeof(v_component->'rows') is distinct from 'array' then return false; end if;
      if jsonb_array_length(v_component->'columns') > 8
         or jsonb_array_length(v_component->'rows') > 20 then return false; end if;
    end if;
    if v_type = 'list' then
      if jsonb_typeof(v_component->'items') is distinct from 'array'
         or jsonb_array_length(v_component->'items') > 20 then return false; end if;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.suly_admin_list_custom_pages()
returns table (
  id uuid, page_key text, title text, config jsonb, status text,
  version integer, updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query
  select p.id,p.page_key,p.title,p.config,p.status,p.version,p.updated_at
  from public.suly_admin_custom_pages p
  order by p.updated_at desc
  limit 100;
end;
$$;

create or replace function public.suly_admin_save_custom_page(
  p_page_key text,
  p_title text,
  p_config jsonb,
  p_status text default 'draft',
  p_change_note text default null,
  p_page_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_page public.suly_admin_custom_pages%rowtype;
  v_key text := lower(trim(coalesce(p_page_key,'')));
  v_title text := trim(coalesce(p_title,''));
  v_status text := coalesce(p_status,'draft');
begin
  if not public.suly_is_admin() or v_user is null then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if v_key !~ '^[a-z0-9][a-z0-9-]{1,47}$'
     or v_key in ('overview','users','models','pricing','finance','hims','audit','support','page-builder')
     or char_length(v_title) < 2 or char_length(v_title) > 100
     or v_status not in ('draft','published','hidden')
     or not public.suly_admin_validate_custom_page_config(p_config) then
    raise exception 'invalid custom page definition' using errcode = '22023';
  end if;

  if p_page_id is not null then
    select * into v_page from public.suly_admin_custom_pages
      where id=p_page_id for update;
    if not found then raise exception 'page not found' using errcode = 'P0002'; end if;
    if exists(select 1 from public.suly_admin_custom_pages p where p.page_key=v_key and p.id<>p_page_id) then
      raise exception 'page key already exists' using errcode = '23505';
    end if;
  else
    select * into v_page from public.suly_admin_custom_pages
      where page_key = v_key for update;
  end if;

  if found then
    update public.suly_admin_custom_pages
      set page_key=v_key,title=v_title,config=p_config,status=v_status,version=version+1,
          updated_by=v_user,updated_at=now()
      where id=v_page.id
      returning * into v_page;
  else
    insert into public.suly_admin_custom_pages(page_key,title,config,status,created_by,updated_by)
      values(v_key,v_title,p_config,v_status,v_user,v_user)
      returning * into v_page;
  end if;

  insert into public.suly_admin_custom_page_versions(page_id,version,title,config,status,changed_by,change_note)
  values(v_page.id,v_page.version,v_page.title,v_page.config,v_page.status,v_user,left(p_change_note,300));

  return jsonb_build_object('success',true,'id',v_page.id,'page_key',v_page.page_key,'version',v_page.version,'status',v_page.status);
end;
$$;

create or replace function public.suly_admin_list_custom_page_versions(p_page_id uuid)
returns table (id uuid, version integer, title text, status text, change_note text, created_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query
  select v.id,v.version,v.title,v.status,v.change_note,v.created_at
  from public.suly_admin_custom_page_versions v
  where v.page_id=p_page_id
  order by v.version desc
  limit 50;
end;
$$;

create or replace function public.suly_admin_restore_custom_page_version(p_page_id uuid,p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_version public.suly_admin_custom_page_versions%rowtype;
  v_page public.suly_admin_custom_pages%rowtype;
begin
  if not public.suly_is_admin() or v_user is null then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  select * into v_page from public.suly_admin_custom_pages where id=p_page_id for update;
  if not found then raise exception 'page not found' using errcode = 'P0002'; end if;
  select * into v_version from public.suly_admin_custom_page_versions
    where page_id=p_page_id and version=p_version;
  if not found then raise exception 'version not found' using errcode = 'P0002'; end if;

  update public.suly_admin_custom_pages
    set title=v_version.title,config=v_version.config,status='draft',
        version=version+1,updated_by=v_user,updated_at=now()
    where id=p_page_id returning * into v_page;

  insert into public.suly_admin_custom_page_versions(page_id,version,title,config,status,changed_by,change_note)
    values(v_page.id,v_page.version,v_page.title,v_page.config,'draft',v_user,'Restored from version '||p_version);

  return jsonb_build_object('success',true,'version',v_page.version,'restored_from',p_version,'status','draft');
end;
$$;


create or replace function public.suly_admin_custom_page_source(p_source text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $
declare
  v_result jsonb;
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  case p_source
    when 'system_health_summary' then
      select jsonb_build_object(
        'source', p_source,
        'enabled_models', count(*) filter (where m.enabled),
        'healthy_enabled_models', count(*) filter (where m.enabled and h.model_id is not null and h.last_status = 'success' and coalesce(h.auto_restricted,false)=false),
        'restricted_models', count(*) filter (where coalesce(h.auto_restricted,false)),
        'generated_at', now()
      ) into v_result
      from public.ai_models m
      left join public.ai_model_health h on h.model_id=m.id;

    when 'model_catalog_summary' then
      select jsonb_build_object(
        'source', p_source,
        'enabled_providers', (select count(*) from public.ai_providers where enabled),
        'enabled_models', (select count(*) from public.ai_models where enabled),
        'disabled_models', (select count(*) from public.ai_models where not enabled),
        'generated_at', now()
      ) into v_result;

    when 'admin_activity_summary' then
      select jsonb_build_object(
        'source', p_source,
        'events_last_24h', (select count(*) from public.admin_audit_logs where created_at >= now() - interval '24 hours'),
        'latest_actions', coalesce((
          select jsonb_agg(jsonb_build_object('action', recent.action, 'created_at', recent.created_at) order by recent.created_at desc)
          from (
            select action, created_at from public.admin_audit_logs
            order by created_at desc limit 5
          ) recent
        ), '[]'::jsonb),
        'generated_at', now()
      ) into v_result;

    else
      raise exception 'unsupported custom page data source' using errcode = '22023';
  end case;

  return coalesce(v_result, '{}'::jsonb);
end;
$;

revoke all on function public.suly_admin_validate_custom_page_config(jsonb) from public, anon, authenticated;
revoke all on function public.suly_admin_list_custom_pages() from public, anon, authenticated;
revoke all on function public.suly_admin_custom_page_source(text) from public, anon, authenticated;
revoke all on function public.suly_admin_save_custom_page(text,text,jsonb,text,text,uuid) from public, anon, authenticated;
revoke all on function public.suly_admin_list_custom_page_versions(uuid) from public, anon, authenticated;
revoke all on function public.suly_admin_restore_custom_page_version(uuid,integer) from public, anon, authenticated;
grant execute on function public.suly_admin_list_custom_pages() to authenticated;
grant execute on function public.suly_admin_custom_page_source(text) to authenticated;
grant execute on function public.suly_admin_save_custom_page(text,text,jsonb,text,text,uuid) to authenticated;
grant execute on function public.suly_admin_list_custom_page_versions(uuid) to authenticated;
grant execute on function public.suly_admin_restore_custom_page_version(uuid,integer) to authenticated;

comment on table public.suly_admin_custom_pages is 'Admin-defined pages using a strict component and data-source allowlist. No arbitrary SQL/RPC execution.';
comment on table public.suly_admin_custom_page_versions is 'Immutable version snapshots for custom admin pages.';

commit;
