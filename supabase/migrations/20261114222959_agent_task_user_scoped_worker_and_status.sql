-- Restrict job claims to the authenticated user's queue and expose a safe status projection.
-- The queue table itself remains service-role-only; clients never read its payload or lease columns.

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

create or replace function public.get_agent_task_job_status(p_job_id uuid)
returns table(job_id uuid,status text,task_id uuid,result jsonb,error_code text,error_message text,updated_at timestamptz,completed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id,j.status,
    case when jsonb_typeof(j.payload->'task_id') = 'string' then (j.payload->>'task_id')::uuid else null end,
    j.result,j.error_code,j.error_message,j.updated_at,j.completed_at
  from public.agent_task_jobs j
  where j.id = p_job_id and j.user_id = (select auth.uid())
  limit 1;
$$;
revoke all on function public.get_agent_task_job_status(uuid) from public,anon;
grant execute on function public.get_agent_task_job_status(uuid) to authenticated;
comment on function public.get_agent_task_job_status(uuid) is 'Returns only the caller-owned task status; does not expose queued payload or internal worker lease data.';
