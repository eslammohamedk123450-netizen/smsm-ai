-- Regression harness for the Agent per-step usage ledger.
-- Run after the companion migration in a disposable/staging project.
-- The entire transaction is rolled back. This tests service-role-only RPC
-- behavior, per-call idempotency, and the "unknown usage => no settlement" guard.

begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_user uuid;
  v_task uuid := gen_random_uuid();
  v_job uuid;
  v_first jsonb;
  v_duplicate jsonb;
  v_unknown jsonb;
  v_count integer;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'At least one auth user is required for ledger regression coverage';
  end if;

  insert into public.agent_task_jobs(
    user_id, task_id, job_type, payload, idempotency_key, status,
    locked_by, lease_until
  ) values (
    v_user, v_task, 'brain_task', '{}'::jsonb,
    'agent-step-ledger-regression-' || gen_random_uuid()::text,
    'running', 'ledger-regression-worker', now() + interval '2 minutes'
  ) returning id into v_job;

  v_first := public.record_agent_step_usage(
    v_job, v_task, v_user, 'step-alpha', 1, 'model-call-1',
    null, 'regression-provider', 120, 45, 7,
    'completed', 'provider_reported', '{"fixture":true}'::jsonb
  );
  if coalesce((v_first->>'recorded')::boolean, false) is not true then
    raise exception 'First usage record was not inserted: %', v_first;
  end if;

  v_duplicate := public.record_agent_step_usage(
    v_job, v_task, v_user, 'step-alpha', 1, 'model-call-1',
    null, 'regression-provider', 120, 45, 7,
    'completed', 'provider_reported', '{"fixture":true}'::jsonb
  );
  if coalesce((v_duplicate->>'recorded')::boolean, true) is not false
     or v_duplicate->>'id' is distinct from v_first->>'id' then
    raise exception 'Duplicate provider callback was not idempotent: %', v_duplicate;
  end if;

  select count(*) into v_count
    from public.agent_step_usage
   where job_id = v_job and task_id = v_task;
  if v_count <> 1 then
    raise exception 'Duplicate provider callback created % rows instead of one', v_count;
  end if;

  perform public.record_agent_step_usage(
    v_job, v_task, v_user, 'step-beta', 1, 'model-call-2',
    null, 'regression-provider', null, null, null,
    'unknown', 'unavailable', '{"reason":"provider_did_not_report_usage"}'::jsonb
  );

  v_unknown := public.finalize_agent_task_step_usage(v_job, v_task, v_user, 'cancelled');
  if coalesce((v_unknown->>'finalized')::boolean, true)
     or v_unknown->>'reason' <> 'job_not_terminal' then
    raise exception 'Usage settlement was allowed before the worker reached a terminal state: %', v_unknown;
  end if;

  update public.agent_task_jobs set status = 'cancelled', completed_at = now()
   where id = v_job and task_id = v_task and user_id = v_user;

  v_unknown := public.finalize_agent_task_step_usage(v_job, v_task, v_user, 'cancelled');
  if coalesce((v_unknown->>'finalized')::boolean, true)
     or v_unknown->>'status' <> 'billing_pending'
     or v_unknown->>'reason' <> 'provider_usage_unavailable'
     or coalesce((v_unknown->>'unknown_usage_records')::integer, 0) <> 1 then
    raise exception 'Unknown provider usage did not block unsafe settlement: %', v_unknown;
  end if;

  if (select status from public.agent_task_jobs where id = v_job) <> 'cancelled' then
    raise exception 'Usage recording unexpectedly changed the job state';
  end if;
end $$;

rollback;
