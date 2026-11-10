begin;

-- Keep the original legacy columns while adding the current audit vocabulary
-- used by the operational migrations and admin UI.
alter table public.admin_audit_logs add column if not exists target_table text;
alter table public.admin_audit_logs add column if not exists old_value jsonb;
alter table public.admin_audit_logs add column if not exists new_value jsonb;
alter table public.admin_audit_logs add column if not exists target_type text not null default 'admin_action';
alter table public.admin_audit_logs add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.admin_audit_logs alter column target_id type text using target_id::text;

-- Capture authenticated administrator mutations at the database boundary so
-- changes through the admin app cannot silently bypass the activity ledger.
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
    v_old := to_jsonb(OLD) - array['api_key','encrypted_key','secret','access_token','refresh_token','service_role_key'];
  end if;
  if TG_OP <> 'DELETE' then
    v_new := to_jsonb(NEW) - array['api_key','encrypted_key','secret','access_token','refresh_token','service_role_key'];
  end if;

  v_target := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id', 'unknown');
  v_action := lower(TG_OP) || ':' || TG_TABLE_NAME;

  insert into public.admin_audit_logs(admin_id, action, target_type, target_table, target_id, details, old_value, new_value, created_at)
  values (v_admin, v_action, TG_TABLE_NAME, TG_TABLE_NAME, v_target, jsonb_build_object('operation', TG_OP), v_old, v_new, now());

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;

revoke all on function public.suly_capture_admin_change() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'suly_profiles',
    'ai_models',
    'ai_providers_catalog',
    'agent_registry',
    'subscription_plans',
    'subscription_plan_features',
    'ai_router_settings',
    'suly_credit_pricing',
    'system_settings'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists suly_admin_change_audit on public.%I', v_table);
      execute format('create trigger suly_admin_change_audit after insert or update or delete on public.%I for each row execute function public.suly_capture_admin_change()', v_table);
    end if;
  end loop;
end;
$$;

commit;
