-- Opt-in public links for a conversation. Private by default; disabling rotates
-- the token out immediately. Anonymous readers receive only title and messages.
begin;

alter table public.suly_conversations
  add column if not exists share_token uuid unique;

create or replace function public.suly_set_conversation_sharing(
  p_conversation_id uuid,
  p_enabled boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_enabled then
    update public.suly_conversations
      set share_token = coalesce(share_token, gen_random_uuid())
      where id = p_conversation_id and user_id = auth.uid()
      returning share_token into v_token;
    if v_token is null then
      raise exception 'conversation not found or access denied' using errcode = '42501';
    end if;
    return v_token;
  end if;

  update public.suly_conversations
    set share_token = null
    where id = p_conversation_id and user_id = auth.uid();
  if not found then
    raise exception 'conversation not found or access denied' using errcode = '42501';
  end if;
  return null;
end;
$$;

revoke all on function public.suly_set_conversation_sharing(uuid, boolean) from public, anon;
grant execute on function public.suly_set_conversation_sharing(uuid, boolean) to authenticated;

create or replace function public.suly_get_public_conversation(p_share_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'title', c.title,
    'messages', coalesce((
      select jsonb_agg(
        jsonb_build_object('role', m.role, 'content', m.content, 'created_at', m.created_at)
        order by m.created_at asc
      )
      from (
        select role, content, created_at
        from public.suly_messages
        where conversation_id = c.id and role in ('user', 'assistant')
        order by created_at asc
        limit 300
      ) m
    ), '[]'::jsonb)
  )
  from public.suly_conversations c
  where c.share_token = p_share_token
  limit 1;
$$;

revoke all on function public.suly_get_public_conversation(uuid) from public;
grant execute on function public.suly_get_public_conversation(uuid) to anon, authenticated;

commit;
