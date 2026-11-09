-- shared-task-memory: one compact scratchpad per task (request), shared by the
-- mind (router), the workers (split parts / agent loop), and the coordinator
-- (merge step). Rows are deleted as soon as the task finishes.

begin;

create table if not exists public.agent_task_memory (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.suly_conversations(id) on delete cascade,
  objective text not null default '' check (char_length(objective) <= 2200),
  done jsonb not null default '[]'::jsonb,
  remaining jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'running' check (status in ('running','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_task_memory_user_idx
  on public.agent_task_memory (user_id, created_at desc);
create index if not exists agent_task_memory_conversation_idx
  on public.agent_task_memory (conversation_id);

alter table public.agent_task_memory enable row level security;

drop policy if exists agent_task_memory_owner_all on public.agent_task_memory;
create policy agent_task_memory_owner_all on public.agent_task_memory
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.agent_task_memory from anon;
grant select, insert, update, delete on public.agent_task_memory to authenticated;
grant all on public.agent_task_memory to service_role;

-- Safety net: a crashed request must not leave scratchpads behind forever.
create or replace function public.agent_task_memory_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.agent_task_memory
  where updated_at < now() - interval '6 hours'
     or status <> 'running';
$$;

revoke all on function public.agent_task_memory_cleanup() from public, anon;
grant execute on function public.agent_task_memory_cleanup() to service_role;

commit;
