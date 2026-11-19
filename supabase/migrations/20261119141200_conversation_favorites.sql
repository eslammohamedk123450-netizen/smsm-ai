-- Independent conversation favorites (not the same as pinning).
begin;
alter table public.suly_conversations
  add column if not exists is_favorite boolean not null default false;
create index if not exists suly_conversations_user_favorites_idx
  on public.suly_conversations (user_id, updated_at desc)
  where is_favorite = true and archived_at is null;

create or replace function public.suly_set_conversation_favorite(
  p_conversation_id uuid,
  p_favorite boolean
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.suly_conversations
    set is_favorite = p_favorite, updated_at = now()
    where id = p_conversation_id and user_id = v_user;
  if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;
  return p_favorite;
end;
$$;
grant execute on function public.suly_set_conversation_favorite(uuid, boolean) to authenticated;
commit;
