-- Per-model timeouts, circuit breakers, audit history and admin-controlled recovery.
begin;

alter table public.ai_models
  add column if not exists response_timeout_ms integer not null default 15000
    check (response_timeout_ms between 1000 and 120000),
  add column if not exists restriction_failure_threshold integer not null default 3
    check (restriction_failure_threshold between 1 and 20),
  add column if not exists restriction_window_minutes integer not null default 15
    check (restriction_window_minutes between 1 and 1440);

alter table public.ai_router_settings
  add column if not exists health_auto_restrict_enabled boolean not null default true;

create table if not exists public.ai_model_health (
  model_id integer primary key references public.ai_models(id) on delete cascade,
  total_attempts integer not null default 0 check (total_attempts >= 0),
  successful_attempts integer not null default 0 check (successful_attempts >= 0),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  failure_window_started_at timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_status text not null default 'unknown'
    check (last_status in ('unknown', 'success', 'error', 'timeout', 'empty', 'cancelled')),
  last_error_code text,
  last_error_reason text,
  average_latency_ms numeric not null default 0 check (average_latency_ms >= 0),
  auto_restricted boolean not null default false,
  restriction_reason text,
  restricted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_model_attempt_logs (
  id uuid primary key default gen_random_uuid(),
  model_id integer references public.ai_models(id) on delete set null,
  model_name text not null,
  provider_id integer references public.ai_providers(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  attempt_status text not null check (attempt_status in ('success', 'error', 'timeout', 'empty', 'cancelled')),
  duration_ms integer not null check (duration_ms >= 0),
  error_code text,
  error_reason text,
  created_at timestamptz not null default now()
);

create index if not exists ai_model_attempt_logs_model_created_idx
  on public.ai_model_attempt_logs (model_id, created_at desc);
create index if not exists ai_model_attempt_logs_status_created_idx
  on public.ai_model_attempt_logs (attempt_status, created_at desc);

alter table public.ai_model_health enable row level security;
alter table public.ai_model_attempt_logs enable row level security;

drop policy if exists "Admins read model health" on public.ai_model_health;
create policy "Admins read model health"
  on public.ai_model_health for select to authenticated
  using (public.suly_is_admin());

drop policy if exists "Admins read model attempt logs" on public.ai_model_attempt_logs;
create policy "Admins read model attempt logs"
  on public.ai_model_attempt_logs for select to authenticated
  using (public.suly_is_admin());

revoke all on table public.ai_model_health, public.ai_model_attempt_logs from public, anon, authenticated;
grant select on table public.ai_model_health, public.ai_model_attempt_logs to authenticated;
grant all on table public.ai_model_health, public.ai_model_attempt_logs to service_role;

create or replace function public.record_ai_model_attempt(
  p_model_id integer,
  p_provider_id integer,
  p_model_name text,
  p_user_id uuid,
  p_status text,
  p_duration_ms integer,
  p_error_code text default null,
  p_error_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_threshold integer;
  v_window_minutes integer;
  v_auto_restrict_enabled boolean;
  v_model_name text;
  v_health public.ai_model_health%rowtype;
  v_is_failure boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_status not in ('success', 'error', 'timeout', 'empty', 'cancelled') then
    raise exception 'Invalid attempt status' using errcode = '22023';
  end if;
  if p_duration_ms is null or p_duration_ms < 0 then
    raise exception 'duration_ms must be non-negative' using errcode = '22023';
  end if;

  select m.name, m.restriction_failure_threshold, m.restriction_window_minutes
    into v_model_name, v_threshold, v_window_minutes
  from public.ai_models m
  where m.id = p_model_id;
  if not found then
    raise exception 'Model not found' using errcode = 'P0002';
  end if;
  select s.health_auto_restrict_enabled into v_auto_restrict_enabled
  from public.ai_router_settings s where s.id = 1;
  v_auto_restrict_enabled := coalesce(v_auto_restrict_enabled, true);
  v_is_failure := p_status in ('error', 'timeout', 'empty');

  insert into public.ai_model_attempt_logs
    (model_id, model_name, provider_id, user_id, attempt_status, duration_ms, error_code, error_reason)
  values
    (p_model_id, coalesce(nullif(left(btrim(p_model_name), 200), ''), v_model_name), p_provider_id,
     p_user_id, p_status, p_duration_ms, left(nullif(btrim(p_error_code), ''), 100),
     left(nullif(btrim(p_error_reason), ''), 1000));

  insert into public.ai_model_health as h
    (model_id, total_attempts, successful_attempts, failed_attempts, consecutive_failures,
     failure_window_started_at, last_attempt_at, last_success_at, last_failure_at,
     last_status, last_error_code, last_error_reason, average_latency_ms, updated_at)
  values
    (p_model_id, 1, case when p_status = 'success' then 1 else 0 end,
     case when v_is_failure then 1 else 0 end,
     case when v_is_failure then 1 else 0 end,
     case when v_is_failure then now() else null end,
     now(), case when p_status = 'success' then now() else null end,
     case when v_is_failure then now() else null end,
     p_status, left(nullif(btrim(p_error_code), ''), 100),
     left(nullif(btrim(p_error_reason), ''), 1000),
     case when p_status = 'success' then p_duration_ms else 0 end, now())
  on conflict (model_id) do update set
    total_attempts = h.total_attempts + 1,
    successful_attempts = h.successful_attempts + case when p_status = 'success' then 1 else 0 end,
    failed_attempts = h.failed_attempts + case when v_is_failure then 1 else 0 end,
    consecutive_failures = case
      when p_status = 'success' then 0
      when v_is_failure and (h.last_failure_at is null or h.last_failure_at < now() - make_interval(mins => v_window_minutes)) then 1
      when v_is_failure then h.consecutive_failures + 1
      else h.consecutive_failures
    end,
    failure_window_started_at = case
      when p_status = 'success' then null
      when v_is_failure and (h.last_failure_at is null or h.last_failure_at < now() - make_interval(mins => v_window_minutes)) then now()
      when v_is_failure then h.failure_window_started_at
      else h.failure_window_started_at
    end,
    last_attempt_at = now(),
    last_success_at = case when p_status = 'success' then now() else h.last_success_at end,
    last_failure_at = case when v_is_failure then now() else h.last_failure_at end,
    last_status = p_status,
    last_error_code = case when v_is_failure then left(nullif(btrim(p_error_code), ''), 100) else h.last_error_code end,
    last_error_reason = case when v_is_failure then left(nullif(btrim(p_error_reason), ''), 1000) else h.last_error_reason end,
    average_latency_ms = case when p_status = 'success'
      then ((h.average_latency_ms * h.successful_attempts + p_duration_ms)::numeric / (h.successful_attempts + 1))
      else h.average_latency_ms end,
    updated_at = now();

  select * into v_health from public.ai_model_health where model_id = p_model_id;
  if v_auto_restrict_enabled and v_is_failure and not v_health.auto_restricted
     and v_health.consecutive_failures >= v_threshold then
    update public.ai_model_health
    set auto_restricted = true,
        restricted_at = now(),
        restriction_reason = format(
          'Automatically restricted after %s consecutive failures within %s minutes. Latest failure [%s]: %s',
          v_health.consecutive_failures,
          v_window_minutes,
          coalesce(nullif(p_error_code, ''), p_status),
          coalesce(nullif(left(btrim(p_error_reason), 1000), ''), 'No provider error description was returned.')
        ),
        updated_at = now()
    where model_id = p_model_id
    returning * into v_health;
  end if;

  return jsonb_build_object(
    'model_id', p_model_id,
    'status', p_status,
    'consecutive_failures', v_health.consecutive_failures,
    'auto_restricted', v_health.auto_restricted,
    'restriction_reason', v_health.restriction_reason
  );
end;
$$;

revoke all on function public.record_ai_model_attempt(integer, integer, text, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_ai_model_attempt(integer, integer, text, uuid, text, integer, text, text) to service_role;

create or replace function public.suly_admin_reset_model_health(p_model_id integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ai_models where id = p_model_id) then
    raise exception 'Model not found' using errcode = 'P0002';
  end if;
  insert into public.ai_model_health (model_id)
  values (p_model_id)
  on conflict (model_id) do update set
    consecutive_failures = 0,
    failure_window_started_at = null,
    auto_restricted = false,
    restriction_reason = null,
    restricted_at = null,
    last_status = 'unknown',
    updated_at = now();
  update public.ai_models set enabled = true, updated_at = now() where id = p_model_id;
  return jsonb_build_object('success', true, 'model_id', p_model_id, 'enabled', true);
end;
$$;

revoke all on function public.suly_admin_reset_model_health(integer) from public, anon;
grant execute on function public.suly_admin_reset_model_health(integer) to authenticated;

commit;
