begin;

-- Keep the existing permissive policies, while ensuring that any future or
-- legacy permissive policy is also constrained to the active owner.
alter table public.suly_messages enable row level security;

drop policy if exists suly_messages_owner_scope_select on public.suly_messages;
create policy suly_messages_owner_scope_select
  on public.suly_messages
  as restrictive
  for select
  to authenticated
  using (user_id = auth.uid() and suly_is_active_user());

drop policy if exists suly_messages_owner_scope_insert on public.suly_messages;
create policy suly_messages_owner_scope_insert
  on public.suly_messages
  as restrictive
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'user'
    and suly_is_active_user()
    and exists (
      select 1
      from public.suly_conversations c
      where c.id = public.suly_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists suly_messages_owner_scope_update on public.suly_messages;
create policy suly_messages_owner_scope_update
  on public.suly_messages
  as restrictive
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and role = 'user'
    and suly_is_active_user()
    and exists (
      select 1
      from public.suly_conversations c
      where c.id = public.suly_messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and role = 'user'
    and suly_is_active_user()
    and exists (
      select 1
      from public.suly_conversations c
      where c.id = public.suly_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists suly_messages_owner_scope_delete on public.suly_messages;
create policy suly_messages_owner_scope_delete
  on public.suly_messages
  as restrictive
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and suly_is_active_user()
    and exists (
      select 1
      from public.suly_conversations c
      where c.id = public.suly_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

commit;
