-- Tighten direct client writes so message roles and feedback/rating ownership cannot be widened by permissive policy ORs.
begin;

-- Remove older overlapping policies that were broader than the current owner-scope policies.
drop policy if exists suly_messages_insert_owner_conversation on public.suly_messages;
drop policy if exists suly_messages_delete_owner on public.suly_messages;
drop policy if exists suly_messages_select_owner on public.suly_messages;
drop policy if exists suly_messages_owner_update on public.suly_messages;

-- Recreate the remaining owner policies with a consistent user + active-account + conversation boundary.
drop policy if exists suly_messages_owner_scope_insert on public.suly_messages;
create policy suly_messages_owner_scope_insert
  on public.suly_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'user'
    and public.suly_is_active_user()
    and exists (
      select 1 from public.suly_conversations c
      where c.id = suly_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists suly_messages_owner_scope_select on public.suly_messages;
create policy suly_messages_owner_scope_select
  on public.suly_messages
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and public.suly_is_active_user()
    and exists (
      select 1 from public.suly_conversations c
      where c.id = suly_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists suly_messages_owner_scope_update on public.suly_messages;
create policy suly_messages_owner_scope_update
  on public.suly_messages
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and role = 'user'
    and public.suly_is_active_user()
    and exists (
      select 1 from public.suly_conversations c
      where c.id = suly_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and role = 'user'
    and public.suly_is_active_user()
    and exists (
      select 1 from public.suly_conversations c
      where c.id = suly_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists suly_messages_owner_scope_delete on public.suly_messages;
create policy suly_messages_owner_scope_delete
  on public.suly_messages
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and public.suly_is_active_user()
    and exists (
      select 1 from public.suly_conversations c
      where c.id = suly_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

-- Feedback can only refer to an assistant message in a conversation owned by the same active user.
drop policy if exists suly_message_feedback_owner_insert on public.suly_message_feedback;
create policy suly_message_feedback_owner_insert
  on public.suly_message_feedback
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.suly_is_active_user()
    and exists (
      select 1
      from public.suly_messages m
      join public.suly_conversations c on c.id = m.conversation_id
      where m.id = suly_message_feedback.message_id
        and m.user_id = (select auth.uid())
        and m.role = 'assistant'
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists suly_message_feedback_owner_delete on public.suly_message_feedback;
create policy suly_message_feedback_owner_delete
  on public.suly_message_feedback
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and public.suly_is_active_user()
    and exists (
      select 1
      from public.suly_messages m
      join public.suly_conversations c on c.id = m.conversation_id
      where m.id = suly_message_feedback.message_id
        and m.user_id = (select auth.uid())
        and m.role = 'assistant'
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists suly_message_feedback_owner_update on public.suly_message_feedback;
create policy suly_message_feedback_owner_update
  on public.suly_message_feedback
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and public.suly_is_active_user()
    and exists (
      select 1
      from public.suly_messages m
      join public.suly_conversations c on c.id = m.conversation_id
      where m.id = suly_message_feedback.message_id
        and m.user_id = (select auth.uid())
        and m.role = 'assistant'
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and public.suly_is_active_user()
    and exists (
      select 1
      from public.suly_messages m
      join public.suly_conversations c on c.id = m.conversation_id
      where m.id = suly_message_feedback.message_id
        and m.user_id = (select auth.uid())
        and m.role = 'assistant'
        and c.user_id = (select auth.uid())
    )
  );

-- Ratings cannot be moved to another user's conversation after creation.
drop policy if exists suly_task_ratings_owner_write on public.suly_task_ratings;
create policy suly_task_ratings_owner_write
  on public.suly_task_ratings
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.suly_is_active_user()
    and exists (
      select 1 from public.suly_conversations c
      where c.id = suly_task_ratings.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists suly_task_ratings_owner_update on public.suly_task_ratings;
create policy suly_task_ratings_owner_update
  on public.suly_task_ratings
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and public.suly_is_active_user()
    and exists (
      select 1 from public.suly_conversations c
      where c.id = suly_task_ratings.conversation_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and public.suly_is_active_user()
    and exists (
      select 1 from public.suly_conversations c
      where c.id = suly_task_ratings.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

commit;
