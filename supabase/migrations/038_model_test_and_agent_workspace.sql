begin;

alter table public.agent_registry
  add column if not exists role text not null default 'worker';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agent_registry_role_check') then
    alter table public.agent_registry add constraint agent_registry_role_check
      check (role in ('planner','worker','reviewer'));
  end if;
end;
$$;

create index if not exists agent_registry_role_active_idx
  on public.agent_registry (role, is_active, updated_at desc);

create table if not exists public.agent_workspaces (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  conversation_id uuid references public.suly_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'planning' check (status in ('planning','executing','reviewing','completed','failed')),
  plan jsonb not null default '[]'::jsonb,
  final_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_workspace_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.agent_workspaces(id) on delete cascade,
  step_key text not null,
  sequence_order integer not null check (sequence_order >= 0),
  description text not null,
  assigned_agent_id uuid references public.agent_registry(id) on delete set null,
  selected_model_id integer references public.ai_models(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','running','reviewing','retrying','completed','failed')),
  attempt_no integer not null default 0 check (attempt_no >= 0),
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, step_key)
);

create table if not exists public.agent_workspace_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.agent_workspaces(id) on delete cascade,
  step_id uuid references public.agent_workspace_steps(id) on delete cascade,
  reviewer_agent_id uuid references public.agent_registry(id) on delete set null,
  model_id integer references public.ai_models(id) on delete set null,
  verdict text not null check (verdict in ('approved','retry','rejected')),
  feedback text,
  created_at timestamptz not null default now()
);

alter table public.task_ledger add column if not exists workspace_id uuid references public.agent_workspaces(id) on delete set null;
create index if not exists agent_workspaces_user_updated_idx on public.agent_workspaces (user_id, updated_at desc);
create index if not exists agent_workspace_steps_order_idx on public.agent_workspace_steps (workspace_id, sequence_order);
create index if not exists agent_workspace_reviews_step_created_idx on public.agent_workspace_reviews (step_id, created_at desc);

alter table public.agent_workspaces enable row level security;
alter table public.agent_workspace_steps enable row level security;
alter table public.agent_workspace_reviews enable row level security;

drop policy if exists agent_workspaces_owner_read on public.agent_workspaces;
create policy agent_workspaces_owner_read on public.agent_workspaces for select to authenticated
  using (user_id = auth.uid() or public.suly_is_admin());
drop policy if exists agent_workspace_steps_owner_read on public.agent_workspace_steps;
create policy agent_workspace_steps_owner_read on public.agent_workspace_steps for select to authenticated
  using (exists (select 1 from public.agent_workspaces w where w.id = workspace_id and (w.user_id = auth.uid() or public.suly_is_admin())));
drop policy if exists agent_workspace_reviews_owner_read on public.agent_workspace_reviews;
create policy agent_workspace_reviews_owner_read on public.agent_workspace_reviews for select to authenticated
  using (exists (select 1 from public.agent_workspaces w where w.id = workspace_id and (w.user_id = auth.uid() or public.suly_is_admin())));
revoke all on table public.agent_workspaces, public.agent_workspace_steps, public.agent_workspace_reviews from anon;
grant select on public.agent_workspaces, public.agent_workspace_steps, public.agent_workspace_reviews to authenticated;
grant all on public.agent_workspaces, public.agent_workspace_steps, public.agent_workspace_reviews to service_role;

insert into public.agent_registry (name, role, system_prompt, model_fallback_chain, is_active)
select 'العقل المفكر', 'planner', 'حلل طلب المستخدم، حوّله إلى خطة مرتبة من مهام صغيرة، وحدد المساعد والنموذج الأنسب لكل مهمة.', '[]'::jsonb, true
where not exists (select 1 from public.agent_registry where role = 'planner');
insert into public.agent_registry (name, role, system_prompt, model_fallback_chain, is_active)
select 'المراجع والمنسق', 'reviewer', 'راجع نتائج المهام، اكتشف النقص أو الخطأ، اطلب إعادة المحاولة عند الحاجة، ثم اجمع النتيجة النهائية بصياغة واضحة.', '[]'::jsonb, true
where not exists (select 1 from public.agent_registry where role = 'reviewer');

commit;
