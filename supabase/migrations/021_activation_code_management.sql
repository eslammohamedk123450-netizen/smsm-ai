-- Activation-code management for the admin dashboard.
--
-- Two data-only additions, no feature-specific logic in any Edge Function:
--   1. `suly_activation_codes.code_plain` keeps the code the admin generated so
--      it can be re-copied from the dashboard later. The column is never exposed
--      to normal users: the table has RLS enabled with no policies, and the only
--      reader is the admin-guarded `suly_admin_list_activation_codes` RPC.
--   2. `suly_feature_flags.activation_message` lets a feature describe its own
--      success text. The router renders whatever the flag row carries, so
--      activating HIMS says something HIMS-specific without the router knowing
--      that HIMS exists.

alter table public.suly_activation_codes
  add column if not exists code_plain text;

alter table public.suly_feature_flags
  add column if not exists activation_message text;

update public.suly_feature_flags
set activation_message = 'تم تفعيل نظام HIMS. مرحبًا بك في عالمنا، كيف يمكنني مساعدتك؟ أنا هنا لإعطائك ما تحتاجه.'
where feature_key = 'hims';

-- Creation now persists the plaintext alongside the hash and returns it so the
-- dashboard can show the ready-to-send command immediately.
create or replace function public.suly_admin_create_activation_code(
  p_feature_key text,
  p_code text,
  p_label text default null,
  p_max_uses integer default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_admin uuid := auth.uid();
  v_feature text := lower(trim(coalesce(p_feature_key, '')));
  v_code text := upper(trim(coalesce(p_code, '')));
  v_id uuid;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if v_feature = '' or v_code = '' or length(v_code) < 6 or length(v_code) > 120 then
    raise exception 'invalid activation code request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suly_feature_flags where feature_key = v_feature) then
    raise exception 'unknown feature key' using errcode = '22023';
  end if;
  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'max_uses must be positive' using errcode = '22023';
  end if;
  insert into public.suly_activation_codes (
    feature_key, code_hash, code_plain, label, max_uses, expires_at, is_active, created_by
  ) values (
    v_feature,
    encode(digest(v_code, 'sha256'), 'hex'),
    v_code,
    left(p_label, 200),
    p_max_uses,
    p_expires_at,
    true,
    v_admin
  )
  on conflict (code_hash) do update set
    feature_key = excluded.feature_key,
    code_plain = excluded.code_plain,
    label = excluded.label,
    max_uses = excluded.max_uses,
    expires_at = excluded.expires_at,
    is_active = true
  returning id into v_id;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (v_admin, 'activation_code_upserted', 'suly_activation_codes', v_id::text,
    jsonb_build_object('feature_key', v_feature, 'label', p_label, 'max_uses', p_max_uses, 'expires_at', p_expires_at),
    now());
  return jsonb_build_object(
    'success', true,
    'id', v_id,
    'feature_key', v_feature,
    'code', v_code,
    'command', '!ACTIVATE_' || v_code
  );
end;
$$;

-- The listing RPC gains a column, so the previous signature must be dropped:
-- PostgreSQL cannot change a function's return type in place.
drop function if exists public.suly_admin_list_activation_codes(text);

create function public.suly_admin_list_activation_codes(p_feature_key text default null)
returns table (
  id uuid,
  feature_key text,
  label text,
  code_plain text,
  code_fingerprint text,
  max_uses integer,
  used_count integer,
  expires_at timestamptz,
  is_active boolean,
  last_used_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin uuid := auth.uid();
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query
    select
      c.id,
      c.feature_key,
      c.label,
      c.code_plain,
      left(c.code_hash, 12) as code_fingerprint,
      c.max_uses,
      c.used_count,
      c.expires_at,
      c.is_active,
      c.last_used_at,
      c.created_at
    from public.suly_activation_codes as c
    where p_feature_key is null or c.feature_key = lower(trim(p_feature_key))
    order by c.created_at desc
    limit 200;
end;
$$;

revoke all on function public.suly_admin_list_activation_codes(text) from public, anon;
grant execute on function public.suly_admin_list_activation_codes(text) to authenticated;

-- The activation RPC now also returns the feature's own success message so the
-- router never has to hard-code one.
create or replace function public.suly_activate_feature(
  p_user_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_code_hash text;
  v_flag public.suly_feature_flags%rowtype;
  v_code public.suly_activation_codes%rowtype;
  v_existing public.suly_feature_activations%rowtype;
  v_column_exists boolean;
  v_activated_at timestamptz := now();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or length(trim(coalesce(p_code, ''))) = 0 or length(p_code) > 200 then
    return jsonb_build_object('success', false, 'error', 'invalid_code');
  end if;
  v_code_hash := encode(digest(upper(trim(p_code)), 'sha256'), 'hex');
  select * into v_code
  from public.suly_activation_codes
  where code_hash = v_code_hash
  for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'unknown_code');
  end if;
  select * into v_flag
  from public.suly_feature_flags
  where feature_key = v_code.feature_key;
  if not found or not v_flag.is_active then
    return jsonb_build_object('success', false, 'error', 'feature_disabled');
  end if;
  if not v_code.is_active then
    return jsonb_build_object('success', false, 'error', 'code_disabled');
  end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'code_expired');
  end if;
  if v_code.max_uses is not null and v_code.used_count >= v_code.max_uses then
    return jsonb_build_object('success', false, 'error', 'code_exhausted');
  end if;
  if not exists (select 1 from public.suly_profiles where id = p_user_id) then
    return jsonb_build_object('success', false, 'error', 'profile_missing');
  end if;
  select * into v_existing
  from public.suly_feature_activations
  where user_id = p_user_id and feature_key = v_flag.feature_key;
  if found then
    return jsonb_build_object(
      'success', true,
      'already_active', true,
      'feature_key', v_flag.feature_key,
      'label', v_flag.label,
      'activation_message', v_flag.activation_message,
      'activated_at', v_existing.activated_at
    );
  end if;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'suly_profiles'
      and column_name = v_flag.profile_column
  ) into v_column_exists;
  if not v_column_exists then
    raise exception 'feature % maps to a missing profile column', v_flag.feature_key using errcode = '42703';
  end if;
  if v_flag.activated_at_column is not null then
    execute format(
      'update public.suly_profiles set %I = true, %I = coalesce(%I, $2), updated_at = now() where id = $1',
      v_flag.profile_column, v_flag.activated_at_column, v_flag.activated_at_column
    ) using p_user_id, v_activated_at;
  else
    execute format(
      'update public.suly_profiles set %I = true, updated_at = now() where id = $1',
      v_flag.profile_column
    ) using p_user_id;
  end if;
  insert into public.suly_feature_activations (user_id, feature_key, code_id, activated_at)
  values (p_user_id, v_flag.feature_key, v_code.id, v_activated_at)
  on conflict (user_id, feature_key) do nothing;
  update public.suly_activation_codes
  set used_count = used_count + 1, last_used_at = now()
  where id = v_code.id;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (
    null,
    'feature_activated',
    'suly_profiles',
    p_user_id::text,
    jsonb_build_object('feature_key', v_flag.feature_key, 'code_id', v_code.id),
    now()
  );
  return jsonb_build_object(
    'success', true,
    'already_active', false,
    'feature_key', v_flag.feature_key,
    'label', v_flag.label,
    'activation_message', v_flag.activation_message,
    'activated_at', v_activated_at
  );
end;
$$;

revoke all on function public.suly_activate_feature(uuid, text) from public, anon, authenticated;
