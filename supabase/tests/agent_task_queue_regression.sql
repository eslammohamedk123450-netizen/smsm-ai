-- Manual regression harness for the durable Agent queue.
-- Run only in a disposable/staging project or SQL transaction-capable test DB.
-- The transaction is rolled back; no queue, usage, or user data is retained.
-- set_config simulates the service_role JWT claim for SECURITY DEFINER billing RPCs.
-- This does NOT replace real HTTP/JWT/RLS integration tests.

begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_users uuid[];
  v_a uuid;
  v_b uuid;
  v_a_job uuid;
  v_b_job uuid;
  v_task uuid := gen_random_uuid();
  v_reserved jsonb;
  v_finalized jsonb;
  v_usage public.brain_usage_daily%rowtype;
  v_event public.brain_usage_events%rowtype;
  v_retry uuid;
  v_backoff uuid;
  v_claimed uuid;
begin
  select array_agg(id order by created_at)
    into v_users
    from (select id, created_at from auth.users order by created_at limit 2) users;
  if coalesce(array_length(v_users, 1), 0) < 2 then
    raise exception 'Two existing auth users are required for isolation coverage';
  end if;
  v_a := v_users[1];
  v_b := v_users[2];

  -- Distinct users can each claim only their own job.
  insert into public.agent_task_jobs(user_id, job_type, payload, idempotency_key, priority, max_attempts)
  values (v_a, 'brain_task', jsonb_build_object('user_id', v_a), 'regression-a-' || gen_random_uuid()::text, 10, 3)
  returning id into v_a_job;
  insert into public.agent_task_jobs(user_id, job_type, payload, idempotency_key, priority, max_attempts)
  values (v_b, 'brain_task', jsonb_build_object('user_id', v_b), 'regression-b-' || gen_random_uuid()::text, 10, 3)
  returning id into v_b_job;

  if not exists (
    select 1 from public.claim_agent_task_jobs('regression-worker-a', 1, 60, v_a) where id = v_a_job
  ) then raise exception 'User A could not claim its own job'; end if;
  if exists (select 1 from public.agent_task_jobs where id = v_b_job and status = 'running') then
    raise exception 'User A claim crossed into User B scope';
  end if;
  if not exists (
    select 1 from public.claim_agent_task_jobs('regression-worker-b', 1, 60, v_b) where id = v_b_job
  ) then raise exception 'User B could not claim its own job'; end if;

  -- Per-user idempotency key suppresses duplicate enqueue.
  insert into public.agent_task_jobs(user_id, job_type, payload, idempotency_key)
  values (v_a, 'brain_task', '{}'::jsonb, 'regression-duplicate-' || v_a::text)
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;
  insert into public.agent_task_jobs(user_id, job_type, payload, idempotency_key)
  values (v_a, 'brain_task', '{}'::jsonb, 'regression-duplicate-' || v_a::text)
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing;
  if (select count(*) from public.agent_task_jobs
      where user_id = v_a and idempotency_key = 'regression-duplicate-' || v_a::text) <> 1 then
    raise exception 'Duplicate enqueue created more than one row';
  end if;

  -- The idempotency-only fixture is not part of later claim-order assertions.
  update public.agent_task_jobs
     set status = 'cancelled', completed_at = now(), updated_at = now()
   where user_id = v_a
     and idempotency_key = 'regression-duplicate-' || v_a::text;

  if not public.finish_agent_task_job(v_a_job, 'regression-worker-a', 'completed', '{}'::jsonb, null, null) then
    raise exception 'User A could not finish its owned job';
  end if;
  if not public.finish_agent_task_job(v_b_job, 'regression-worker-b', 'completed', '{}'::jsonb, null, null) then
    raise exception 'User B could not finish its owned job';
  end if;

  -- An expired lease at max_attempts is terminal and cannot be reclaimed.
  insert into public.agent_task_jobs(user_id, job_type, payload, idempotency_key, max_attempts, priority)
  values (v_a, 'brain_task', '{}'::jsonb, 'regression-retry-' || gen_random_uuid()::text, 1, 100)
  returning id into v_retry;
  select id into v_claimed from public.claim_agent_task_jobs('regression-retry-worker', 1, 30, v_a);
  if v_claimed is distinct from v_retry then raise exception 'Retry test claimed an unexpected job'; end if;
  update public.agent_task_jobs set lease_until = now() - interval '1 second' where id = v_retry;
  perform * from public.claim_agent_task_jobs('regression-reclaim-worker', 1, 30, v_a);
  if (select status from public.agent_task_jobs where id = v_retry) <> 'failed' then
    raise exception 'Retry exhaustion did not move the job to failed';
  end if;

  -- Interrupted jobs are requeued once with a future backoff, not reclaimed immediately.
  insert into public.agent_task_jobs(user_id, job_type, payload, idempotency_key, max_attempts, priority)
  values (v_a, 'brain_task', '{}'::jsonb, 'regression-backoff-' || gen_random_uuid()::text, 3, 99)
  returning id into v_backoff;
  select id into v_claimed from public.claim_agent_task_jobs('regression-backoff-worker', 1, 30, v_a);
  if v_claimed is distinct from v_backoff then raise exception 'Backoff test claimed an unexpected job'; end if;
  update public.agent_task_jobs set lease_until = now() - interval '1 second' where id = v_backoff;
  perform * from public.claim_agent_task_jobs('regression-backoff-reaper', 1, 30, v_a);
  if (select status from public.agent_task_jobs where id = v_backoff) <> 'queued'
     or (select available_at <= now() from public.agent_task_jobs where id = v_backoff) then
    raise exception 'Expired lease was not requeued with a future backoff';
  end if;
  update public.agent_task_jobs set available_at = now() - interval '1 second' where id = v_backoff;
  select id into v_claimed from public.claim_agent_task_jobs('regression-backoff-retry', 1, 30, v_a);
  if v_claimed is distinct from v_backoff
     or (select attempt_count from public.agent_task_jobs where id = v_backoff) <> 2 then
    raise exception 'Backoff job was not reclaimed as its second attempt';
  end if;

  -- Usage reservation is finalized once and reconciles reserved/used tokens.
  v_reserved := public.brain_reserve_usage(v_a, v_task, 100);
  if coalesce((v_reserved->>'allowed')::boolean, false) is not true then
    raise exception 'Brain usage reservation failed: %', v_reserved;
  end if;
  v_finalized := public.brain_finalize_usage(v_task, 70, 'completed');
  if coalesce((v_finalized->>'finalized')::boolean, false) is not true then
    raise exception 'Brain usage finalization failed: %', v_finalized;
  end if;
  select * into v_event from public.brain_usage_events where task_id = v_task;
  select * into v_usage from public.brain_usage_daily where user_id = v_a and usage_date = current_date;
  if v_event.status <> 'completed'
     or v_event.actual_tokens <> 70
     or v_usage.tokens_reserved <> 0
     or v_usage.tokens_used <> 70 then
    raise exception 'Usage accounting did not reconcile';
  end if;
end $$;

rollback;
