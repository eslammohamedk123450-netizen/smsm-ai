-- Durable media job records for studio/library progress and recovery.
-- Generation work remains provider-driven; this table records the lifecycle and
-- lets the client close/reopen without losing the request status.

begin;

create table if not exists public.suly_media_generation_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_type text not null check (service_type in ('image','video')),
  generation_model_id uuid references public.suly_media_generation_models(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  prompt text not null check (length(prompt) between 1 and 10000),
  quality text not null default 'standard',
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 3600),
  estimated_credits bigint not null default 0 check (estimated_credits >= 0),
  reserved_credits bigint not null default 0 check (reserved_credits >= 0),
  charged_credits bigint not null default 0 check (charged_credits >= 0),
  provider_cost_usd numeric(20,8) check (provider_cost_usd is null or provider_cost_usd >= 0),
  provider_cost_status text check (provider_cost_status is null or provider_cost_status in ('estimated','confirmed','reconciled')),
  provider_request_id text,
  output_asset_id uuid references public.global_media_assets(id) on delete set null,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists suly_media_generation_jobs_user_status_idx
  on public.suly_media_generation_jobs(user_id, status, created_at desc);
create index if not exists suly_media_generation_jobs_queue_idx
  on public.suly_media_generation_jobs(status, created_at)
  where status in ('queued','running');
create index if not exists suly_media_generation_jobs_model_idx
  on public.suly_media_generation_jobs(generation_model_id, created_at desc);

alter table public.suly_media_generation_jobs enable row level security;
drop policy if exists suly_media_generation_jobs_owner_read on public.suly_media_generation_jobs;
drop policy if exists suly_media_generation_jobs_admin_read on public.suly_media_generation_jobs;
create policy suly_media_generation_jobs_admin_read on public.suly_media_generation_jobs
  for select to authenticated using (public.suly_is_admin());

revoke all on public.suly_media_generation_jobs from public, anon, authenticated;
grant select on public.suly_media_generation_jobs to authenticated;
grant all on public.suly_media_generation_jobs to service_role;

create or replace function public.suly_list_my_media_generation_jobs()
returns table (
  id uuid,
  service_type text,
  status text,
  prompt text,
  quality text,
  estimated_credits bigint,
  charged_credits bigint,
  output_asset_id uuid,
  created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $
  select job.id, job.service_type, job.status, job.prompt, job.quality,
    job.estimated_credits, job.charged_credits, job.output_asset_id,
    job.created_at, job.started_at, job.completed_at, job.error_message
  from public.suly_media_generation_jobs job
  where auth.uid() is not null and job.user_id = auth.uid()
    and job.status in ('queued','running')
  order by job.created_at desc
  limit 100;
$;

revoke all on function public.suly_list_my_media_generation_jobs() from public, anon;
grant execute on function public.suly_list_my_media_generation_jobs() to authenticated;

commit;
