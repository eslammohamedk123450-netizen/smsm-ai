begin;

create table if not exists public.suly_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#D4AF37',
  icon_key text not null default 'folder',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suly_projects_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint suly_projects_description_length check (description is null or char_length(description) <= 2000),
  constraint suly_projects_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint suly_projects_icon_key check (icon_key = any (array[
    'folder','code','briefcase','book','lightbulb','palette','rocket','database','globe'
  ])),
  constraint suly_projects_id_user_unique unique (id, user_id)
);

create index if not exists suly_projects_user_updated_idx
  on public.suly_projects (user_id, updated_at desc)
  where archived_at is null;

alter table public.suly_projects enable row level security;

revoke all on table public.suly_projects from public, anon;
grant select, insert, update, delete on table public.suly_projects to authenticated;

drop policy if exists suly_projects_select_owner on public.suly_projects;
create policy suly_projects_select_owner
  on public.suly_projects for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists suly_projects_insert_owner on public.suly_projects;
create policy suly_projects_insert_owner
  on public.suly_projects for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists suly_projects_update_owner on public.suly_projects;
create policy suly_projects_update_owner
  on public.suly_projects for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists suly_projects_delete_owner on public.suly_projects;
create policy suly_projects_delete_owner
  on public.suly_projects for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.suly_conversations
  add column if not exists project_id uuid;

create index if not exists suly_conversations_project_owner_idx
  on public.suly_conversations (project_id, user_id)
  where project_id is not null;

alter table public.suly_conversations
  drop constraint if exists suly_conversations_project_owner_fkey;

alter table public.suly_conversations
  add constraint suly_conversations_project_owner_fkey
  foreign key (project_id, user_id)
  references public.suly_projects (id, user_id)
  on delete set null (project_id)
  on update restrict;

create or replace function public.suly_touch_project_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists suly_projects_touch_updated_at on public.suly_projects;
create trigger suly_projects_touch_updated_at
before update on public.suly_projects
for each row execute function public.suly_touch_project_updated_at();

revoke all on function public.suly_touch_project_updated_at() from public, anon, authenticated, service_role;

comment on table public.suly_projects is
  'Private user-owned SULY projects. Conversation ownership is enforced by a composite project_id/user_id foreign key.';

commit;