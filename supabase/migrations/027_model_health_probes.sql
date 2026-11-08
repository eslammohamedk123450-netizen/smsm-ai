-- Daily synthetic health probes for each enabled model/key pair.
-- Probe streaks are deliberately separate from user-request health counters so
-- one request failure or a 24-hour interval cannot cause false recovery.
begin;

-- ai-router sends chat/completions requests. Keep the root Gemini model-list
-- endpoint in sync-models by stripping /openai there for Google discovery.
update public.ai_providers
set base_url = 'https://generativelanguage.googleapis.com/v1beta/openai',
    updated_at = now()
where provider_type = 'google_ai'
  and rtrim(base_url, '/') = 'https://generativelanguage.googleapis.com/v1beta';

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.ai_model_probe_state (
  model_id integer primary key references public.ai_models(id) on delete cascade,
  consecutive_scheduled_failures integer not null default 0 check (consecutive_scheduled_failures >= 0),
  consecutive_scheduled_successes integer not null default 0 check (consecutive_scheduled_successes >= 0),
  last_scheduled_status text not null default 'unknown'
    check (last_scheduled_status in ('unknown', 'success', 'error')),
  last_scheduled_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_model_probe_logs (
  check_key text primary key,
  model_id integer references public.ai_models(id) on delete set null,
  provider_id integer references public.ai_providers(id) on delete set null,
  model_name text not null,
  provider_name text not null,
  run_type text not null check (run_type in ('manual', 'scheduled')),
  status text not null check (status in ('success', 'error', 'skipped')),
  duration_ms integer not null check (duration_ms >= 0),
  error_code text,
  checked_at timestamptz not null default now()
);

create index if not exists ai_model_probe_logs_model_checked_idx
  on public.ai_model_probe_logs (model_id, checked_at desc);
create index if not exists ai_model_probe_logs_provider_checked_idx
  on public.ai_model_probe_logs (provider_id, checked_at desc);

alter table public.ai_model_probe_state enable row level security;
alter table public.ai_model_probe_logs enable row level security;

drop policy if exists "Admins read model probe state" on public.ai_model_probe_state;
create policy "Admins read model probe state"
  on public.ai_model_probe_state for select to authenticated
  using (public.suly_is_admin());

drop policy if exists "Admins read model probe logs" on public.ai_model_probe_logs;
create policy "Admins read model probe logs"
  on public.ai_model_probe_logs for select to authenticated
  using (public.suly_is_admin());

revoke all on table public.ai_model_probe_state, public.ai_model_probe_logs from public, anon, authenticated;
grant select on table public.ai_model_probe_state, public.ai_model_probe_logs to authenticated;
grant all on table public.ai_model_probe_state, public.ai_model_probe_logs to service_role;

create or replace function public.suly_record_model_probe(
  p_model_id integer,
  p_provider_id integer,
  p_model_name text,
  p_provider_name text,
  p_run_type text,
  p_status text,
  p_duration_ms integer,
  p_error_code text,
  p_check_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_rows integer;
  v_state public.ai_model_probe_state%rowtype;
  v_auto_restrict_enabled boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_model_id is null or p_provider_id is null
     or not exists (
       select 1 from public.ai_models m
       where m.id = p_model_id and m.provider_id = p_provider_id
     ) then
    raise exception 'Model/provider pair not found' using errcode = 'P0002';
  end if;
  if p_run_type not in ('manual', 'scheduled')
     or p_status not in ('success', 'error', 'skipped')
     or p_duration_ms is null or p_duration_ms < 0
     or p_check_key is null or char_length(p_check_key) not between 1 and 180 then
    raise exception 'Invalid model probe fields' using errcode = '22023';
  end if;

  insert into public.ai_model_probe_logs
    (check_key, model_id, provider_id, model_name, provider_name, run_type, status, duration_ms, error_code)
  values
    (p_check_key, p_model_id, p_provider_id,
     left(coalesce(nullif(btrim(p_model_name), ''), 'Unknown model'), 200),
     left(coalesce(nullif(btrim(p_provider_name), ''), 'Unknown provider'), 120),
     p_run_type, p_status, p_duration_ms, left(nullif(btrim(p_error_code), ''), 100))
  on conflict (check_key) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('success', true, 'duplicate', true, 'check_key', p_check_key);
  end if;

  if p_run_type = 'scheduled' and p_status in ('success', 'error') then
    insert into public.ai_model_probe_state (model_id)
    values (p_model_id)
    on conflict (model_id) do nothing;

    select * into v_state
    from public.ai_model_probe_state
    where model_id = p_model_id
    for update;

    if p_status = 'error' then
      update public.ai_model_probe_state
      set consecutive_scheduled_failures = v_state.consecutive_scheduled_failures + 1,
          consecutive_scheduled_successes = 0,
          last_scheduled_status = 'error',
          last_scheduled_at = now(),
          last_error_code = left(nullif(btrim(p_error_code), ''), 100),
          updated_at = now()
      where model_id = p_model_id;

      select coalesce(s.health_auto_restrict_enabled, true)
        into v_auto_restrict_enabled
      from public.ai_router_settings s
      where s.id = 1;
      v_auto_restrict_enabled := coalesce(v_auto_restrict_enabled, true);

      if v_auto_restrict_enabled and v_state.consecutive_scheduled_failures + 1 >= 3 then
        insert into public.ai_model_health as existing_health
          (model_id, auto_restricted, restriction_reason, restricted_at, updated_at)
        values
          (p_model_id, true, 'Scheduled health probe failed three consecutive times.', now(), now())
        on conflict (model_id) do update set
          auto_restricted = true,
          restriction_reason = case
            when existing_health.auto_restricted then existing_health.restriction_reason
            else 'Scheduled health probe failed three consecutive times.'
          end,
          restricted_at = case
            when existing_health.auto_restricted then existing_health.restricted_at
            else now()
          end,
          updated_at = now();
      end if;
    else
      update public.ai_model_probe_state
      set consecutive_scheduled_failures = 0,
          consecutive_scheduled_successes = v_state.consecutive_scheduled_successes + 1,
          last_scheduled_status = 'success',
          last_scheduled_at = now(),
          last_error_code = null,
          updated_at = now()
      where model_id = p_model_id;

      if v_state.consecutive_scheduled_successes + 1 >= 2 then
        -- Clear only automatic health restriction. Never change the model's
        -- enabled flag or routing group: manual disables remain untouched.
        update public.ai_model_health
        set auto_restricted = false,
            restriction_reason = null,
            restricted_at = null,
            updated_at = now()
        where model_id = p_model_id and auto_restricted = true;
      end if;
    end if;

    select * into v_state
    from public.ai_model_probe_state
    where model_id = p_model_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'check_key', p_check_key,
    'run_type', p_run_type,
    'status', p_status,
    'consecutive_scheduled_failures', coalesce(v_state.consecutive_scheduled_failures, 0),
    'consecutive_scheduled_successes', coalesce(v_state.consecutive_scheduled_successes, 0)
  );
end;
$$;

revoke all on function public.suly_record_model_probe(integer, integer, text, text, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.suly_record_model_probe(integer, integer, text, text, text, text, integer, text, text)
  to service_role;

-- A random bearer-like token is stored in Vault, not in source control or in cron SQL.
do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'suly_model_health_check_token'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'suly_model_health_check_token',
      'Private token used only by the daily model health-check cron job'
    );
  end if;
end;
$$;

create or replace function public.suly_service_get_model_health_check_token()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth, vault
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  return (
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'suly_model_health_check_token'
    limit 1
  );
end;
$$;
revoke all on function public.suly_service_get_model_health_check_token() from public, anon, authenticated;
grant execute on function public.suly_service_get_model_health_check_token() to service_role;

create or replace function public.suly_trigger_model_health_check_daily()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, auth, vault, net
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'suly_model_health_check_token'
  limit 1;
  if v_token is null then
    raise exception 'Model health-check cron token is missing';
  end if;

  select net.http_post(
    url := 'https://razvryvazmqvvqkzetuo.supabase.co/functions/v1/model-health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-suly-health-check-secret', v_token
    ),
    body := jsonb_build_object('action', 'scheduled'),
    timeout_milliseconds := 5000
  ) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function public.suly_trigger_model_health_check_daily() from public, anon, authenticated, service_role;

-- Replace an existing job with the same name to keep migration retries idempotent.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'suly-model-health-check-daily'
  limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'suly-model-health-check-daily',
    '0 2 * * *',
    'select public.suly_trigger_model_health_check_daily();'
  );
end;
$$;

commit;
