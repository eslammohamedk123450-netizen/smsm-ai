-- Fence every Agent execution against the current worker lease and checkpoint write-side effects.
create table if not exists public.agent_tool_execution_checkpoints (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_task_jobs(id) on delete cascade,
  task_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  occurrence_no integer not null check (occurrence_no between 1 and 20),
  worker_id text not null,
  worker_attempt integer not null check (worker_attempt between 1 and 10),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  result_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (job_id, task_id, tool_name, input_hash, occurrence_no)
);

alter table public.agent_tool_execution_checkpoints enable row level security;
revoke all on table public.agent_tool_execution_checkpoints from public, anon, authenticated, service_role;

create or replace function public.agent_task_execution_state(
  p_job_id uuid,
  p_task_id uuid,
  p_user_id uuid,
  p_worker_id text,
  p_worker_attempt integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.agent_task_jobs%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_job_id is null or p_task_id is null or p_user_id is null
    or coalesce(length(trim(p_worker_id)), 0) not between 1 and 120
    or p_worker_attempt not between 1 and 10 then
    raise exception 'invalid_agent_execution_identity' using errcode = '22023';
  end if;

  select * into v_job
    from public.agent_task_jobs
   where id = p_job_id and task_id = p_task_id and user_id = p_user_id
   for share;
  if not found then
    return jsonb_build_object('lease_valid', false, 'cancel_requested', false, 'reason', 'job_not_found');
  end if;

  return jsonb_build_object(
    'lease_valid',
      v_job.status = 'running'
      and v_job.locked_by = p_worker_id
      and v_job.attempt_count = p_worker_attempt
      and v_job.lease_until > now(),
    'cancel_requested', v_job.cancel_requested_at is not null,
    'status', v_job.status,
    'lease_until', v_job.lease_until
  );
end;
$function$;

create or replace function public.claim_agent_tool_execution(
  p_job_id uuid,
  p_task_id uuid,
  p_user_id uuid,
  p_worker_id text,
  p_worker_attempt integer,
  p_tool_name text,
  p_input_hash text,
  p_occurrence_no integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.agent_task_jobs%rowtype;
  v_checkpoint public.agent_tool_execution_checkpoints%rowtype;
  v_inserted_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_job_id is null or p_task_id is null or p_user_id is null
    or coalesce(length(trim(p_worker_id)), 0) not between 1 and 120
    or p_worker_attempt not between 1 and 10
    or p_tool_name is null or length(p_tool_name) not between 1 and 120
    or p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$'
    or p_occurrence_no not between 1 and 20 then
    raise exception 'invalid_tool_execution_checkpoint' using errcode = '22023';
  end if;

  select * into v_job
    from public.agent_task_jobs
   where id = p_job_id and task_id = p_task_id and user_id = p_user_id
   for update;
  if not found then
    return jsonb_build_object('claimed', false, 'status', 'lease_lost', 'reason', 'job_not_found');
  end if;
  if v_job.status <> 'running'
    or v_job.locked_by <> p_worker_id
    or v_job.attempt_count <> p_worker_attempt
    or v_job.lease_until <= now() then
    return jsonb_build_object('claimed', false, 'status', 'lease_lost', 'reason', 'worker_lease_invalid');
  end if;
  if v_job.cancel_requested_at is not null then
    return jsonb_build_object('claimed', false, 'status', 'cancelled', 'reason', 'user_requested_stop');
  end if;
  if not exists (
    select 1 from public.agent_tool_registry
     where name = p_tool_name and enabled = true and effect = 'write'
  ) then
    raise exception 'write_tool_not_registered' using errcode = '42501';
  end if;

  insert into public.agent_tool_execution_checkpoints(
    job_id, task_id, user_id, tool_name, input_hash, occurrence_no,
    worker_id, worker_attempt, status
  ) values (
    p_job_id, p_task_id, p_user_id, p_tool_name, p_input_hash, p_occurrence_no,
    p_worker_id, p_worker_attempt, 'running'
  )
  on conflict (job_id, task_id, tool_name, input_hash, occurrence_no) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    return jsonb_build_object('claimed', true, 'status', 'running', 'checkpoint_id', v_inserted_id);
  end if;

  select * into v_checkpoint
    from public.agent_tool_execution_checkpoints
   where job_id = p_job_id and task_id = p_task_id
     and tool_name = p_tool_name and input_hash = p_input_hash
     and occurrence_no = p_occurrence_no
   for update;

  if v_checkpoint.status in ('completed', 'failed') then
    return jsonb_build_object(
      'claimed', false,
      'status', v_checkpoint.status,
      'checkpoint_id', v_checkpoint.id,
      'result', v_checkpoint.result_payload
    );
  end if;

  return jsonb_build_object(
    'claimed', false,
    'status', 'outcome_unknown',
    'checkpoint_id', v_checkpoint.id,
    'reason', 'previous_worker_may_have_completed_external_side_effect'
  );
end;
$function$;

create or replace function public.complete_agent_tool_execution(
  p_job_id uuid,
  p_task_id uuid,
  p_user_id uuid,
  p_worker_id text,
  p_worker_attempt integer,
  p_checkpoint_id uuid,
  p_status text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job public.agent_task_jobs%rowtype;
  v_checkpoint public.agent_tool_execution_checkpoints%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_status not in ('completed', 'failed')
    or p_checkpoint_id is null
    or coalesce(pg_catalog.octet_length(p_result::text), 0) > 131072 then
    raise exception 'invalid_tool_execution_result' using errcode = '22023';
  end if;

  select * into v_job
    from public.agent_task_jobs
   where id = p_job_id and task_id = p_task_id and user_id = p_user_id
   for update;
  if not found then
    return jsonb_build_object('completed', false, 'reason', 'job_not_found');
  end if;
  -- A lease that expired but has not been reclaimed may still complete its
  -- already-started side effect. A replacement worker changes both fields and fences it out.
  if v_job.status <> 'running'
    or v_job.locked_by <> p_worker_id
    or v_job.attempt_count <> p_worker_attempt then
    return jsonb_build_object('completed', false, 'reason', 'worker_lease_replaced');
  end if;

  select * into v_checkpoint
    from public.agent_tool_execution_checkpoints
   where id = p_checkpoint_id and job_id = p_job_id and task_id = p_task_id
     and user_id = p_user_id and worker_id = p_worker_id
     and worker_attempt = p_worker_attempt
   for update;
  if not found then
    return jsonb_build_object('completed', false, 'reason', 'checkpoint_not_found');
  end if;
  if v_checkpoint.status in ('completed', 'failed') then
    return jsonb_build_object('completed', true, 'already_completed', true, 'status', v_checkpoint.status);
  end if;

  update public.agent_tool_execution_checkpoints
     set status = p_status,
         result_payload = case when jsonb_typeof(p_result) = 'object' then p_result else jsonb_build_object('result', p_result) end,
         updated_at = now(),
         completed_at = now()
   where id = p_checkpoint_id;

  return jsonb_build_object('completed', true, 'status', p_status);
end;
$function$;

revoke all on function public.agent_task_execution_state(uuid, uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.claim_agent_tool_execution(uuid, uuid, uuid, text, integer, text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_agent_tool_execution(uuid, uuid, uuid, text, integer, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.agent_task_execution_state(uuid, uuid, uuid, text, integer) to service_role;
grant execute on function public.claim_agent_tool_execution(uuid, uuid, uuid, text, integer, text, text, integer) to service_role;
grant execute on function public.complete_agent_tool_execution(uuid, uuid, uuid, text, integer, uuid, text, jsonb) to service_role;
