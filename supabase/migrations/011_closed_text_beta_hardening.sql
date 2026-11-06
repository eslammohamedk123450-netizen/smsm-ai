-- Migration 011: Closed text beta hardening
-- Additive and non-destructive: no rows, tables, or columns are deleted.
begin;

-- Do not expose provider credentials or vault identifiers through the REST table.
revoke all on table public.ai_providers from public, anon, authenticated;
create or replace view public.ai_providers_catalog
with (security_invoker = true)
as
select
  id,
  name,
  provider_type,
  base_url,
  enabled,
  priority,
  timeout_seconds,
  description,
  last_test_status,
  last_tested_at,
  created_at,
  updated_at
from public.ai_providers;
revoke all on public.ai_providers_catalog from public, anon;
grant select on public.ai_providers_catalog to authenticated;

-- Atomic per-user request guard for the closed text beta.
create table if not exists public.suly_ai_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  last_request_at timestamptz
);
alter table public.suly_ai_rate_limits enable row level security;
revoke all on table public.suly_ai_rate_limits from public, anon, authenticated;
grant all on table public.suly_ai_rate_limits to service_role;

drop policy if exists suly_ai_rate_limits_deny_client on public.suly_ai_rate_limits;
create policy suly_ai_rate_limits_deny_client
  on public.suly_ai_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.suly_check_ai_rate_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_row public.suly_ai_rate_limits%rowtype;
  v_now timestamptz := now();
  v_daily_limit integer := 60;
  v_min_interval_seconds integer := 3;
  v_retry_after integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22023';
  end if;

  insert into public.suly_ai_rate_limits(user_id, window_started_at, request_count, last_request_at)
  values (p_user_id, v_now, 0, null)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.suly_ai_rate_limits
  where user_id = p_user_id
  for update;

  if v_row.window_started_at <= v_now - interval '24 hours' then
    update public.suly_ai_rate_limits
    set window_started_at = v_now, request_count = 0, last_request_at = null
    where user_id = p_user_id;
    v_row.request_count := 0;
    v_row.last_request_at := null;
  end if;

  if v_row.request_count >= v_daily_limit then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_row.window_started_at + interval '24 hours' - v_now)))::integer);
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'retry_after_seconds', v_retry_after, 'daily_limit', v_daily_limit);
  end if;

  if v_row.last_request_at is not null and v_row.last_request_at > v_now - make_interval(secs => v_min_interval_seconds) then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_row.last_request_at + make_interval(secs => v_min_interval_seconds) - v_now)))::integer);
    return jsonb_build_object('allowed', false, 'reason', 'too_frequent', 'retry_after_seconds', v_retry_after, 'min_interval_seconds', v_min_interval_seconds);
  end if;

  update public.suly_ai_rate_limits
  set request_count = request_count + 1, last_request_at = v_now
  where user_id = p_user_id;

  return jsonb_build_object('allowed', true, 'daily_limit', v_daily_limit, 'min_interval_seconds', v_min_interval_seconds);
end;
$$;
revoke all on function public.suly_check_ai_rate_limit(uuid) from public, anon, authenticated;
grant execute on function public.suly_check_ai_rate_limit(uuid) to service_role;

commit;
