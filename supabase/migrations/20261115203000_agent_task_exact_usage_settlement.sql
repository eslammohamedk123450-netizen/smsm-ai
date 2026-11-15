-- Settle Brain wallet credits and token reservations from provider-reported usage only.
-- Unknown provider attempts keep the hold pending; late usage reconciliation retries settlement.

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
  v_usage_rows integer;
  v_input_tokens bigint;
  v_output_tokens bigint;
  v_actual_cost bigint;
  v_minimum bigint;
  v_input_rate bigint;
  v_output_rate bigint;
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
  if v_job.status <> p_status then
    return jsonb_build_object('finalized', false, 'status', 'billing_pending', 'reason', 'terminal_status_mismatch');
  end if;

  select
    count(*) filter (where usage_status = 'unknown')::integer,
    count(*)::integer,
    coalesce(sum(input_tokens), 0),
    coalesce(sum(output_tokens), 0)
  into v_unknown_count, v_usage_rows, v_input_tokens, v_output_tokens
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

  select exists (
    select 1 from public.suly_credit_holds
     where task_id = p_task_id and user_id = p_user_id and status in ('held', 'settled')
  ) into v_hold_exists;
  if not v_hold_exists then
    return jsonb_build_object('finalized', false, 'status', 'billing_pending', 'reason', 'credit_hold_not_found');
  end if;

  select
    greatest(0, coalesce(minimum_request_credits, 0)),
    greatest(0, coalesce(input_credits_per_1k_tokens, 0)),
    greatest(0, coalesce(output_credits_per_1k_tokens, 0))
  into v_minimum, v_input_rate, v_output_rate
  from public.suly_credit_pricing
  where id = 1;
  if not found then
    return jsonb_build_object('finalized', false, 'status', 'billing_pending', 'reason', 'credit_pricing_unavailable');
  end if;

  -- Price the aggregate once, avoiding a minimum charge or rounding penalty per provider attempt.
  v_actual_cost := case
    when v_usage_rows = 0 or v_input_tokens + v_output_tokens = 0 then 0
    else greatest(
      v_minimum,
      ceil((v_input_tokens::numeric * v_input_rate + v_output_tokens::numeric * v_output_rate) / 1000)::bigint
    )
  end;

  if v_input_tokens > 2147483647 or v_output_tokens > 2147483647 or v_actual_cost > 1000000000 then
    raise exception 'agent_usage_exceeds_safe_limits' using errcode = '22003';
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

create or replace function public.finalize_agent_task_usage(
  p_job_id uuid,
  p_task_id uuid,
  p_user_id uuid
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
  v_wallet jsonb;
  v_brain jsonb;
begin
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

  select
    count(*) filter (where usage_status = 'unknown')::integer,
    coalesce(sum(input_tokens), 0),
    coalesce(sum(output_tokens), 0)
  into v_unknown_count, v_input_tokens, v_output_tokens
  from public.agent_step_usage
  where job_id = p_job_id and task_id = p_task_id and user_id = p_user_id;

  if v_unknown_count > 0 then
    return jsonb_build_object('finalized', false, 'status', 'billing_pending', 'reason', 'provider_usage_unavailable', 'unknown_usage_records', v_unknown_count);
  end if;
  if v_input_tokens + v_output_tokens > 2147483647 then
    raise exception 'agent_usage_exceeds_safe_limits' using errcode = '22003';
  end if;

  v_wallet := public.finalize_agent_task_step_usage(p_job_id, p_task_id, p_user_id, v_job.status);
  if coalesce((v_wallet->>'finalized')::boolean, false) is not true then
    return jsonb_build_object('finalized', false, 'status', 'billing_pending', 'reason', coalesce(v_wallet->>'reason', 'wallet_settlement_pending'), 'wallet', v_wallet);
  end if;

  v_brain := public.brain_finalize_usage(
    p_task_id,
    (v_input_tokens + v_output_tokens)::integer,
    v_job.status
  );

  return jsonb_build_object(
    'finalized', true,
    'status', v_job.status,
    'usage', jsonb_build_object('input_tokens', v_input_tokens, 'output_tokens', v_output_tokens),
    'wallet', v_wallet,
    'brain', v_brain
  );
end;
$function$;

revoke all on function public.finalize_agent_task_step_usage(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_agent_task_usage(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_agent_task_step_usage(uuid, uuid, uuid, text) to service_role;
grant execute on function public.finalize_agent_task_usage(uuid, uuid, uuid) to service_role;

create or replace function public.auto_finalize_agent_task_usage_from_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.job_type = 'brain_task'
    and new.task_id is not null
    and new.status in ('completed', 'failed', 'cancelled')
    and old.status is distinct from new.status then
    perform public.finalize_agent_task_usage(new.id, new.task_id, new.user_id);
  end if;
  return new;
end;
$function$;

create or replace function public.auto_finalize_agent_task_usage_from_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
begin
  if new.usage_status not in ('partial', 'completed') then
    return new;
  end if;

  select status into v_status
    from public.agent_task_jobs
   where id = new.job_id and task_id = new.task_id and user_id = new.user_id;

  if v_status in ('completed', 'failed', 'cancelled') then
    perform public.finalize_agent_task_usage(new.job_id, new.task_id, new.user_id);
  end if;
  return new;
end;
$function$;

revoke all on function public.auto_finalize_agent_task_usage_from_job() from public, anon, authenticated;
revoke all on function public.auto_finalize_agent_task_usage_from_usage() from public, anon, authenticated;

drop trigger if exists agent_task_jobs_auto_finalize_usage on public.agent_task_jobs;
create trigger agent_task_jobs_auto_finalize_usage
after update of status on public.agent_task_jobs
for each row execute function public.auto_finalize_agent_task_usage_from_job();

drop trigger if exists agent_step_usage_auto_finalize on public.agent_step_usage;
create trigger agent_step_usage_auto_finalize
after insert or update of usage_status, input_tokens, output_tokens, actual_cost on public.agent_step_usage
for each row execute function public.auto_finalize_agent_task_usage_from_usage();
