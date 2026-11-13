begin;

create table if not exists public.tavily_integration_settings (
  id boolean primary key default true check (id = true),
  api_key_vault_id uuid,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.tavily_integration_settings is
  'Tavily configuration metadata. The API key is stored only in Supabase Vault.';

create or replace function public.suly_admin_set_tavily_api_key(p_api_key text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, vault
as $$
declare
  v_vault_id uuid;
  v_admin_id uuid := auth.uid();
  v_key text := btrim(coalesce(p_api_key, ''));
begin
  if v_admin_id is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if char_length(v_key) < 1 or char_length(v_key) > 16384 or v_key !~ '^tvly' then
    raise exception 'invalid Tavily API key' using errcode = '22023';
  end if;

  select api_key_vault_id into v_vault_id
  from public.tavily_integration_settings
  where id = true
  for update;

  if v_vault_id is null then
    v_vault_id := vault.create_secret(v_key, 'suly-tavily-api-key', 'Tavily API credential; never expose to browser clients');
  else
    perform vault.update_secret(v_vault_id, v_key, null, null, null);
  end if;

  insert into public.tavily_integration_settings (id, api_key_vault_id, updated_by, updated_at)
  values (true, v_vault_id, v_admin_id, now())
  on conflict (id) do update set api_key_vault_id = excluded.api_key_vault_id, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.suly_admin_tavily_status()
returns table (configured boolean, updated_at timestamptz)
language plpgsql stable security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query select (s.api_key_vault_id is not null), s.updated_at from public.tavily_integration_settings s where s.id = true;
  if not found then return query select false, null::timestamptz; end if;
end;
$$;

create or replace function public.suly_service_get_tavily_api_key()
returns text
language plpgsql security definer stable
set search_path = pg_catalog, public, auth, vault
as $$
declare
  v_vault_id uuid;
  v_api_key text;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  select api_key_vault_id into v_vault_id from public.tavily_integration_settings where id = true;
  if v_vault_id is null then return null; end if;
  select decrypted_secret into v_api_key from vault.decrypted_secrets where id = v_vault_id;
  return v_api_key;
end;
$$;

revoke all on table public.tavily_integration_settings from public, anon, authenticated;
revoke all on function public.suly_admin_set_tavily_api_key(text) from public, anon;
revoke all on function public.suly_admin_tavily_status() from public, anon;
revoke all on function public.suly_service_get_tavily_api_key() from public, anon, authenticated;
grant execute on function public.suly_admin_set_tavily_api_key(text) to authenticated;
grant execute on function public.suly_admin_tavily_status() to authenticated;
grant execute on function public.suly_service_get_tavily_api_key() to service_role;

commit;
