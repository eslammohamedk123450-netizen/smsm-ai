begin;

create or replace function public.suly_get_conversation_share_status(p_conversation_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select share_token into v_token
    from public.suly_conversations
    where id = p_conversation_id and user_id = auth.uid();
  if not found then
    raise exception 'conversation not found or access denied' using errcode = '42501';
  end if;
  return v_token;
end;
$$;

revoke all on function public.suly_get_conversation_share_status(uuid) from public, anon;
grant execute on function public.suly_get_conversation_share_status(uuid) to authenticated;

commit;
