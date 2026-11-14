begin;

-- The authenticated client stores and reads its own conversation messages.
-- Edge Functions use the service role and continue to bypass RLS.
alter table public.suly_messages enable row level security;

drop policy if exists suly_messages_owner_select on public.suly_messages;
create policy suly_messages_owner_select
  on public.suly_messages
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists suly_messages_owner_scope_select on public.suly_messages;
create policy suly_messages_owner_scope_select
  on public.suly_messages
  as restrictive
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists suly_messages_owner_insert on public.suly_messages;
create policy suly_messages_owner_insert
  on public.suly_messages
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'user'
    and exists (
      select 1
      from public.suly_conversations c
      where c.id = public.suly_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists suly_messages_owner_scope_insert on public.suly_messages;
create policy suly_messages_owner_scope_insert
  on public.suly_messages
  as restrictive
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'user'
    and exists (
      select 1
      from public.suly_conversations c
      where c.id = public.suly_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- Allow users to edit only their own user-authored messages. The column grant
-- below prevents changing ownership, conversation, role, or model metadata.
drop policy if exists suly_messages_owner_update on public.suly_messages;
create policy suly_messages_owner_update
  on public.suly_messages
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and role = 'user'
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
    and exists (
      select 1
      from public.suly_conversations c
      where c.id = public.suly_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists suly_messages_owner_delete on public.suly_messages;
create policy suly_messages_owner_delete
  on public.suly_messages
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and role = 'user'
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
    and role = 'user'
    and exists (
      select 1
      from public.suly_conversations c
      where c.id = public.suly_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

grant select, insert, delete on public.suly_messages to authenticated;
grant update (content, tokens_used, edited_at) on public.suly_messages to authenticated;

commit;
