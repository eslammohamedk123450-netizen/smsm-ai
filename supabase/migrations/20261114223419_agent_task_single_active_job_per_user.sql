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
begin
  if coalesce(length(trim(p_worker_id)), 0) = 0 or length(p_worker_id) > 120 then
    raise exception 'invalid_worker_id' using errcode = '22023';
  end if;

  -- Serialize claims for one user and keep only one active task per account.
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
  end if;

  update public.agent_task_jobs
     set status = 'failed', locked_by = null, lease_until = null,
         error_code = coalesce(error_code, 'lease_expired_max_attempts'),
         error_message = coalesce(error_message, 'Worker lease expired after maximum attempts.'),
         completed_at = now(), updated_at = now()
   where status = 'running' and lease_until <= now() and attempt_count >= max_attempts
     and (p_user_id is null or user_id = p_user_id);

  return query
  with candidates as (
    select j.id from public.agent_task_jobs j
     where ((j.status = 'queued' and j.available_at <= now())
       or (j.status = 'running' and j.lease_until <= now() and j.attempt_count < j.max_attempts))
       and (p_user_id is null or j.user_id = p_user_id)
     order by j.priority desc, j.available_at asc, j.created_at asc
     for update skip locked limit v_limit
  )
  update public.agent_task_jobs j
     set status = 'running', attempt_count = j.attempt_count + 1,
         locked_by = p_worker_id, lease_until = now() + make_interval(secs => v_lease),
         started_at = coalesce(j.started_at, now()), updated_at = now()
    from candidates c where j.id = c.id returning j.*;
end;
$$;
revoke all on function public.claim_agent_task_jobs(text,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_agent_task_jobs(text,integer,integer,uuid) to service_role;
