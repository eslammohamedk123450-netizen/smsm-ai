-- Migration 013: Update an existing provider by its unique name instead of
-- failing with ix_ai_providers_name when an admin re-adds the same provider.
-- The API key remains in Supabase Vault; only its Vault UUID is stored in
-- public.ai_providers. Existing Vault secrets are updated in place.

begin;

create or replace function public.suly_admin_add_provider(
  p_user_id uuid,
  p_name text,
  p_provider_type text,
  p_base_url text,
  p_description text,
  p_api_key text
)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'vault'
as $function$
declare
  v_provider_id integer;
  v_vault_id uuid;
  v_old_vault_id uuid;
begin
  if p_user_id is null or not exists (
    select 1
    from public.suly_admins a
    join public.suly_profiles pr on pr.id = a.user_id
    where a.user_id = p_user_id and pr.is_banned = false
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 120
     or p_provider_type is null or char_length(btrim(p_provider_type)) not between 1 and 60
     or p_base_url is null or p_base_url !~* '^https://[^[:space:]]+$'
     or p_api_key is null or char_length(p_api_key) not between 1 and 16384
     or char_length(coalesce(p_description, '')) > 2000 then
    raise exception 'Invalid provider fields' using errcode = '22023';
  end if;

  -- Serialize concurrent submissions for the same provider name.
  perform pg_advisory_xact_lock(
    hashtextextended('suly-provider:' || lower(btrim(p_name)), 0)
  );

  select id, api_key_vault_id
    into v_provider_id, v_old_vault_id
  from public.ai_providers
  where name = btrim(p_name)
  for update;

  if v_provider_id is null then
    insert into public.ai_providers
      (name, provider_type, base_url, enabled, priority, timeout_seconds, description)
    values
      (btrim(p_name), lower(btrim(p_provider_type)), rtrim(btrim(p_base_url), '/'), true, 1, 30, nullif(btrim(p_description), ''))
    returning id into v_provider_id;
  end if;

  if v_old_vault_id is not null then
    perform vault.update_secret(v_old_vault_id, p_api_key, null, null, null);
    v_vault_id := v_old_vault_id;
  else
    v_vault_id := vault.create_secret(
      p_api_key,
      'suly-provider-' || v_provider_id::text,
      'Provider API credential; never expose to browser clients'
    );
  end if;

  update public.ai_providers
  set name = btrim(p_name),
      provider_type = lower(btrim(p_provider_type)),
      base_url = rtrim(btrim(p_base_url), '/'),
      description = nullif(btrim(p_description), ''),
      enabled = true,
      api_key_vault_id = v_vault_id,
      updated_at = now()
  where id = v_provider_id;

  return v_provider_id;
end;
$function$;

revoke all on function public.suly_admin_add_provider(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.suly_admin_add_provider(uuid, text, text, text, text, text)
  to service_role;

commit;
