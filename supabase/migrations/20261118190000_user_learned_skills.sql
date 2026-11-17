-- Per-user learned skills: reusable, reviewable playbooks distilled from successful Agent tasks
-- or explicitly taught chat instructions. Learned skills never grant tool permissions.

begin;

create table if not exists public.user_learned_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 3 and 120),
  description text not null check (char_length(trim(description)) between 10 and 1200),
  trigger_examples jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  source_kind text not null check (source_kind in ('conversation','agent_task')),
  source_ref uuid,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  confidence numeric(4,3) not null default 0.700 check (confidence between 0 and 1),
  status text not null default 'pending' check (status in ('pending','active','archived')),
  use_count integer not null default 0 check (use_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_hash)
);

create index if not exists user_learned_skills_owner_status_idx
  on public.user_learned_skills (user_id, status, updated_at desc);

alter table public.user_learned_skills enable row level security;

drop policy if exists user_learned_skills_owner_select on public.user_learned_skills;
create policy user_learned_skills_owner_select
  on public.user_learned_skills for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_learned_skills_owner_update on public.user_learned_skills;
create policy user_learned_skills_owner_update
  on public.user_learned_skills for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_learned_skills_owner_delete on public.user_learned_skills;
create policy user_learned_skills_owner_delete
  on public.user_learned_skills for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.user_learned_skills from anon, authenticated;
grant select, delete on table public.user_learned_skills to authenticated;
grant update (status) on table public.user_learned_skills to authenticated;
grant all on table public.user_learned_skills to service_role;

create or replace function public.user_learned_skills_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_learned_skills_touch_updated_at on public.user_learned_skills;
create trigger user_learned_skills_touch_updated_at
before update on public.user_learned_skills
for each row execute function public.user_learned_skills_touch_updated_at();

revoke all on function public.user_learned_skills_touch_updated_at() from public, anon, authenticated;

commit;
