-- Safe user cancellation for tasks that have not been claimed by a worker.
-- Running work is deliberately not cancelled until provider abort and partial-usage
-- settlement can be coordinated end-to-end; this RPC never mutates a running lease.

alter table public.brain_task_contexts
  drop constraint if exists brain_task_contexts_status_check;
alter table public.brain_task_contexts
  add constraint brain_task_contexts_status_check
  check (status = any (array['running','completed','failed','cancelled']::text[]));

alter table public.brain_task_steps
  drop constraint if exists brain_task_steps_status_check;
alter table public.brain_task_steps
  add constraint brain_task_steps_status_check
  check (status = any (array['pending','running','completed','failed','cancelled']::text[]));

alter table public.brain_usage_events
  drop constraint if exists brain_usage_events_status_check;
alter table public.brain_usage_events
  add constraint brain_usage_events_status_check
  check (status = any (array['reserved','completed','failed','cancelled']::text[]));

create or replace function public.brain_finalize_usage(
  p_task_id uuid,
  p_actual_tokens integer,
  p_status text default 'completed'
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_event public.brain_usage_events%rowtype;
  v_actual integer := greatest(0, coalesce(p_actual_tokens, 0));
  v_overage integer := 0;
  v_status text;
begin
  -- Direct RPC execution remains service-role-only by ACL. Authenticated is
  -- accepted here solely for the owner-checked SECURITY DEFINER cancellation RPC.
  if coalesce(auth.role(), '') not in ('service_role', 'authenticated') then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_status not in ('failed', 'completed', 'cancelled') then
    raise exception 'invalid_usage_status' using errcode = '22023';
  end if;

  select * into v_event
    from public.brain_usage_events
   where task_id = p_task_id
   for update;

  if not found then
    raise exception 'usage reservation not found' using errcode = 'P0002';
  end if;

  if v_event.status <> 'reserved' then
    return jsonb_build_object(
      'finalized', false,
      'status', v_event.status,
      'actual_tokens', v_event.actual_tokens,
      'overage_tokens', v_event.overage_tokens
    );
  end if;

  v_overage := greatest(0, v_actual - v_event.reserved_tokens);
  v_status := p_status;

  update public.brain_usage_daily
     set tokens_reserved = greatest(0, tokens_reserved - v_event.reserved_tokens),
         tokens_used = tokens_used + v_actual
   where user_id = v_event.user_id
     and usage_date = v_event.usage_date;

  update public.brain_usage_events
     set actual_tokens = v_actual,
         overage_tokens = v_overage,
         status = v_status,
         completed_at = now()
   where task_id = p_task_id;

  return jsonb_build_object(
    'finalized', true,
    'actual_tokens', v_actual,
    'overage_tokens', v_overage,
    'status', v_status
  );
end;
$function$;

revoke all on function public.brain_finalize_usage(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.brain_finalize_usage(uuid, integer, text) to service_role;

create or replace function public.cancel_agent_task_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

  if v_job.status <> 'queued' then
    return jsonb_build_object(
      'success', false,
      'status', v_job.status,
      'reason', case when v_job.status = 'running' then 'already_running' else 'already_terminal' end
    );
  end if;

  update public.agent_task_jobs
     set status = 'cancelled',
         locked_by = null,
         lease_until = null,
         error_code = 'user_cancelled',
         error_message = 'The user cancelled this task before a worker claimed it.',
         completed_at = now(),
         updated_at = now()
   where id = p_job_id
     and user_id = v_user_id
     and status = 'queued';

  if v_job.task_id is not null then
    update public.brain_task_contexts
       set status = 'cancelled',
           updated_at = now()
     where task_id = v_job.task_id
       and user_id = v_user_id
       and status = 'running';

    update public.brain_task_steps
       set status = 'cancelled'
     where task_id = v_job.task_id
       and status in ('pending', 'running')
       and exists (
         select 1 from public.brain_task_contexts context_row
          where context_row.task_id = v_job.task_id
            and context_row.user_id = v_user_id
       );

    select exists (
      select 1 from public.brain_usage_events
       where task_id = v_job.task_id
         and user_id = v_user_id
         and status = 'reserved'
    ) into v_usage_exists;

    if v_usage_exists then
      perform public.brain_finalize_usage(v_job.task_id, 0, 'cancelled');
    end if;
  end if;

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_agent_task_job(uuid) from public, anon;
grant execute on function public.cancel_agent_task_job(uuid) to authenticated;

comment on function public.cancel_agent_task_job(uuid) is
  'Atomically cancels only caller-owned queued tasks and releases their unused Brain usage reservation. Running tasks are not mutated.';
