begin;

alter table public.suly_conversations
  add column if not exists is_pinned boolean not null default false,
  add column if not exists archived_at timestamptz null;

create index if not exists suly_conversations_user_pinned_idx
  on public.suly_conversations (user_id, is_pinned desc, updated_at desc)
  where archived_at is null;

create index if not exists suly_conversations_user_archive_idx
  on public.suly_conversations (user_id, archived_at desc, updated_at desc)
  where archived_at is not null;

create or replace function public.suly_set_conversation_pinned(
  p_conversation_id uuid,
  p_pinned boolean
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tier text;
  v_pinned_count integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists (
    select 1 from public.suly_conversations
    where id = p_conversation_id and user_id = v_user
  ) then
    raise exception 'CONVERSATION_NOT_FOUND';
  end if;

  if p_pinned then
    select lower(coalesce(subscription_tier, 'free')) into v_tier
    from public.suly_profiles where id = v_user;

    if coalesce(v_tier, 'free') = 'free' then
      select count(*) into v_pinned_count
      from public.suly_conversations
      where user_id = v_user and is_pinned = true and archived_at is null;
      if v_pinned_count >= 3 and not exists (
        select 1 from public.suly_conversations
        where id = p_conversation_id and user_id = v_user and is_pinned = true
      ) then
        raise exception 'PIN_LIMIT_REACHED';
      end if;
    end if;
  end if;

  update public.suly_conversations
  set is_pinned = p_pinned, updated_at = now()
  where id = p_conversation_id and user_id = v_user;
  return p_pinned;
end;
$$;

grant execute on function public.suly_set_conversation_pinned(uuid, boolean) to authenticated;

commit;
