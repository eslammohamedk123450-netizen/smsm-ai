begin;

alter table public.agent_workspace_reviews
  add column if not exists attempt_no integer not null default 1 check (attempt_no >= 1),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.agent_tool_execution_log
  add column if not exists input_summary jsonb;

create index if not exists agent_tool_execution_status_idx
  on public.agent_tool_execution_log (workspace_id, status, started_at desc);
create index if not exists agent_workspace_reviews_workspace_created_idx
  on public.agent_workspace_reviews (workspace_id, created_at desc);

comment on column public.agent_tool_execution_log.input_hash is 'SHA-256 of the request-scoped, redacted tool input payload.';
comment on column public.agent_tool_execution_log.input_summary is 'Bounded redacted metadata only; never raw credentials or message bodies.';
comment on table public.agent_workspace_reviews is 'Independent reviewer verdicts and bounded retry feedback for workspace outputs.';

commit;
