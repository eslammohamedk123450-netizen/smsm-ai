begin;

-- Allow an authenticated user to edit only their own user-authored messages.
-- The conversation ownership check prevents cross-account updates even if a
-- caller knows another message id.
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
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and role = 'user'
    and exists (
      select 1
      from public.suly_conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

grant update (content, tokens_used, edited_at) on public.suly_messages to authenticated;

commit;
