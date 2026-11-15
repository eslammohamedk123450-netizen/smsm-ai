-- Per-step provider usage ledger for accurate Agent cancellation billing.
-- This migration is intentionally staged on the feature branch; do not apply
-- to production until the worker/router write path and regression tests land.

alter table public.agent_task_jobs
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancel_requested_by uuid references auth.users(id) on delete set null;

create table if not exists public.agent_step_usage (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  job_id uuid not null references public.agent_task_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_key text not null check (length(step_key) between 1 and 160),
  attempt_no integer not null default 1 check (attempt_no between 1 and 20),
  model_call_key text not null check (length(model_call_key) between 1 and 160),
  model_id integer,
  provider_type text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  actual_cost bigint check (actual_cost is null or actual_cost >= 0),
  usage_status text not null check (usage_status in ('completed', 'partial', 'unknown')),
  usage_source text not null check (usage_source in ('provider_reported', 'provider_reported_partial', 'unavailable')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agent_step_usage_source_status_check check (
    (usage_status = 'completed' and usage_source = 'provider_reported'
      and input_tokens is not null and output_tokens is not null and actual_cost is not null)
    or
    (usage_status = 'partial' and usage_source = 'provider_reported_partial'
      and input_tokens is not null and output_tokens is not null and actual_cost is not null)
    or
    (usage_status = 'unknown' and usage_source = 'unavailable'
      and actual_cost is null)
  ),
  constraint agent_step_usage_idempotency unique (task_id, step_key, attempt_no, model_call_key)
);

create index if not exists agent_step_usage_job_idx
  on public.agent_step_usage(job_id, created_at);

create index if not exists agent_step_usage_task_user_idx
  on public.agent_step_usage(task_id, user_id);

alter table public.agent_step_usage enable row level security;
revoke all on public.agent_step_usage from public, anon, authenticated;
grant select, insert on public.agent_step_usage to service_role;

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

  if not found or v_job.status not in ('running', 'cancelled') then
    raise exception 'agent_job_not_found_or_not_active' using errcode = 'P0002';
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
  on conflict (task_id, step_key, attempt_no, model_call_key) do nothing
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

revoke all on function public.record_agent_step_usage(uuid, uuid, uuid, text, integer, text, integer, text, integer, integer, bigint, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.finalize_agent_task_step_usage(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_agent_step_usage(uuid, uuid, uuid, text, integer, text, integer, text, integer, integer, bigint, text, text, jsonb) to service_role;
grant execute on function public.finalize_agent_task_step_usage(uuid, uuid, uuid, text) to service_role;
