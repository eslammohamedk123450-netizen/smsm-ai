begin;
create table if not exists public.suly_task_ratings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.suly_conversations(id) on delete cascade,
  task_id uuid references public.suly_credit_holds(task_id) on delete set null,
  stars smallint not null check (stars between 1 and 5),
  note text check (note is null or length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
alter table public.suly_task_ratings enable row level security;
revoke all on public.suly_task_ratings from public, anon;
grant select, insert, update on public.suly_task_ratings to authenticated;
create policy suly_task_ratings_owner_read on public.suly_task_ratings for select to authenticated using (user_id = auth.uid() or public.suly_is_admin());
create policy suly_task_ratings_owner_write on public.suly_task_ratings for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.suly_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy suly_task_ratings_owner_update on public.suly_task_ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
commit;
