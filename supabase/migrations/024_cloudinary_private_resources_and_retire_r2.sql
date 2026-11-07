-- Extend Cloudinary metadata to HIMS resources and permanently retire the old client/R2 registration RPCs.
begin;

alter table public.suly_feature_resources alter column url drop not null;
alter table public.suly_feature_resources add column if not exists media_asset_id uuid
  references public.global_media_assets(id) on delete set null;
create unique index if not exists suly_feature_resources_media_asset_uidx
  on public.suly_feature_resources (feature_key, media_asset_id) where media_asset_id is not null;

create or replace function public.suly_admin_upsert_feature_resource_v2(
  p_feature_key text,
  p_title text,
  p_url text,
  p_kind text,
  p_description text,
  p_is_active boolean,
  p_media_asset_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_admin uuid := auth.uid();
  v_feature text := lower(trim(coalesce(p_feature_key, '')));
  v_url text := nullif(trim(coalesce(p_url, '')), '');
  v_id uuid;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if v_feature = '' or length(trim(coalesce(p_title, ''))) = 0 or p_is_active is null then
    raise exception 'invalid resource request' using errcode = '22023';
  end if;
  if (p_media_asset_id is null and (v_url is null or v_url !~* '^https://'))
     or (p_media_asset_id is not null and v_url is not null) then
    raise exception 'provide one HTTPS URL or one Cloudinary asset' using errcode = '22023';
  end if;
  if v_url is not null and length(v_url) > 2048 then
    raise exception 'resource URL is too long' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suly_feature_flags where feature_key = v_feature) then
    raise exception 'unknown feature key' using errcode = '22023';
  end if;
  if p_media_asset_id is not null and not exists (
    select 1 from public.global_media_assets a
    where a.id = p_media_asset_id and a.feature_key = v_feature
      and a.storage_provider = 'cloudinary' and a.delivery_type = 'authenticated'
  ) then
    raise exception 'private Cloudinary asset not found for feature' using errcode = '22023';
  end if;
  if p_media_asset_id is not null then
    insert into public.suly_feature_resources (feature_key,title,url,media_asset_id,kind,description,is_active)
    values (v_feature,left(trim(p_title),300),null,p_media_asset_id,coalesce(nullif(trim(p_kind),''),'file'),left(p_description,1000),p_is_active)
    on conflict (feature_key,media_asset_id) where media_asset_id is not null do update set
      title = excluded.title, kind = excluded.kind, description = excluded.description, is_active = excluded.is_active
    returning id into v_id;
  else
    insert into public.suly_feature_resources (feature_key,title,url,media_asset_id,kind,description,is_active)
    values (v_feature,left(trim(p_title),300),v_url,null,coalesce(nullif(trim(p_kind),''),'link'),left(p_description,1000),p_is_active)
    on conflict (feature_key,url) do update set
      title = excluded.title, kind = excluded.kind, description = excluded.description, is_active = excluded.is_active
    returning id into v_id;
  end if;
  insert into public.admin_audit_logs(admin_id,action,target_table,target_id,new_value,created_at)
  values (v_admin,'feature_resource_upserted','suly_feature_resources',v_id::text,
    jsonb_build_object('feature_key',v_feature,'media_asset_id',p_media_asset_id,'is_active',p_is_active),now());
  return jsonb_build_object('success',true,'id',v_id,'feature_key',v_feature,'media_asset_id',p_media_asset_id);
end;
$$;
revoke all on function public.suly_admin_upsert_feature_resource_v2(text,text,text,text,text,boolean,uuid) from public, anon;
grant execute on function public.suly_admin_upsert_feature_resource_v2(text,text,text,text,text,boolean,uuid) to authenticated;

create or replace function public.suly_admin_list_feature_resources_v2(p_feature_key text default 'hims')
returns table(id uuid,feature_key text,title text,url text,media_asset_id uuid,kind text,description text,is_active boolean,created_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then raise exception 'administrator privileges required' using errcode = '42501'; end if;
  return query select r.id,r.feature_key,r.title,r.url,r.media_asset_id,r.kind,r.description,r.is_active,r.created_at
    from public.suly_feature_resources r
    where r.feature_key = lower(trim(coalesce(p_feature_key,'hims')))
    order by r.created_at desc limit 200;
end;
$$;
revoke all on function public.suly_admin_list_feature_resources_v2(text) from public, anon;
grant execute on function public.suly_admin_list_feature_resources_v2(text) to authenticated;

create or replace function public.suly_media_attach_to_message(p_media_id uuid,p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_conversation uuid;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select m.conversation_id into v_conversation from public.suly_messages m
    where m.id = p_message_id and m.user_id = v_user and m.role = 'user';
  if v_conversation is null then raise exception 'user message not found' using errcode = '42501'; end if;
  update public.global_media_assets a set message_id = p_message_id
    where a.id = p_media_id and a.user_id = v_user and a.feature_key = 'chat'
      and a.conversation_id = v_conversation and a.support_ticket_id is null;
  if not found then raise exception 'chat attachment not found for this conversation' using errcode = '42501'; end if;
  return true;
end;
$$;
revoke all on function public.suly_media_attach_to_message(uuid,uuid) from public, anon;
grant execute on function public.suly_media_attach_to_message(uuid,uuid) to authenticated;

create or replace function public.suly_support_touch_ticket_on_reply()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.suly_support_tickets set updated_at = new.created_at where id = new.ticket_id;
  return new;
end;
$$;
revoke all on function public.suly_support_touch_ticket_on_reply() from public, anon, authenticated;
drop trigger if exists suly_support_reply_touch_ticket on public.suly_support_replies;
create trigger suly_support_reply_touch_ticket after insert on public.suly_support_replies
  for each row execute function public.suly_support_touch_ticket_on_reply();

-- The legacy service-role RPC no longer accepts R2 registrations.
create or replace function public.suly_media_register(
  p_user_id uuid,p_feature_key text,p_storage_provider text,p_bucket text,p_object_key text,p_public_url text,
  p_mime_type text default null,p_size_bytes bigint default 0,p_checksum_sha256 text default null,
  p_original_filename text default null,p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if lower(coalesce(p_storage_provider,'')) <> 'cloudinary' then raise exception 'R2 storage has been retired; use signed Cloudinary uploads' using errcode = '22023'; end if;
  if p_user_id is null or p_object_key is null or p_bucket is null or p_public_url is null
     or length(trim(p_object_key)) = 0 or p_public_url !~* '^https://' then
    raise exception 'invalid media asset' using errcode = '22023';
  end if;
  insert into public.global_media_assets(user_id,feature_key,storage_provider,bucket,object_key,public_url,mime_type,size_bytes,checksum_sha256,original_filename,metadata)
  values(p_user_id,coalesce(nullif(trim(p_feature_key),''),'general'),'cloudinary',p_bucket,left(p_object_key,1024),left(p_public_url,2048),left(p_mime_type,200),greatest(coalesce(p_size_bytes,0),0),left(p_checksum_sha256,128),left(p_original_filename,300),coalesce(p_metadata,'{}'::jsonb))
  on conflict(storage_provider,bucket,object_key) do update set public_url=excluded.public_url,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,metadata=excluded.metadata
  where public.global_media_assets.user_id=p_user_id returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.suly_media_register(uuid,text,text,text,text,text,text,bigint,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.suly_media_register(uuid,text,text,text,text,text,text,bigint,text,text,jsonb) to service_role;

-- Old mobile builds may not call the removed unsigned/R2 registration function.
revoke all on function public.suly_media_register_self(text,text,text,text,text,text,bigint,text,jsonb) from public, anon, authenticated;

commit;
