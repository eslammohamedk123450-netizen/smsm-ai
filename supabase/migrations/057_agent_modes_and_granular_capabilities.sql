-- Migration 057: Agent/Chat mode eligibility, task roles, and granular model capabilities
begin;

-- 1. Extend ai_models with explicit mode and task-role controls
alter table public.ai_models
  add column if not exists allowed_modes text[] not null default array['chat', 'agent']::text[];

alter table public.ai_models
  add column if not exists task_roles text[] not null default array['general']::text[];

comment on column public.ai_models.allowed_modes is
  'Execution modes permitted to invoke this model: chat, agent.';
comment on column public.ai_models.task_roles is
  'Agent orchestration roles for this model: planner, executor, summarizer, general.';

-- 2. Extend ai_router_settings with dedicated Agent Planner & Summarizer model slots
alter table public.ai_router_settings
  add column if not exists agent_planner_model_id integer
  references public.ai_models(id) on delete set null;

alter table public.ai_router_settings
  add column if not exists agent_summarizer_model_id integer
  references public.ai_models(id) on delete set null;

-- 3. Extend capabilities catalog with granular action capabilities
alter table public.capabilities
  drop constraint if exists capabilities_key_check;

alter table public.capabilities
  add constraint capabilities_key_check
  check (key in (
    'text', 'coding', 'image', 'video', 'vision', 'audio', 'reasoning', 'web_search',
    'gmail', 'google_drive', 'github',
    'read', 'write', 'convert', 'tools'
  ));

insert into public.capabilities(key, label) values
  ('read', 'القراءة والتحليل'),
  ('write', 'الكتابة والتعديل'),
  ('convert', 'التحويل والمعالجة'),
  ('tools', 'استدعاء الأدوات والوكيل')
on conflict (key) do update set label = excluded.label;

commit;
