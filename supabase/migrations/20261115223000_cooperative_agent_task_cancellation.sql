-- Cooperative running-task cancellation.
-- A running job is marked for cancellation, never force-finished while its
-- current provider/tool call may still be performing billable work.

create or replace function public.cancel_agent_task_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_job public.agent_task_jobs%rowtype;
  v_usage_exists boolean := false;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_job
    from public.agent_task_jobs
   where id = p_job_id
     and user_id = v_user_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'not_found');
  end if;

  if v_job.status = 'queued' then
    update public.agent_task_jobs
       set status = 'cancelled',
           locked_by = null,
           lease_until = null,
           error_code = 'user_cancelled',
           error_message = 'The user cancelled this task before a worker claimed it.',
           completed_at = now(),
           updated_at = now()
     where id = p_job_id and user_id = v_user_id and status = 'queued';

    if v_job.task_id is not null then
      update public.brain_task_contexts
         set status = 'cancelled', updated_at = now()
       where task_id = v_job.task_id and user_id = v_user_id
         and status = 'running';

      update public.brain_task_steps
         set status = 'cancelled'
       where task_id = v_job.task_id and status in ('pending', 'running')
         and exists (
           select 1 from public.brain_task_contexts c
            where c.task_id = v_job.task_id and c.user_id = v_user_id
         );

      select exists (
        select 1 from public.brain_usage_events
         where task_id = v_job.task_id and user_id = v_user_id
           and status = 'reserved'
      ) into v_usage_exists;

      if v_usage_exists then
        perform public.brain_finalize_usage(v_job.task_id, 0, 'cancelled');
      end if;
    end if;

    return jsonb_build_object('success', true, 'status', 'cancelled', 'cancel_requested', false);
  end if;

  if v_job.status = 'running' then
    if v_job.cancel_requested_at is not null then
      return jsonb_build_object('success', true, 'status', 'running', 'cancel_requested', true, 'already_requested', true);
    end if;

    update public.agent_task_jobs
       set cancel_requested_at = now(),
           cancel_requested_by = v_user_id,
           updated_at = now()
     where id = p_job_id and user_id = v_user_id and status = 'running'
       and cancel_requested_at is null;

    return jsonb_build_object('success', true, 'status', 'running', 'cancel_requested', true);
  end if;

  return jsonb_build_object(
    'success', false,
    'status', v_job.status,
    'reason', 'already_terminal'
  );
end;
$function$;

create or replace function public.agent_task_cancel_requested(
  p_job_id uuid,
  p_task_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_requested boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_job_id is null or p_task_id is null or p_user_id is null then
    raise exception 'invalid_agent_task_identity' using errcode = '22023';
  end if;

  select (cancel_requested_at is not null)
    into v_requested
    from public.agent_task_jobs
   where id = p_job_id
     and task_id = p_task_id
     and user_id = p_user_id
     and status = 'running';

  if not found then
    raise exception 'agent_job_not_found_or_not_running' using errcode = 'P0002';
  end if;

  return coalesce(v_requested, false);
end;
$function$;

revoke all on function public.cancel_agent_task_job(uuid) from public, anon, service_role;
grant execute on function public.cancel_agent_task_job(uuid) to authenticated;
revoke all on function public.agent_task_cancel_requested(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.agent_task_cancel_requested(uuid, uuid, uuid) to service_role;
