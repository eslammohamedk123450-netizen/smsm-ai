-- Per-user activation-code abuse protection.
-- Reuses the existing service-role-only rate-limit row while keeping activation
-- counters separate from the legacy/general AI request counters.
begin;

alter table public.suly_ai_rate_limits
  add column if not exists activation_window_started_at timestamptz,
  add column if not exists activation_attempt_count integer not null default 0,
  add column if not exists activation_last_attempt_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.suly_ai_rate_limits'::regclass
      and conname = 'suly_ai_rate_limits_activation_attempt_count_check'
  ) then
    alter table public.suly_ai_rate_limits
      add constraint suly_ai_rate_limits_activation_attempt_count_check
      check (activation_attempt_count >= 0);
  end if;
end;
$$;

create or replace function public.suly_check_feature_activation_rate_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_row public.suly_ai_rate_limits%rowtype;
  v_now timestamptz;
  v_window_minutes constant integer := 15;
  v_attempt_limit constant integer := 5;
  v_min_interval_seconds constant integer := 3;
  v_retry_after integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22023';
  end if;

  v_now := clock_timestamp();

  insert into public.suly_ai_rate_limits (
    user_id,
    activation_window_started_at,
    activation_attempt_count,
    activation_last_attempt_at
  )
  values (p_user_id, v_now, 0, null)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.suly_ai_rate_limits
  where user_id = p_user_id
  for update;

  -- Refresh after acquiring the row lock so concurrent attempts serialize
  -- against the actual execution time, not the transaction start timestamp.
  v_now := clock_timestamp();

  if v_row.activation_window_started_at is null
     or v_row.activation_window_started_at <= v_now - make_interval(mins => v_window_minutes) then
    update public.suly_ai_rate_limits
    set activation_window_started_at = v_now,
        activation_attempt_count = 0,
        activation_last_attempt_at = null
    where user_id = p_user_id;

    v_row.activation_window_started_at := v_now;
    v_row.activation_attempt_count := 0;
    v_row.activation_last_attempt_at := null;
  end if;

  if v_row.activation_attempt_count >= v_attempt_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (
        v_row.activation_window_started_at + make_interval(mins => v_window_minutes) - v_now
      )))::integer
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', 'activation_attempt_limit',
      'retry_after_seconds', v_retry_after
    );
  end if;

  if v_row.activation_last_attempt_at is not null
     and v_row.activation_last_attempt_at > v_now - make_interval(secs => v_min_interval_seconds) then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (
        v_row.activation_last_attempt_at + make_interval(secs => v_min_interval_seconds) - v_now
      )))::integer
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', 'activation_cooldown',
      'retry_after_seconds', v_retry_after
    );
  end if;

  update public.suly_ai_rate_limits
  set activation_attempt_count = activation_attempt_count + 1,
      activation_last_attempt_at = v_now
  where user_id = p_user_id;

  return jsonb_build_object(
    'allowed', true,
    'remaining_attempts', greatest(0, v_attempt_limit - v_row.activation_attempt_count - 1)
  );
end;
$$;

revoke all on function public.suly_check_feature_activation_rate_limit(uuid) from public, anon, authenticated;
grant execute on function public.suly_check_feature_activation_rate_limit(uuid) to service_role;

comment on function public.suly_check_feature_activation_rate_limit(uuid)
is 'Atomic service-role-only per-user throttle for feature activation code attempts.';

commit;
