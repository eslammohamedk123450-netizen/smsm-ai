-- Convert expired worker leases back to queued work with bounded exponential backoff.
-- A lease can be reclaimed only after its backoff expires; exhausted jobs stay terminal.
create or replace function public.claim_agent_task_jobs(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 120,
  p_user_id uuid default null
)
returns setof public.agent_task_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 1), 10));
  v_lease integer := greatest(30, least(coalesce(p_lease_seconds, 120), 900));
  v_active integer := 0;
begin
  if coalesce(length(trim(p_worker_id)), 0) = 0 or length(p_worker_id) > 120 then
    raise exception 'invalid_worker_id' using errcode = '22023';
  end if;

  if p_user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
    if exists (
      select 1 from public.agent_task_jobs active_job
      where active_job.user_id = p_user_id
        and active_job.status = 'running'
        and active_job.lease_until > now()
    ) then
      return;
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended('agent_task_global_claim_v1', 0));
    select count(*)::integer into v_active
      from public.agent_task_jobs
     where status = 'running' and lease_until > now();
    v_limit := least(v_limit, greatest(0, 5 - v_active));
    if v_limit = 0 then
      return;
    end if;
  end if;

  -- Exhausted leases become terminal before any retry is considered.
  update public.agent_task_jobs
     set status = 'failed',
         locked_by = null,
         lease_until = null,
         error_code = coalesce(error_code, 'lease_expired_max_attempts'),
         error_message = coalesce(error_message, 'Worker lease expired after maximum attempts.'),
         completed_at = now(),
         updated_at = now()
   where status = 'running'
     and lease_until <= now()
     and attempt_count >= max_attempts
     and (p_user_id is null or user_id = p_user_id);

  -- Requeue interrupted work exactly once. available_at prevents subsequent
  -- scheduler ticks from continually extending the same backoff window.
  update public.agent_task_jobs
     set status = 'queued',
         locked_by = null,
         lease_until = null,
         available_at = now() + make_interval(secs =>
           least(300, (15 * power(2, greatest(0, attempt_count - 1)))::integer)
         ),
         error_code = coalesce(error_code, 'worker_lease_expired'),
         error_message = coalesce(error_message, 'Worker lease expired; task scheduled for retry.'),
         updated_at = now()
   where status = 'running'
     and lease_until <= now()
     and attempt_count < max_attempts
     and available_at <= now()
     and (p_user_id is null or user_id = p_user_id);

  return query
  with eligible_users as (
    select
      j.user_id,
      max(j.priority) as priority,
      min(j.available_at) as available_at,
      min(j.created_at) as created_at
    from public.agent_task_jobs j
    where j.status = 'queued'
      and j.available_at <= now()
      and (p_user_id is null or j.user_id = p_user_id)
      and not exists (
        select 1
        from public.agent_task_jobs active_job
        where active_job.user_id = j.user_id
          and active_job.status = 'running'
          and active_job.lease_until > now()
      )
    group by j.user_id
  ),
  locked_users as (
    select eu.user_id
    from eligible_users eu
    where p_user_id is not null
       or pg_try_advisory_xact_lock(hashtextextended(eu.user_id::text, 0))
    order by eu.priority desc, eu.available_at asc, eu.created_at asc
    limit v_limit
  ),
  ranked_jobs as (
    select
      j.id,
      row_number() over (
        partition by j.user_id
        order by j.priority desc, j.available_at asc, j.created_at asc
      ) as user_rank
    from public.agent_task_jobs j
    join locked_users u on u.user_id = j.user_id
    where j.status = 'queued'
      and j.available_at <= now()
  ),
  candidates as (
    select j.id
    from public.agent_task_jobs j
    join ranked_jobs r on r.id = j.id
    where r.user_rank = 1
    order by j.priority desc, j.available_at asc, j.created_at asc
    for update of j skip locked
    limit v_limit
  )
  update public.agent_task_jobs j
     set status = 'running',
         attempt_count = j.attempt_count + 1,
         locked_by = p_worker_id,
         lease_until = now() + make_interval(secs => v_lease),
         started_at = coalesce(j.started_at, now()),
         updated_at = now()
    from candidates c
   where j.id = c.id
  returning j.*;
end;
$$;

revoke all on function public.claim_agent_task_jobs(text, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_agent_task_jobs(text, integer, integer, uuid) to service_role;

comment on function public.claim_agent_task_jobs(text, integer, integer, uuid) is
  'Claims one queued job per user; expired leases are requeued once with bounded exponential backoff, and exhausted attempts become terminal.';
