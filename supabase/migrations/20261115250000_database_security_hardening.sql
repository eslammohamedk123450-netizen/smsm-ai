-- Security hardening for exposed model metadata, provider credentials and Auth triggers.
-- Keep service-only integration tables inaccessible through the public Data API.

begin;

-- Credential/configuration tables are accessed only by server-side Edge Functions
-- and SECURITY DEFINER admin RPCs. RLS with no client policies is intentional.
alter table public.composio_integration_settings enable row level security;
alter table public.cloudinary_integration_settings enable row level security;
alter table public.tavily_integration_settings enable row level security;

revoke all on public.composio_integration_settings,
  public.cloudinary_integration_settings,
  public.tavily_integration_settings
  from public, anon, authenticated;
grant all on public.composio_integration_settings,
  public.cloudinary_integration_settings,
  public.tavily_integration_settings
  to service_role;

-- Model rows are public only as metadata. Anonymous clients may read enabled
-- models, but never receive write privileges. Authenticated writes are admin-only.
drop policy if exists suly_ai_models_admin_all on public.ai_models;
drop policy if exists suly_ai_models_read_enabled on public.ai_models;
drop policy if exists suly_ai_models_select_enabled on public.ai_models;
drop policy if exists suly_ai_models_admin_insert on public.ai_models;
drop policy if exists suly_ai_models_admin_update on public.ai_models;
drop policy if exists suly_ai_models_admin_delete on public.ai_models;

create policy suly_ai_models_select_enabled on public.ai_models
  for select to anon, authenticated
  using (enabled = true or (select public.suly_is_admin()));

create policy suly_ai_models_admin_insert on public.ai_models
  for insert to authenticated
  with check ((select public.suly_is_admin()));

create policy suly_ai_models_admin_update on public.ai_models
  for update to authenticated
  using ((select public.suly_is_admin()))
  with check ((select public.suly_is_admin()));

create policy suly_ai_models_admin_delete on public.ai_models
  for delete to authenticated
  using ((select public.suly_is_admin()));

revoke insert, update, delete, truncate, references, trigger
  on public.ai_models from anon;
revoke truncate, references, trigger on public.ai_models from authenticated;
grant select on public.ai_models to anon, authenticated;
grant insert, update, delete on public.ai_models to authenticated;
grant all on public.ai_models to service_role;

-- Provider rows contain internal configuration and Vault references. All
-- client-facing provider discovery uses the admin-guarded RPC instead.
drop policy if exists "Allow admin to manage providers" on public.ai_providers;
drop policy if exists "Allow read for providers" on public.ai_providers;
drop policy if exists suly_ai_providers_admin_read_safe on public.ai_providers;
drop policy if exists suly_ai_providers_admin_read on public.ai_providers;
create policy suly_ai_providers_admin_read on public.ai_providers
  for select to authenticated using ((select public.suly_is_admin()));

revoke all on public.ai_providers from public, anon, authenticated;
grant select on public.ai_providers to authenticated;
grant all on public.ai_providers to service_role;

-- Keep a single Auth trigger. The older insert-only trigger duplicated the
-- insert performed by the insert/update trigger and caused redundant work.
drop trigger if exists on_auth_user_created_suly_profile on auth.users;

create or replace function public.suly_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance bigint;
  v_full_name text;
  v_avatar_url text;
begin
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    ''
  );
  v_avatar_url := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );

  insert into public.suly_profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, v_full_name, v_avatar_url)
  on conflict (id) do update set
    email = coalesce(excluded.email, public.suly_profiles.email),
    full_name = case
      when excluded.full_name <> '' then excluded.full_name
      else public.suly_profiles.full_name
    end,
    avatar_url = coalesce(excluded.avatar_url, public.suly_profiles.avatar_url),
    updated_at = now();

  -- The account primary key guarantees the welcome credit is issued once.
  insert into public.suly_credit_accounts (user_id, balance)
  values (new.id, 200)
  on conflict (user_id) do nothing
  returning balance into v_balance;

  if found then
    insert into public.suly_credit_transactions (
      user_id, event_type, amount, balance_delta, reserved_delta,
      balance_after, reserved_after, source, reason
    ) values (
      new.id, 'admin_adjust', 200, 200, 0, v_balance, 0,
      'signup_bonus', 'One-time 200-credit welcome bonus for a new account'
    );
  end if;

  return new;
end;
$$;

revoke all on function public.suly_handle_new_auth_user() from public, anon, authenticated;

commit;
