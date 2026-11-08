-- Migration 030: deleting a provider must not leave its admin row behind when
-- Vault cleanup is unavailable or an old Vault secret is already missing.
-- The provider and its models are the user-visible credential records; Vault
-- cleanup is attempted first and isolated so one stale secret cannot block it.
begin;

create or replace function public.suly_admin_delete_provider(p_provider_id integer)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'vault'
as $$
declare
  v_vault_id uuid;
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  select api_key_vault_id
    into v_vault_id
  from public.ai_providers
  where id = p_provider_id
  for update;

  if not found then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;

  -- A stale/missing Vault secret must not prevent deletion of the provider.
  -- Keep this cleanup isolated so the following DELETE can still commit.
  if v_vault_id is not null then
    begin
      perform vault.delete_secret(v_vault_id);
    exception when others then
      raise notice 'Could not remove Vault secret % while deleting provider %: %', v_vault_id, p_provider_id, sqlerrm;
    end;
  end if;

  -- ai_models are linked to a provider with the live schema's cascade rule;
  -- explicitly removing them also handles installations created before that
  -- rule was added and lets dependent health/probe rows clean up safely.
  delete from public.ai_models where provider_id = p_provider_id;
  delete from public.ai_providers where id = p_provider_id;

  if not found then
    raise exception 'provider delete did not affect a row' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function public.suly_admin_delete_provider(integer) from public, anon;
grant execute on function public.suly_admin_delete_provider(integer) to authenticated;

commit;
