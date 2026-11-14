begin;

alter table public.ai_router_settings
  add column if not exists gmail_task_model_id integer
  references public.ai_models(id) on delete set null;

comment on column public.ai_router_settings.gmail_task_model_id is
  'Optional preferred model for Gmail connector follow-up and summarization only.';

commit;
