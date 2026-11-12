begin;

-- Private storage for every newly uploaded application asset. Access is issued
-- only by authenticated server functions through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'suly-media',
  'suly-media',
  false,
  104857600,
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif',
    'video/mp4','video/webm','video/quicktime','video/x-m4v',
    'application/pdf','application/json','application/zip','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','text/csv','audio/mpeg','audio/mp4','audio/wav','application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.global_media_assets alter column storage_provider set default 'supabase';

create or replace function public.suly_media_list_self(p_limit integer default 60)
returns table(
  id uuid,
  feature_key text,
  size_bytes bigint,
  original_filename text,
  mime_type text,
  metadata jsonb,
  storage_provider text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  return query
    select a.id,a.feature_key,a.size_bytes,a.original_filename,a.mime_type,a.metadata,a.storage_provider,a.created_at
    from public.global_media_assets a
    where a.user_id = auth.uid()
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit,60),1),200);
end;
$$;
revoke all on function public.suly_media_list_self(integer) from public, anon;
grant execute on function public.suly_media_list_self(integer) to authenticated;

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
    raise exception 'provide one HTTPS URL or one private media asset' using errcode = '22023';
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
      and a.storage_provider in ('supabase','cloudinary') and a.delivery_type = 'authenticated'
  ) then
    raise exception 'private media asset not found for feature' using errcode = '22023';
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
  values(v_admin,'feature_resource_upserted','suly_feature_resources',v_id::text,
    jsonb_build_object('feature_key',v_feature,'media_asset_id',p_media_asset_id,'is_active',p_is_active),now());
  return jsonb_build_object('success',true,'id',v_id,'feature_key',v_feature,'media_asset_id',p_media_asset_id);
end;
$$;
revoke all on function public.suly_admin_upsert_feature_resource_v2(text,text,text,text,text,boolean,uuid) from public, anon;
grant execute on function public.suly_admin_upsert_feature_resource_v2(text,text,text,text,text,boolean,uuid) to authenticated;

commit;
