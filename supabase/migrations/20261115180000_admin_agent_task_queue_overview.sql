-- Admin-only operational visibility for the durable Agent queue.
create index if not exists agent_task_jobs_status_updated_idx
  on public.agent_task_jobs(status, updated_at desc);
create index if not exists agent_task_jobs_created_desc_idx
  on public.agent_task_jobs(created_at desc);

-- Payloads and task results are intentionally excluded from this overview.
create or replace function public.suly_admin_agent_task_overview()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_admin uuid := auth.uid();
  v_queued bigint;
  v_running bigint;
  v_completed bigint;
  v_failed bigint;
  v_cancelled bigint;
  v_expired bigint;
  v_oldest_queued timestamptz;
  v_recent jsonb;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  select
    count(*) filter (where status = 'queued'),
    count(*) filter (where status = 'running'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'cancelled'),
    count(*) filter (where status = 'running' and lease_until <= now()),
    min(created_at) filter (where status = 'queued')
  into v_queued, v_running, v_completed, v_failed, v_cancelled, v_expired, v_oldest_queued
  from public.agent_task_jobs;

  select coalesce(jsonb_agg(to_jsonb(recent)), '[]'::jsonb)
    into v_recent
    from (
      select id, user_id, job_type, status, priority, attempt_count, max_attempts,
             created_at, updated_at, started_at, completed_at, error_code
        from public.agent_task_jobs
       order by created_at desc
       limit 20
    ) recent;

  return jsonb_build_object(
    'queued_count', coalesce(v_queued, 0),
    'running_count', coalesce(v_running, 0),
    'completed_count', coalesce(v_completed, 0),
    'failed_count', coalesce(v_failed, 0),
    'cancelled_count', coalesce(v_cancelled, 0),
    'expired_lease_count', coalesce(v_expired, 0),
    'oldest_queued_at', v_oldest_queued,
    'recent_jobs', v_recent,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.suly_admin_agent_task_overview() from public, anon;
grant execute on function public.suly_admin_agent_task_overview() to authenticated;

comment on function public.suly_admin_agent_task_overview() is
  'Returns queue counts and recent non-payload metadata to verified administrators only.';
