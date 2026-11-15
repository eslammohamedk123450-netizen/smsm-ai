-- Regression harness for worker lease fencing and write-side-effect checkpoints.
-- Run after 20261115204000_agent_worker_fencing_and_tool_checkpoints.sql.
-- All fixtures are rolled back.

begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_user uuid;
  v_task uuid := gen_random_uuid();
  v_job uuid;
  v_state jsonb;
  v_first jsonb;
  v_duplicate jsonb;
  v_complete jsonb;
  v_replayed jsonb;
  v_stale jsonb;
  v_stale_complete jsonb;
  v_new_claim jsonb;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'At least one auth user is required for worker-fencing regression coverage';
  end if;

  insert into public.agent_task_jobs(
    user_id, task_id, job_type, payload, idempotency_key, status,
    attempt_count, max_attempts, locked_by, lease_until
  ) values (
    v_user, v_task, 'brain_task', '{}'::jsonb,
    'worker-fencing-' || gen_random_uuid()::text,
    'running', 1, 3, 'worker-a', now() + interval '2 minutes'
  ) returning id into v_job;

  v_state := public.agent_task_execution_state(v_job, v_task, v_user, 'worker-a', 1);
  if coalesce((v_state->>'lease_valid')::boolean, false) is not true then
    raise exception 'Current worker lease was not recognized: %', v_state;
  end if;

  v_first := public.claim_agent_tool_execution(
    v_job, v_task, v_user, 'worker-a', 1, 'connected_app.write',
    repeat('a', 64), 1
  );
  if coalesce((v_first->>'claimed')::boolean, false) is not true then
    raise exception 'First write checkpoint was not claimed: %', v_first;
  end if;

  v_duplicate := public.claim_agent_tool_execution(
    v_job, v_task, v_user, 'worker-a', 1, 'connected_app.write',
    repeat('a', 64), 1
  );
  if v_duplicate->>'status' <> 'outcome_unknown' then
    raise exception 'An in-flight side effect was not fenced against replay: %', v_duplicate;
  end if;

  v_complete := public.complete_agent_tool_execution(
    v_job, v_task, v_user, 'worker-a', 1,
    (v_first->>'checkpoint_id')::uuid, 'completed',
    '{"status":"executed","external_id":"fixture-123"}'::jsonb
  );
  if coalesce((v_complete->>'completed')::boolean, false) is not true then
    raise exception 'Write checkpoint did not persist its result: %', v_complete;
  end if;

  v_replayed := public.claim_agent_tool_execution(
    v_job, v_task, v_user, 'worker-a', 1, 'connected_app.write',
    repeat('a', 64), 1
  );
  if v_replayed->>'status' <> 'completed'
     or v_replayed->'result'->>'external_id' <> 'fixture-123' then
    raise exception 'Completed write checkpoint was not replayed from durable result: %', v_replayed;
  end if;

  -- A second identical intentional write gets its own occurrence key.
  v_new_claim := public.claim_agent_tool_execution(
    v_job, v_task, v_user, 'worker-a', 1, 'connected_app.write',
    repeat('a', 64), 2
  );
  if coalesce((v_new_claim->>'claimed')::boolean, false) is not true then
    raise exception 'Distinct write occurrence was incorrectly collapsed: %', v_new_claim;
  end if;

  -- Replacing the lease fences the old worker from further execution and completion.
  update public.agent_task_jobs
     set locked_by = 'worker-b', attempt_count = 2, lease_until = now() + interval '2 minutes'
   where id = v_job;
  v_stale := public.agent_task_execution_state(v_job, v_task, v_user, 'worker-a', 1);
  if coalesce((v_stale->>'lease_valid')::boolean, true) is not false then
    raise exception 'Stale worker still has a valid lease: %', v_stale;
  end if;

  v_stale_complete := public.complete_agent_tool_execution(
    v_job, v_task, v_user, 'worker-a', 1,
    (v_new_claim->>'checkpoint_id')::uuid, 'completed',
    '{"status":"executed","external_id":"stale"}'::jsonb
  );
  if coalesce((v_stale_complete->>'completed')::boolean, true) is not false
     or v_stale_complete->>'reason' <> 'worker_lease_replaced' then
    raise exception 'Stale worker completed a side effect checkpoint: %', v_stale_complete;
  end if;

  update public.agent_task_jobs
     set cancel_requested_at = now(), cancel_requested_by = v_user
   where id = v_job;
  v_state := public.agent_task_execution_state(v_job, v_task, v_user, 'worker-b', 2);
  if coalesce((v_state->>'lease_valid')::boolean, false) is not true
     or coalesce((v_state->>'cancel_requested')::boolean, false) is not true then
    raise exception 'Current worker did not observe the cancellation request: %', v_state;
  end if;

  v_new_claim := public.claim_agent_tool_execution(
    v_job, v_task, v_user, 'worker-b', 2, 'connected_app.write',
    repeat('b', 64), 1
  );
  if v_new_claim->>'status' <> 'cancelled' then
    raise exception 'A new write was allowed after cancellation was requested: %', v_new_claim;
  end if;

  if has_function_privilege('authenticated', 'public.claim_agent_tool_execution(uuid,uuid,uuid,text,integer,text,text,integer)', 'EXECUTE') then
    raise exception 'Authenticated clients must not call the service-role checkpoint RPC';
  end if;
  if has_table_privilege('authenticated', 'public.agent_tool_execution_checkpoints', 'SELECT') then
    raise exception 'Authenticated clients must not read private tool execution checkpoints';
  end if;
end $$;

rollback;
