-- Admin lifecycle controls for provider credentials and their model catalog.
begin;

create or replace function public.suly_admin_set_provider_enabled(p_provider_id integer, p_enabled boolean)
returns void
language plpgsql security definer set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then raise exception 'administrator privileges required' using errcode = '42501'; end if;
  update public.ai_providers set enabled = coalesce(p_enabled, false), updated_at = now() where id = p_provider_id;
  if not found then raise exception 'provider not found' using errcode = 'P0002'; end if;
  update public.ai_models set enabled = coalesce(p_enabled, false) where provider_id = p_provider_id;
end;
$$;

create or replace function public.suly_admin_delete_provider(p_provider_id integer)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public, auth, vault
as $$
declare v_vault_id uuid;
begin
  if not public.suly_is_admin() then raise exception 'administrator privileges required' using errcode = '42501'; end if;
  select api_key_vault_id into v_vault_id from public.ai_providers where id = p_provider_id for update;
  if not found then raise exception 'provider not found' using errcode = 'P0002'; end if;
  if v_vault_id is not null then perform vault.delete_secret(v_vault_id); end if;
  delete from public.ai_providers where id = p_provider_id;
  return true;
end;
$$;

revoke all on function public.suly_admin_set_provider_enabled(integer, boolean) from public, anon;
revoke all on function public.suly_admin_delete_provider(integer) from public, anon;
grant execute on function public.suly_admin_set_provider_enabled(integer, boolean) to authenticated;
grant execute on function public.suly_admin_delete_provider(integer) to authenticated;

commit;
