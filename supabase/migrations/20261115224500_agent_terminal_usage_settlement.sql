-- Complete terminal settlement for Agent wallet holds and Brain token reservations.
-- A queued cancellation has performed no provider work, so both reservations are released.
-- Terminal jobs are swept idempotently; unknown provider usage remains held for reconciliation.

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
  v_hold_exists boolean := false;
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
         and status in ('queued', 'running');

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

      select exists (
        select 1 from public.suly_credit_holds
         where task_id = v_job.task_id and user_id = v_user_id
           and status = 'held'
      ) into v_hold_exists;

      if v_hold_exists then
        perform public.finalize_credits(
          v_user_id,
          v_job.task_id,
          0,
          0,
          0,
          null,
          'agent_task_cancelled_before_start'
        );
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

create or replace function public.settle_terminal_agent_task_usage_batch(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job record;
  v_result jsonb;
  v_usage jsonb;
  v_settled integer := 0;
  v_pending integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  for v_job in
    select j.id, j.task_id, j.user_id, j.status
      from public.agent_task_jobs j
     where j.task_id is not null
       and j.status in ('completed', 'failed', 'cancelled')
       and (
         exists (
           select 1 from public.suly_credit_holds h
            where h.task_id = j.task_id and h.user_id = j.user_id
              and h.status in ('held', 'settled')
         )
         or exists (
           select 1 from public.brain_usage_events b
            where b.task_id = j.task_id and b.user_id = j.user_id
              and b.status = 'reserved'
         )
       )
     order by j.updated_at asc
     for update of j skip locked
     limit greatest(1, least(coalesce(p_limit, 50), 200))
  loop
    v_result := public.finalize_agent_task_step_usage(
      v_job.id,
      v_job.task_id,
      v_job.user_id,
      v_job.status
    );

    if coalesce((v_result->>'finalized')::boolean, false) then
      v_usage := coalesce(v_result->'usage', '{}'::jsonb);
      perform public.brain_finalize_usage(
        v_job.task_id,
        coalesce((v_usage->>'input_tokens')::integer, 0)
          + coalesce((v_usage->>'output_tokens')::integer, 0),
        v_job.status
      );
      v_settled := v_settled + 1;
    else
      v_pending := v_pending + 1;
    end if;
  end loop;

  return jsonb_build_object('settled', v_settled, 'pending', v_pending);
end;
$function$;

revoke all on function public.cancel_agent_task_job(uuid) from public, anon, service_role;
grant execute on function public.cancel_agent_task_job(uuid) to authenticated;
revoke all on function public.settle_terminal_agent_task_usage_batch(integer) from public, anon, authenticated;
grant execute on function public.settle_terminal_agent_task_usage_batch(integer) to service_role;
