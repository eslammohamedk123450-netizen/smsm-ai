-- Correct the wallet escrow state used by the Agent usage settlement gate.
-- reserve_credits creates holds with status='held'; settled remains accepted for idempotent retries.
create or replace function public.finalize_agent_task_step_usage(
  p_job_id uuid,
  p_task_id uuid,
  p_user_id uuid,
  p_status text default 'completed'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.agent_task_jobs%rowtype;
  v_unknown_count integer;
  v_input_tokens bigint;
  v_output_tokens bigint;
  v_actual_cost bigint;
  v_hold_exists boolean := false;
  v_finalized jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_status not in ('completed', 'failed', 'cancelled') then
    raise exception 'invalid_final_status' using errcode = '22023';
  end if;

  select * into v_job
    from public.agent_task_jobs
   where id = p_job_id and task_id = p_task_id and user_id = p_user_id
   for update;

  if not found then
    raise exception 'agent_job_not_found' using errcode = 'P0002';
  end if;
  if v_job.status not in ('completed', 'failed', 'cancelled') then
    return jsonb_build_object('finalized', false, 'status', 'billing_pending', 'reason', 'job_not_terminal');
  end if;

  select count(*) filter (where usage_status = 'unknown'),
         coalesce(sum(input_tokens), 0),
         coalesce(sum(output_tokens), 0),
         coalesce(sum(actual_cost), 0)
    into v_unknown_count, v_input_tokens, v_output_tokens, v_actual_cost
    from public.agent_step_usage
   where job_id = p_job_id and task_id = p_task_id and user_id = p_user_id;

  if v_unknown_count > 0 then
    return jsonb_build_object(
      'finalized', false,
      'status', 'billing_pending',
      'reason', 'provider_usage_unavailable',
      'unknown_usage_records', v_unknown_count
    );
  end if;

  if v_input_tokens > 2147483647 or v_output_tokens > 2147483647
    or v_actual_cost > 1000000000 then
    raise exception 'agent_usage_exceeds_safe_limits' using errcode = '22003';
  end if;

  -- Brain queue jobs are backed by brain_usage_events, not suly_credit_holds.
  -- Never call finalize_credits unless this task actually owns an active credit hold.
  select exists (
    select 1 from public.suly_credit_holds
     where task_id = p_task_id and user_id = p_user_id and status in ('held', 'settled')
  ) into v_hold_exists;
  if not v_hold_exists then
    return jsonb_build_object(
      'finalized', false,
      'status', 'billing_pending',
      'reason', 'credit_hold_not_found',
      'usage', jsonb_build_object(
        'input_tokens', v_input_tokens,
        'output_tokens', v_output_tokens,
        'actual_cost', v_actual_cost
      )
    );
  end if;

  v_finalized := public.finalize_credits(
    p_user_id,
    p_task_id,
    v_actual_cost,
    v_input_tokens::integer,
    v_output_tokens::integer,
    null,
    'agent_step_usage'
  );

  return jsonb_build_object(
    'finalized', coalesce((v_finalized->>'success')::boolean, false),
    'status', p_status,
    'usage', jsonb_build_object(
      'input_tokens', v_input_tokens,
      'output_tokens', v_output_tokens,
      'actual_cost', v_actual_cost
    ),
    'settlement', v_finalized
  );
end;
$function$;


revoke all on function public.finalize_agent_task_step_usage(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_agent_task_step_usage(uuid, uuid, uuid, text) to service_role;
