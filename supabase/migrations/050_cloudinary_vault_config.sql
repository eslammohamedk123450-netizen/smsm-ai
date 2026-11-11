begin;

create table if not exists public.cloudinary_integration_settings (
  id boolean primary key default true check (id is true),
  credential_vault_id uuid,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.cloudinary_integration_settings is
  'Cloudinary configuration metadata. The connection URL is stored only in Supabase Vault.';

create or replace function public.suly_admin_cloudinary_status()
returns table (configured boolean, updated_at timestamptz)
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  return query
    select s.credential_vault_id is not null, s.updated_at
    from public.cloudinary_integration_settings s where s.id is true;
  if not found then return query select false, null::timestamptz; end if;
end;
$function$;

create or replace function public.suly_admin_set_cloudinary_url(p_cloudinary_url text)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, auth, vault
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_url text := btrim(coalesce(p_cloudinary_url, ''));
  v_vault_id uuid;
begin
  if v_admin_id is null or not public.suly_is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if char_length(v_url) > 2048 or v_url !~ '^cloudinary://[^:/@]+:[^/@]+@[A-Za-z0-9_-]+/?$' then
    raise exception 'invalid Cloudinary connection URL' using errcode = '22023';
  end if;

  insert into public.cloudinary_integration_settings (id) values (true) on conflict (id) do nothing;
  select credential_vault_id into v_vault_id
  from public.cloudinary_integration_settings where id is true for update;

  if v_vault_id is null then
    v_vault_id := vault.create_secret(v_url, 'suly-cloudinary-url', 'Cloudinary server credential URL; server-side only');
  else
    perform vault.update_secret(v_vault_id, v_url, 'suly-cloudinary-url', 'Cloudinary server credential URL; server-side only', null);
  end if;

  insert into public.cloudinary_integration_settings (id, credential_vault_id, updated_by, updated_at)
  values (true, v_vault_id, v_admin_id, now())
  on conflict (id) do update set credential_vault_id = excluded.credential_vault_id,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end;
$function$;

create or replace function public.suly_service_get_cloudinary_url()
returns text
language plpgsql stable security definer
set search_path = pg_catalog, public, vault
as $function$
declare
  v_vault_id uuid;
  v_secret text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select credential_vault_id into v_vault_id from public.cloudinary_integration_settings where id is true;
  if v_vault_id is null then return null; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_vault_id;
  return v_secret;
end;
$function$;

revoke all on table public.cloudinary_integration_settings from public, anon, authenticated;
revoke all on function public.suly_admin_cloudinary_status() from public, anon;
revoke all on function public.suly_admin_set_cloudinary_url(text) from public, anon;
revoke all on function public.suly_service_get_cloudinary_url() from public, anon, authenticated;
grant execute on function public.suly_admin_cloudinary_status() to authenticated;
grant execute on function public.suly_admin_set_cloudinary_url(text) to authenticated;
grant execute on function public.suly_service_get_cloudinary_url() to service_role;

commit;
