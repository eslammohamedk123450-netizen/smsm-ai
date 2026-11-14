begin;

alter table public.agent_registry
  drop constraint if exists agent_registry_role_check;
alter table public.agent_registry
  add constraint agent_registry_role_check
  check (role in ('planner','worker','reviewer','summarizer','coordinator','thinker'));

create table if not exists public.agent_tool_registry (
  name text primary key check (name ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  provider text not null check (provider in ('composio','tavily','internal')),
  description text not null check (char_length(trim(description)) between 3 and 500),
  effect text not null check (effect in ('read','write')),
  input_schema jsonb not null default '{}'::jsonb,
  required_capabilities text[] not null default '{}'::text[],
  requires_approval boolean not null default false,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_tool_execution_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  workspace_id uuid references public.agent_workspaces(id) on delete set null,
  step_id uuid references public.agent_workspace_steps(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  tool_name text not null references public.agent_tool_registry(name) on delete restrict,
  provider text not null,
  effect text not null check (effect in ('read','write')),
  status text not null check (status in ('pending','approved','rejected','running','completed','failed')),
  input_hash text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  result_summary jsonb
);

create index if not exists agent_tool_execution_request_idx
  on public.agent_tool_execution_log (request_id, started_at desc);
create index if not exists agent_tool_execution_user_idx
  on public.agent_tool_execution_log (user_id, started_at desc);

alter table public.agent_tool_registry enable row level security;
alter table public.agent_tool_execution_log enable row level security;
drop policy if exists agent_tool_registry_admin_read on public.agent_tool_registry;
create policy agent_tool_registry_admin_read on public.agent_tool_registry for select to authenticated using (public.suly_is_admin());
drop policy if exists agent_tool_registry_admin_write on public.agent_tool_registry;
create policy agent_tool_registry_admin_write on public.agent_tool_registry for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());
drop policy if exists agent_tool_execution_owner_read on public.agent_tool_execution_log;
create policy agent_tool_execution_owner_read on public.agent_tool_execution_log for select to authenticated using (user_id = auth.uid() or public.suly_is_admin());
revoke all on table public.agent_tool_registry, public.agent_tool_execution_log from anon;
grant select, insert, update, delete on public.agent_tool_registry to authenticated;
grant select on public.agent_tool_execution_log to authenticated;
grant all on public.agent_tool_registry, public.agent_tool_execution_log to service_role;

insert into public.agent_tool_registry (name, provider, description, effect, input_schema, required_capabilities, requires_approval)
values
  ('connected_app.status', 'composio', 'التحقق من حالة اتصال التطبيقات للمستخدم.', 'read', '{"type":"object","additionalProperties":false}', array['tools'], false),
  ('connected_app.read', 'composio', 'قراءة بيانات من موصل واحد نشط عبر أداة آمنة.', 'read', '{"type":"object","required":["toolkit"],"properties":{"toolkit":{"type":"string"}},"additionalProperties":false}', array['tools','read'], false),
  ('connected_app.read_multiple', 'composio', 'قراءة فقط من موصلات ذكرها المستخدم صراحة.', 'read', '{"type":"object","required":["toolkits"],"properties":{"toolkits":{"type":"array"}},"additionalProperties":false}', array['tools','read'], false),
  ('connected_app.write', 'composio', 'إرسال أو إنشاء أو تعديل عبر موصل واحد بعد موافقة صريحة.', 'write', '{"type":"object","required":["toolkit"],"properties":{"toolkit":{"type":"string"}},"additionalProperties":false}', array['tools','write'], true),
  ('web.search', 'tavily', 'بحث حي في الويب عند طلب معلومة حديثة.', 'read', '{"type":"object","required":["query"],"properties":{"query":{"type":"string"}},"additionalProperties":false}', array['web_search'], false)
on conflict (name) do update set description = excluded.description, input_schema = excluded.input_schema, required_capabilities = excluded.required_capabilities, requires_approval = excluded.requires_approval, updated_at = now();

commit;
