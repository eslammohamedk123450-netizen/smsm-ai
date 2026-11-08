-- 029_ai_resilience_and_model_log.sql
--
-- 1) Per-message model attribution log: which model produced which assistant message.
-- 2) Fast pre-flight probe settings for the router.
-- 3) Periodic recovery of auto-restricted models (re-probe + unrestrict on success).

begin;

-- ---------------------------------------------------------------------------
-- 1) Message ⇄ model attribution
-- ---------------------------------------------------------------------------
create table if not exists public.suly_message_model_log (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.suly_messages(id) on delete cascade,
  conversation_id uuid references public.suly_conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  model_id integer references public.ai_models(id) on delete set null,
  model_identifier text,
  provider_type text,
  route text not null default 'auto',
  attempt_no integer not null default 1 check (attempt_no >= 1),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  part_index integer,
  part_count integer,
  created_at timestamptz not null default now()
);

create index if not exists suly_message_model_log_message_idx
  on public.suly_message_model_log (message_id);
create index if not exists suly_message_model_log_conversation_idx
  on public.suly_message_model_log (conversation_id, created_at desc);
create index if not exists suly_message_model_log_model_idx
  on public.suly_message_model_log (model_id, created_at desc);

alter table public.suly_message_model_log enable row level security;

drop policy if exists "suly_message_model_log_select_own" on public.suly_message_model_log;
create policy "suly_message_model_log_select_own"
  on public.suly_message_model_log
  for select
  to authenticated
  using (user_id = auth.uid() or public.suly_is_admin());

drop policy if exists "suly_message_model_log_admin_all" on public.suly_message_model_log;
create policy "suly_message_model_log_admin_all"
  on public.suly_message_model_log
  for all
  to authenticated
  using (public.suly_is_admin())
  with check (public.suly_is_admin());

revoke all on public.suly_message_model_log from anon;
grant select on public.suly_message_model_log to authenticated;
grant all on public.suly_message_model_log to service_role;

-- ---------------------------------------------------------------------------
-- 2) Router settings for the fast pre-flight probe
-- ---------------------------------------------------------------------------
alter table public.ai_router_settings
  add column if not exists preflight_probe_enabled boolean not null default true,
  add column if not exists preflight_probe_timeout_ms integer not null default 1500,
  add column if not exists preflight_probe_max_models integer not null default 6,
  add column if not exists auto_recovery_cooldown_minutes integer not null default 30,
  add column if not exists task_split_enabled boolean not null default true,
  add column if not exists task_split_max_parts integer not null default 6;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_router_settings_preflight_timeout_check'
  ) then
    alter table public.ai_router_settings
      add constraint ai_router_settings_preflight_timeout_check
      check (preflight_probe_timeout_ms between 300 and 10000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_router_settings_preflight_models_check'
  ) then
    alter table public.ai_router_settings
      add constraint ai_router_settings_preflight_models_check
      check (preflight_probe_max_models between 1 and 20);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_router_settings_split_parts_check'
  ) then
    alter table public.ai_router_settings
      add constraint ai_router_settings_split_parts_check
      check (task_split_max_parts between 2 and 12);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Recovery of auto-restricted models
-- ---------------------------------------------------------------------------
create or replace function public.suly_admin_reset_restricted_models()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_count integer := 0;
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  update public.ai_model_health
     set auto_restricted = false,
         restriction_reason = null,
         restricted_at = null,
         consecutive_failures = 0,
         failure_window_started_at = null,
         updated_at = now()
   where auto_restricted = true;

  get diagnostics v_count = row_count;

  insert into public.admin_audit_logs (admin_id, action, target_table, target_id, new_value)
  values (auth.uid(), 'reset_restricted_models', 'ai_model_health', null,
          jsonb_build_object('reset_count', v_count));

  return v_count;
end;
$$;
revoke all on function public.suly_admin_reset_restricted_models() from public, anon;
grant execute on function public.suly_admin_reset_restricted_models() to authenticated;

-- Clears restrictions older than the cooldown so the next probe can retry them.
create or replace function public.suly_reset_stale_model_restrictions(p_cooldown_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
  v_cooldown integer := greatest(5, least(coalesce(p_cooldown_minutes, 30), 1440));
begin
  update public.ai_model_health
     set auto_restricted = false,
         restriction_reason = null,
         restricted_at = null,
         consecutive_failures = 0,
         failure_window_started_at = null,
         updated_at = now()
   where auto_restricted = true
     and coalesce(restricted_at, updated_at) < now() - make_interval(mins => v_cooldown);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.suly_reset_stale_model_restrictions(integer) from public, anon, authenticated;
grant execute on function public.suly_reset_stale_model_restrictions(integer) to service_role;

-- Cron entry point: release stale restrictions, then trigger a probe run so the
-- released models are re-checked immediately instead of waiting for the daily job.
create or replace function public.suly_trigger_model_recovery()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, net, vault
as $$
declare
  v_token text;
  v_request_id bigint;
  v_released integer;
  v_cooldown integer := 30;
begin
  select coalesce(auto_recovery_cooldown_minutes, 30) into v_cooldown
  from public.ai_router_settings where id = 1;

  v_released := public.suly_reset_stale_model_restrictions(v_cooldown);

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'suly_model_health_check_token'
  limit 1;

  if v_token is null then
    return null;
  end if;

  select net.http_post(
    url := 'https://razvryvazmqvvqkzetuo.supabase.co/functions/v1/model-health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-suly-health-check-secret', v_token
    ),
    body := jsonb_build_object('action', 'scheduled', 'released', v_released),
    timeout_milliseconds := 5000
  ) into v_request_id;

  return v_request_id;
end;
$$;
revoke all on function public.suly_trigger_model_recovery() from public, anon, authenticated, service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'suly-model-health-recovery' limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'suly-model-health-recovery',
    '*/20 * * * *',
    'select public.suly_trigger_model_recovery();'
  );
end;
$$;

commit;
