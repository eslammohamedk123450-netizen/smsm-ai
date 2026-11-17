begin;

-- Reversible provider freeze. This is operational metadata only; financial,
-- usage, wallet, and billing ledgers are intentionally never modified.
create table if not exists public.ai_provider_lifecycle_snapshots (
  provider_id integer primary key,
  snapshot_version integer not null default 1,
  snapshot jsonb not null,
  archived_at timestamptz not null default now(),
  archived_by uuid,
  restored_at timestamptz
);

alter table public.ai_provider_lifecycle_snapshots enable row level security;
revoke all on table public.ai_provider_lifecycle_snapshots from public, anon, authenticated;

create or replace function public.suly_admin_set_provider_lifecycle_v2(
  p_provider_id integer,
  p_enabled boolean,
  p_hide_models boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_enabled boolean;
  v_snapshot jsonb;
  v_restored_routes integer := 0;
  v_restored_profiles integer := 0;
  v_restored_media integer := 0;
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  select p.enabled into v_enabled
  from public.ai_providers p
  where p.id = p_provider_id
  for update;

  if not found then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;

  if coalesce(p_enabled, false) = false then
    if v_enabled is true then
      select jsonb_build_object(
        'route_assignments', coalesce((
          select jsonb_agg(jsonb_build_object('id', a.id, 'enabled', a.enabled))
          from public.ai_route_model_assignments a
          join public.ai_models m on m.id = a.model_id
          where m.provider_id = p_provider_id
        ), '[]'::jsonb),
        'profile_assignments', coalesce((
          select jsonb_agg(jsonb_build_object('id', a.id, 'enabled', a.enabled))
          from public.suly_model_profile_models a
          join public.ai_models m on m.id = a.model_id
          where m.provider_id = p_provider_id
        ), '[]'::jsonb),
        'media_models', coalesce((
          select jsonb_agg(jsonb_build_object('id', m.id, 'is_active', m.is_active, 'is_default', m.is_default))
          from public.suly_media_generation_models m
          where m.provider_id = p_provider_id
        ), '[]'::jsonb),
        'router_settings', (
          select jsonb_build_object(
            'id', s.id,
            'gmail_task_model_id', s.gmail_task_model_id,
            'agent_planner_model_id', s.agent_planner_model_id,
            'agent_summarizer_model_id', s.agent_summarizer_model_id
          )
          from public.ai_router_settings s where s.id = 1
        )
      ) into v_snapshot;

      insert into public.ai_provider_lifecycle_snapshots
        (provider_id, snapshot_version, snapshot, archived_at, archived_by, restored_at)
      values (p_provider_id, 1, v_snapshot, now(), auth.uid(), null)
      on conflict (provider_id) do update set
        snapshot_version = excluded.snapshot_version,
        snapshot = excluded.snapshot,
        archived_at = excluded.archived_at,
        archived_by = excluded.archived_by,
        restored_at = null;
    end if;

    update public.ai_providers
      set enabled = false, updated_at = now()
      where id = p_provider_id;

    if coalesce(p_hide_models, true) then
      update public.ai_route_model_assignments a
        set enabled = false, updated_at = now()
        from public.ai_models m
        where a.model_id = m.id and m.provider_id = p_provider_id;

      update public.suly_model_profile_models a
        set enabled = false, updated_at = now()
        from public.ai_models m
        where a.model_id = m.id and m.provider_id = p_provider_id;

      update public.suly_media_generation_models
        set is_active = false, is_default = false, updated_at = now()
        where provider_id = p_provider_id;
    end if;

    update public.ai_router_settings s
      set gmail_task_model_id = case when gmail_task_model_id in
            (select id from public.ai_models where provider_id = p_provider_id) then null else gmail_task_model_id end,
          agent_planner_model_id = case when agent_planner_model_id in
            (select id from public.ai_models where provider_id = p_provider_id) then null else agent_planner_model_id end,
          agent_summarizer_model_id = case when agent_summarizer_model_id in
            (select id from public.ai_models where provider_id = p_provider_id) then null else agent_summarizer_model_id end,
          updated_at = now()
      where id = 1;

    return jsonb_build_object('success', true, 'provider_id', p_provider_id,
      'enabled', false, 'archived', true, 'financial_history_preserved', true);
  end if;

  update public.ai_providers
    set enabled = true, updated_at = now()
    where id = p_provider_id;

  select s.snapshot into v_snapshot
  from public.ai_provider_lifecycle_snapshots s
  where s.provider_id = p_provider_id and s.restored_at is null
  for update;

  if v_snapshot is not null then
    update public.ai_route_model_assignments a
      set enabled = coalesce(s.enabled, false), updated_at = now()
      from jsonb_to_recordset(coalesce(v_snapshot->'route_assignments', '[]'::jsonb))
        as s(id uuid, enabled boolean)
      where a.id = s.id;
    get diagnostics v_restored_routes = row_count;

    update public.suly_model_profile_models a
      set enabled = coalesce(s.enabled, false), updated_at = now()
      from jsonb_to_recordset(coalesce(v_snapshot->'profile_assignments', '[]'::jsonb))
        as s(id bigint, enabled boolean)
      where a.id = s.id;
    get diagnostics v_restored_profiles = row_count;

    update public.suly_media_generation_models m
      set is_active = coalesce(s.is_active, false),
          is_default = coalesce(s.is_default, false),
          updated_at = now()
      from jsonb_to_recordset(coalesce(v_snapshot->'media_models', '[]'::jsonb))
        as s(id uuid, is_active boolean, is_default boolean)
      where m.id = s.id and m.provider_id = p_provider_id;
    get diagnostics v_restored_media = row_count;

    -- Restore legacy direct model selections only when still empty, so a
    -- deliberate administrator change made during the archive is not overwritten.
    update public.ai_router_settings s
      set gmail_task_model_id = case
            when s.gmail_task_model_id is null and (v_snapshot->'router_settings'->>'gmail_task_model_id') is not null
              and exists (select 1 from public.ai_models m where m.id = (v_snapshot->'router_settings'->>'gmail_task_model_id')::integer and m.provider_id = p_provider_id)
            then (v_snapshot->'router_settings'->>'gmail_task_model_id')::integer else s.gmail_task_model_id end,
          agent_planner_model_id = case
            when s.agent_planner_model_id is null and (v_snapshot->'router_settings'->>'agent_planner_model_id') is not null
              and exists (select 1 from public.ai_models m where m.id = (v_snapshot->'router_settings'->>'agent_planner_model_id')::integer and m.provider_id = p_provider_id)
            then (v_snapshot->'router_settings'->>'agent_planner_model_id')::integer else s.agent_planner_model_id end,
          agent_summarizer_model_id = case
            when s.agent_summarizer_model_id is null and (v_snapshot->'router_settings'->>'agent_summarizer_model_id') is not null
              and exists (select 1 from public.ai_models m where m.id = (v_snapshot->'router_settings'->>'agent_summarizer_model_id')::integer and m.provider_id = p_provider_id)
            then (v_snapshot->'router_settings'->>'agent_summarizer_model_id')::integer else s.agent_summarizer_model_id end,
          updated_at = now()
      where s.id = 1;

    update public.ai_provider_lifecycle_snapshots
      set restored_at = now()
      where provider_id = p_provider_id and restored_at is null;
  end if;

  return jsonb_build_object('success', true, 'provider_id', p_provider_id,
    'enabled', true, 'restored', v_snapshot is not null,
    'restored_route_assignments', v_restored_routes,
    'restored_profile_assignments', v_restored_profiles,
    'restored_media_models', v_restored_media,
    'financial_history_preserved', true);
end;
$$;

-- Preserve the legacy void-returning RPC signature for older clients, but route
-- it through the same reversible implementation.
create or replace function public.suly_admin_set_provider_lifecycle(
  p_provider_id integer,
  p_enabled boolean,
  p_hide_models boolean default true
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  perform public.suly_admin_set_provider_lifecycle_v2(p_provider_id, p_enabled, p_hide_models);
end;
$function$;

-- Active providers are the only providers shown in ordinary admin catalog lists.
create or replace function public.suly_admin_list_providers()
returns table (
  id integer, name varchar, provider_type varchar, base_url varchar,
  enabled boolean, priority integer, last_test_status varchar, last_tested_at timestamptz
)
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query
    select p.id, p.name, p.provider_type, p.base_url, p.enabled, p.priority, p.last_test_status, p.last_tested_at
    from public.ai_providers p
    where p.enabled is true
    order by p.priority asc, p.id asc
    limit 100;
end;
$$;

-- Archived/disabled providers remain recoverable from a separate admin-only view.
create or replace function public.suly_admin_list_archived_providers()
returns table (
  id integer, name varchar, provider_type varchar, base_url varchar,
  enabled boolean, priority integer, last_test_status varchar, last_tested_at timestamptz,
  has_restore_snapshot boolean, archived_at timestamptz
)
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query
    select p.id, p.name, p.provider_type, p.base_url, p.enabled, p.priority,
      p.last_test_status, p.last_tested_at,
      (s.snapshot is not null and s.restored_at is null) as has_restore_snapshot,
      s.archived_at
    from public.ai_providers p
    left join public.ai_provider_lifecycle_snapshots s on s.provider_id = p.id
    where p.enabled is false
    order by coalesce(s.archived_at, p.updated_at) desc, p.id desc
    limit 100;
end;
$$;

-- Capability evidence belongs to the operational catalog too: archived
-- providers disappear from these admin lists without deleting their evidence.
create or replace function public.suly_admin_list_model_capability_evidence(p_model_id integer default null)
returns setof public.ai_model_capability_evidence
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query
    select e.*
    from public.ai_model_capability_evidence e
    join public.ai_models m on m.id = e.model_id
    join public.ai_providers p on p.id = m.provider_id
    where p.enabled is true
      and (p_model_id is null or e.model_id = p_model_id)
    order by e.model_id, e.capability_key;
end;
$function$;

create or replace function public.suly_admin_list_media_model_capability_evidence()
returns setof public.suly_media_model_capability_evidence
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query
    select e.*
    from public.suly_media_model_capability_evidence e
    join public.ai_providers p on p.id = e.provider_id
    where p.enabled is true
    order by e.service_type, e.model_identifier, e.capability_key;
end;
$function$;

revoke all on function public.suly_admin_set_provider_lifecycle(integer, boolean, boolean) from public, anon;
revoke all on function public.suly_admin_set_provider_lifecycle_v2(integer, boolean, boolean) from public, anon;
revoke all on function public.suly_admin_list_providers() from public, anon;
revoke all on function public.suly_admin_list_archived_providers() from public, anon;
grant execute on function public.suly_admin_set_provider_lifecycle(integer, boolean, boolean) to authenticated;
grant execute on function public.suly_admin_set_provider_lifecycle_v2(integer, boolean, boolean) to authenticated;
grant execute on function public.suly_admin_list_providers() to authenticated;
grant execute on function public.suly_admin_list_archived_providers() to authenticated;

commit;
