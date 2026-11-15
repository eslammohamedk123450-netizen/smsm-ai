-- Periodically wake the durable Agent queue independently of mobile app activity.
-- The scheduler token is generated once and stored in Vault, never in Git or cron SQL.
begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'suly_agent_task_scheduler_token'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'suly_agent_task_scheduler_token',
      'Private bearer token used only by the SULY Agent task scheduler'
    );
  end if;
end;
$$;

create or replace function public.suly_dispatch_agent_task_scheduler()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'suly_agent_task_scheduler_token'
  limit 1;

  -- Missing Vault configuration must not turn every cron tick into an error.
  if v_token is null or length(v_token) < 32 then
    return null;
  end if;

  select net.http_post(
    url := 'https://razvryvazmqvvqkzetuo.supabase.co/functions/v1/agent-task-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-suly-scheduler-token', v_token
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 5000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.suly_dispatch_agent_task_scheduler() from public, anon, authenticated, service_role;

do $$
declare
  v_job_id bigint;
begin
  -- Replace both the previous scheduler job and this migration's name.
  -- Leaving the legacy job active would dispatch the same queue twice per minute.
  for v_job_id in
    select jobid from cron.job
    where jobname in ('suly-agent-task-scheduler', 'suly-agent-task-scheduler-every-minute')
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'suly-agent-task-scheduler-every-minute',
    '* * * * *',
    'select public.suly_dispatch_agent_task_scheduler();'
  );
end;
$$;

commit;
