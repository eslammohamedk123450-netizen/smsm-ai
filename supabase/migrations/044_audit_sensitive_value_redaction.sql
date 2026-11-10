begin;

-- Keep the existing audit trigger and table contract, but never persist
-- credential-like fields or sensitive system setting values in old_value/new_value.
create or replace function public.suly_capture_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_old jsonb := null;
  v_new jsonb := null;
  v_target text;
  v_action text;
begin
  if v_admin is null or not public.suly_is_admin() then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  if TG_OP <> 'INSERT' then
    v_old := to_jsonb(OLD) - array[
      'api_key','encrypted_api_key','encrypted_key','api_key_vault_id',
      'password','hashed_password','secret','access_token','refresh_token',
      'service_role_key','private_key','token','credentials'
    ];
    if TG_TABLE_NAME = 'system_settings'
       and coalesce((v_old ->> 'is_sensitive')::boolean, false) then
      v_old := v_old - 'value';
    end if;
  end if;

  if TG_OP <> 'DELETE' then
    v_new := to_jsonb(NEW) - array[
      'api_key','encrypted_api_key','encrypted_key','api_key_vault_id',
      'password','hashed_password','secret','access_token','refresh_token',
      'service_role_key','private_key','token','credentials'
    ];
    if TG_TABLE_NAME = 'system_settings'
       and coalesce((v_new ->> 'is_sensitive')::boolean, false) then
      v_new := v_new - 'value';
    end if;
  end if;

  v_target := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id', 'unknown');
  v_action := lower(TG_OP) || ':' || TG_TABLE_NAME;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, old_value, new_value, created_at)
  values (v_admin, v_action, TG_TABLE_NAME, v_target, v_old, v_new, now());

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;

revoke all on function public.suly_capture_admin_change() from public, anon, authenticated;

commit;
