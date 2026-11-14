-- Durable task queue foundation for SULY Agent.
-- This migration is intentionally additive: existing workspace and task-ledger
-- records are preserved and are not silently migrated or deleted.

create table if not exists public.agent_task_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  priority smallint not null default 0,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  locked_by text,
  lease_until timestamptz,
  result jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint agent_task_jobs_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint agent_task_jobs_idempotency_key_length check (
    idempotency_key is null or length(idempotency_key) between 1 and 200
  )
);

create unique index if not exists agent_task_jobs_user_idempotency_uidx
  on public.agent_task_jobs(user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists agent_task_jobs_claim_idx
  on public.agent_task_jobs(priority desc, available_at asc, created_at asc)
  where status = 'queued';

create index if not exists agent_task_jobs_expired_lease_idx
  on public.agent_task_jobs(lease_until)
  where status = 'running';

create index if not exists agent_task_jobs_user_created_idx
  on public.agent_task_jobs(user_id, created_at desc);

alter table public.agent_task_jobs enable row level security;
revoke all on public.agent_task_jobs from anon, authenticated;
grant all on public.agent_task_jobs to service_role;

create or replace function public.claim_agent_task_jobs(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 120
)
returns setof public.agent_task_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 1), 10));
  v_lease integer := greatest(30, least(coalesce(p_lease_seconds, 120), 900));
begin
  if coalesce(length(trim(p_worker_id)), 0) = 0 or length(p_worker_id) > 120 then
    raise exception 'invalid_worker_id' using errcode = '22023';
  end if;

  -- Expired jobs that exhausted their retry budget become terminal.
  update public.agent_task_jobs
     set status = 'failed',
         locked_by = null,
         lease_until = null,
         error_code = coalesce(error_code, 'lease_expired_max_attempts'),
         error_message = coalesce(error_message, 'Worker lease expired after maximum attempts.'),
         completed_at = now(),
         updated_at = now()
   where status = 'running'
     and lease_until <= now()
     and attempt_count >= max_attempts;

  return query
  with candidates as (
    select j.id
      from public.agent_task_jobs as j
     where (
       (j.status = 'queued' and j.available_at <= now())
       or (j.status = 'running' and j.lease_until <= now() and j.attempt_count < j.max_attempts)
     )
     order by j.priority desc, j.available_at asc, j.created_at asc
     for update skip locked
     limit v_limit
  )
  update public.agent_task_jobs as j
     set status = 'running',
         attempt_count = j.attempt_count + 1,
         locked_by = p_worker_id,
         lease_until = now() + make_interval(secs => v_lease),
         started_at = coalesce(j.started_at, now()),
         updated_at = now()
    from candidates as c
   where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.heartbeat_agent_task_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
  v_lease integer := greatest(30, least(coalesce(p_lease_seconds, 120), 900));
begin
  update public.agent_task_jobs
     set lease_until = now() + make_interval(secs => v_lease),
         updated_at = now()
   where id = p_job_id
     and status = 'running'
     and locked_by = p_worker_id
     and lease_until > now();

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.finish_agent_task_job(
  p_job_id uuid,
  p_worker_id text,
  p_status text,
  p_result jsonb default null,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_status not in ('completed', 'failed', 'cancelled') then
    raise exception 'invalid_terminal_status' using errcode = '22023';
  end if;

  update public.agent_task_jobs
     set status = p_status,
         result = case when p_status = 'completed' then p_result else result end,
         error_code = case when p_status = 'completed' then null else left(p_error_code, 120) end,
         error_message = case when p_status = 'completed' then null else left(p_error_message, 2000) end,
         locked_by = null,
         lease_until = null,
         completed_at = now(),
         updated_at = now()
   where id = p_job_id
     and status = 'running'
     and locked_by = p_worker_id;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.claim_agent_task_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_agent_task_job(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.finish_agent_task_job(uuid, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.claim_agent_task_jobs(text, integer, integer) to service_role;
grant execute on function public.heartbeat_agent_task_job(uuid, text, integer) to service_role;
grant execute on function public.finish_agent_task_job(uuid, text, text, jsonb, text, text) to service_role;

comment on table public.agent_task_jobs is
  'Durable, service-role-only queue for resumable SULY agent jobs. Existing task tables remain the execution history.';
comment on function public.claim_agent_task_jobs(text, integer, integer) is
  'Atomically leases queued or expired jobs using SKIP LOCKED; service_role only.';
