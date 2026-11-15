-- Sequential race regression for running cancellation vs lease expiry/reclaim.
-- The transaction is rolled back after checking the row-lock/fencing behavior.

begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_user uuid;
  v_task uuid := gen_random_uuid();
  v_job uuid;
  v_cancel jsonb;
  v_claimed public.agent_task_jobs%rowtype;
  v_cancelled boolean;
  v_old_finish boolean;
  v_new_finish boolean;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'At least one auth user is required for lease/cancellation regression coverage';
  end if;

  insert into public.agent_task_jobs(
    user_id, task_id, job_type, payload, idempotency_key, status,
    attempt_count, max_attempts, available_at, locked_by, lease_until
  ) values (
    v_user, v_task, 'brain_task', '{}'::jsonb,
    'cancel-lease-race-' || gen_random_uuid()::text,
    'running', 1, 3, now() - interval '1 minute',
    'old-worker', now() - interval '1 second'
  ) returning id into v_job;

  -- User asks to stop while the first worker's lease has just expired.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  v_cancel := public.cancel_agent_task_job(v_job);
  if coalesce((v_cancel->>'success')::boolean, false) is not true
     or coalesce((v_cancel->>'cancel_requested')::boolean, false) is not true then
    raise exception 'Running cancellation was not recorded: %', v_cancel;
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  -- First scheduler pass requeues with bounded backoff; simulate that delay elapsing.
  select * into v_claimed
    from public.claim_agent_task_jobs('replacement-worker', 1, 120, v_user)
   limit 1;
  if v_claimed.id is not null then
    raise exception 'Expired job bypassed its retry backoff window';
  end if;
  update public.agent_task_jobs set available_at = now() - interval '1 second'
   where id = v_job and status = 'queued';
  select * into v_claimed
    from public.claim_agent_task_jobs('replacement-worker', 1, 120, v_user)
   limit 1;
  if v_claimed.id is distinct from v_job
     or v_claimed.status <> 'running'
     or v_claimed.locked_by <> 'replacement-worker'
     or v_claimed.attempt_count <> 2
     or v_claimed.cancel_requested_at is null then
    raise exception 'Expired lease reclaim lost the durable cancellation request: %', row_to_json(v_claimed);
  end if;

  v_cancelled := public.agent_task_cancel_requested(v_job, v_task, v_user);
  if v_cancelled is not true then
    raise exception 'Replacement worker could not observe the durable cancellation request';
  end if;

  v_old_finish := public.finish_agent_task_job(v_job, 'old-worker', 'completed', '{"stale":true}'::jsonb, null, null);
  if v_old_finish is true then
    raise exception 'Stale worker was allowed to finalize after its lease was reclaimed';
  end if;

  v_new_finish := public.finish_agent_task_job(v_job, 'replacement-worker', 'cancelled', '{"status":"cancelled"}'::jsonb, null, null);
  if v_new_finish is not true then
    raise exception 'Current lease owner could not finalize the cancelled task';
  end if;
  if (select status from public.agent_task_jobs where id = v_job) <> 'cancelled' then
    raise exception 'Task did not reach cancelled terminal state';
  end if;
end $$;

rollback;
