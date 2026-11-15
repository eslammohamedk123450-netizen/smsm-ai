-- Allow an authenticated owner to cancel only their own queued/running task.
-- A running worker observes the cleared lease on its next heartbeat and aborts.
create or replace function public.cancel_agent_task_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  update public.agent_task_jobs
     set status = 'cancelled',
         locked_by = null,
         lease_until = null,
         error_code = 'cancelled_by_owner',
         error_message = 'Task cancelled by its owner.',
         completed_at = now(),
         updated_at = now()
   where id = p_job_id
     and user_id = auth.uid()
     and status in ('queued', 'running');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.cancel_agent_task_job(uuid) from public, anon, authenticated, service_role;

comment on function public.cancel_agent_task_job(uuid) is
  'Cancels only the authenticated owner\'s queued/running task; clearing the lease causes active workers to abort on heartbeat.';
