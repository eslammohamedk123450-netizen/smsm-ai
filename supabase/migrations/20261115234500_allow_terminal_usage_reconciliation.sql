-- Allow a terminal job to receive only a late, trustworthy upgrade of an existing unknown/partial usage record.
create or replace function public.record_agent_step_usage(
  p_job_id uuid,
  p_task_id uuid,
  p_user_id uuid,
  p_step_key text,
  p_attempt_no integer,
  p_model_call_key text,
  p_model_id integer,
  p_provider_type text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_actual_cost bigint,
  p_usage_status text,
  p_usage_source text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.agent_task_jobs%rowtype;
  v_id uuid;
  v_inserted boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_job_id is null or p_task_id is null or p_user_id is null
    or p_step_key is null or length(p_step_key) not between 1 and 160
    or p_attempt_no not between 1 and 20
    or p_model_call_key is null or length(p_model_call_key) not between 1 and 160
    or p_usage_status not in ('completed', 'partial', 'unknown')
    or p_usage_source not in ('provider_reported', 'provider_reported_partial', 'unavailable')
    or (p_input_tokens is not null and p_input_tokens < 0)
    or (p_output_tokens is not null and p_output_tokens < 0)
    or (p_actual_cost is not null and p_actual_cost < 0) then
    raise exception 'invalid_agent_step_usage' using errcode = '22023';
  end if;

  select * into v_job
    from public.agent_task_jobs
   where id = p_job_id and task_id = p_task_id and user_id = p_user_id
   for update;

  if not found then
    raise exception 'agent_job_not_found_or_not_active' using errcode = 'P0002';
  end if;
  if v_job.status not in ('running', 'cancelled')
    and not (
      p_usage_status in ('partial', 'completed')
      and exists (
        select 1 from public.agent_step_usage existing_usage
         where existing_usage.task_id = p_task_id
           and existing_usage.step_key = p_step_key
           and existing_usage.attempt_no = p_attempt_no
           and existing_usage.model_call_key = p_model_call_key
           and existing_usage.usage_status in ('unknown', 'partial')
      )
    ) then
    raise exception 'agent_job_not_active_for_new_usage' using errcode = 'P0002';
  end if;

  insert into public.agent_step_usage (
    task_id, job_id, user_id, step_key, attempt_no, model_call_key,
    model_id, provider_type, input_tokens, output_tokens, actual_cost,
    usage_status, usage_source, metadata
  ) values (
    p_task_id, p_job_id, p_user_id, p_step_key, p_attempt_no, p_model_call_key,
    p_model_id, left(coalesce(p_provider_type, ''), 80), p_input_tokens,
    p_output_tokens, p_actual_cost, p_usage_status, p_usage_source,
    case when jsonb_typeof(p_metadata) = 'object' then p_metadata else '{}'::jsonb end
  )
  on conflict (task_id, step_key, attempt_no, model_call_key) do update
    set model_id = coalesce(excluded.model_id, public.agent_step_usage.model_id),
        provider_type = coalesce(nullif(excluded.provider_type, ''), public.agent_step_usage.provider_type),
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        actual_cost = excluded.actual_cost,
        usage_status = excluded.usage_status,
        usage_source = excluded.usage_source,
        metadata = public.agent_step_usage.metadata || excluded.metadata
    where public.agent_step_usage.usage_status in ('unknown', 'partial')
      and excluded.usage_status in ('partial', 'completed')
      and (excluded.usage_status = 'completed' or public.agent_step_usage.usage_status = 'unknown')
  returning id into v_id;

  v_inserted := v_id is not null;
  if not v_inserted then
    select id into v_id
      from public.agent_step_usage
     where task_id = p_task_id and step_key = p_step_key
       and attempt_no = p_attempt_no and model_call_key = p_model_call_key;
  end if;

  return jsonb_build_object('recorded', v_inserted, 'id', v_id);
end;
$function$;


revoke all on function public.record_agent_step_usage(uuid, uuid, uuid, text, integer, text, integer, text, integer, integer, bigint, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_agent_step_usage(uuid, uuid, uuid, text, integer, text, integer, text, integer, integer, bigint, text, text, jsonb) to service_role;
