begin;

-- The workspace is the durable state machine for every routed request, not only
-- deterministic multi-part tasks. Keep transitions explicit so a client can
-- resume or inspect a request after a provider failure.
alter table public.agent_workspaces
  add column if not exists current_step_key text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists last_error text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.agent_workspaces
  drop constraint if exists agent_workspaces_status_check;
alter table public.agent_workspaces
  add constraint agent_workspaces_status_check
  check (status in ('planning','executing','reviewing','waiting_approval','retrying','completed','failed','cancelled'));

alter table public.agent_workspace_steps
  add column if not exists depends_on jsonb not null default '[]'::jsonb,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists last_attempt_at timestamptz;

alter table public.agent_workspace_steps
  drop constraint if exists agent_workspace_steps_status_check;
alter table public.agent_workspace_steps
  add constraint agent_workspace_steps_status_check
  check (status in ('pending','running','reviewing','waiting_approval','retrying','completed','failed'));

create index if not exists agent_workspaces_status_updated_idx
  on public.agent_workspaces (status, updated_at desc);
create index if not exists agent_workspace_steps_status_idx
  on public.agent_workspace_steps (workspace_id, status, sequence_order);

comment on table public.agent_workspaces is 'Durable request-level state machine for planner, worker, review and resume.';
comment on table public.agent_workspace_steps is 'Durable ordered execution steps and retry state for an agent workspace.';

commit;
