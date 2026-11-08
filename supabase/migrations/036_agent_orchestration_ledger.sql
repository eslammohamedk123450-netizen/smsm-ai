begin;

create table if not exists public.agent_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  system_prompt text not null check (char_length(trim(system_prompt)) between 10 and 12000),
  model_fallback_chain jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_ledger (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.suly_conversations(id) on delete cascade,
  request_id uuid not null,
  task_key text not null,
  task_description text not null,
  assigned_agent_id uuid references public.agent_registry(id) on delete set null,
  sequence_order integer not null default 0 check (sequence_order >= 0),
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, task_key)
);

create index if not exists task_ledger_conversation_idx on public.task_ledger (conversation_id, created_at desc);
create index if not exists task_ledger_request_order_idx on public.task_ledger (request_id, sequence_order);
create index if not exists agent_registry_active_idx on public.agent_registry (is_active, updated_at desc);

alter table public.agent_registry enable row level security;
alter table public.task_ledger enable row level security;

drop policy if exists agent_registry_admin_read on public.agent_registry;
drop policy if exists agent_registry_admin_write on public.agent_registry;
create policy agent_registry_admin_read on public.agent_registry for select to authenticated using (public.suly_is_admin());
create policy agent_registry_admin_write on public.agent_registry for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());

drop policy if exists task_ledger_owner_read on public.task_ledger;
create policy task_ledger_owner_read on public.task_ledger for select to authenticated using (exists (select 1 from public.suly_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

revoke all on table public.agent_registry, public.task_ledger from anon;
grant select, insert, update, delete on public.agent_registry to authenticated;
grant select on public.task_ledger to authenticated;
grant all on public.agent_registry, public.task_ledger to service_role;

commit;
