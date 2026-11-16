-- Align the database registration RPC with the media gateway's general-upload policy.
-- Ordinary active users may upload general Library assets; HIMS remains admin-only.
begin;

create or replace function public.suly_media_register_self_v2(
  p_feature_key text,
  p_resource_type text,
  p_object_key text,
  p_mime_type text,
  p_size_bytes bigint,
  p_original_filename text,
  p_metadata jsonb,
  p_conversation_id uuid default null,
  p_message_id uuid default null,
  p_support_ticket_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_user uuid := auth.uid();
  v_feature text := lower(coalesce(nullif(trim(p_feature_key), ''), 'general'));
  v_id uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.suly_is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  if p_resource_type is null or p_resource_type not in ('image','video','raw') or p_object_key is null
    or p_object_key not like ('suly/' || v_user::text || '/%') then
    raise exception 'invalid cloudinary object' using errcode = '22023';
  end if;

  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 524288000 then
    raise exception 'invalid file size' using errcode = '22023';
  end if;

  if p_conversation_id is not null and not exists (
    select 1 from public.suly_conversations c
    where c.id = p_conversation_id and c.user_id = v_user
  ) then
    raise exception 'conversation access denied' using errcode = '42501';
  end if;

  if p_message_id is not null and not exists (
    select 1 from public.suly_messages m
    where m.id = p_message_id and m.user_id = v_user
      and m.role = 'user'
      and (p_conversation_id is null or m.conversation_id = p_conversation_id)
  ) then
    raise exception 'message access denied' using errcode = '42501';
  end if;

  if p_support_ticket_id is not null and not exists (
    select 1 from public.suly_support_tickets t
    where t.id = p_support_ticket_id and t.user_id = v_user
  ) then
    raise exception 'support ticket access denied' using errcode = '42501';
  end if;

  if v_feature = 'chat' and p_conversation_id is null then
    raise exception 'chat files require a conversation' using errcode = '22023';
  end if;

  if v_feature = 'support' and p_support_ticket_id is null then
    raise exception 'support files require a ticket' using errcode = '22023';
  end if;

  -- HIMS resources are administrator-managed. General Library uploads are
  -- allowed to any authenticated, active, non-banned account.
  if v_feature = 'hims' and not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  if v_feature not in ('chat','support','hims','general') then
    raise exception 'unsupported media feature' using errcode = '22023';
  end if;

  if p_support_ticket_id is not null and (p_conversation_id is not null or p_message_id is not null) then
    raise exception 'a file may belong to a ticket or chat, not both' using errcode = '22023';
  end if;

  insert into public.global_media_assets (
    user_id, feature_key, storage_provider, bucket, object_key, public_url,
    mime_type, size_bytes, original_filename, metadata, delivery_type,
    conversation_id, message_id, support_ticket_id
  ) values (
    v_user, v_feature, 'cloudinary', p_resource_type, left(p_object_key, 1024), null,
    left(p_mime_type, 200), p_size_bytes, left(p_original_filename, 300),
    coalesce(p_metadata, '{}'::jsonb), 'authenticated',
    p_conversation_id, p_message_id, p_support_ticket_id
  ) returning id into v_id;

  return v_id;
end;
$function$;

comment on function public.suly_media_register_self_v2(text,text,text,text,bigint,text,jsonb,uuid,uuid,uuid)
  is 'Registers owner-scoped media. General Library uploads require an active user; HIMS resource uploads remain admin-only.';

commit;
