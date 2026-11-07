-- Re-activation through a valid one-time code must record the current activation time.
-- The live function already validates the code, checks feature availability, and updates
-- the configured profile flag; this keeps that security model and removes stale timestamps.
create or replace function public.suly_activate_feature(p_user_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
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
  select * into v_code from public.suly_activation_codes where code_hash = v_code_hash for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'unknown_code');
  end if;
  select * into v_flag from public.suly_feature_flags where feature_key = v_code.feature_key;
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
  select * into v_existing from public.suly_feature_activations where user_id = p_user_id and feature_key = v_flag.feature_key;
  if found then
    return jsonb_build_object('success', true, 'already_active', true, 'feature_key', v_flag.feature_key, 'label', v_flag.label, 'activated_at', v_existing.activated_at);
  end if;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'suly_profiles' and column_name = v_flag.profile_column
  ) into v_column_exists;
  if not v_column_exists then
    raise exception 'feature % maps to a missing profile column', v_flag.feature_key using errcode = '42703';
  end if;
  if v_flag.activated_at_column is not null then
    execute format('update public.suly_profiles set %I = true, %I = $2, updated_at = now() where id = $1',
      v_flag.profile_column, v_flag.activated_at_column) using p_user_id, v_activated_at;
  else
    execute format('update public.suly_profiles set %I = true, updated_at = now() where id = $1', v_flag.profile_column) using p_user_id;
  end if;
  insert into public.suly_feature_activations (user_id, feature_key, code_id, activated_at)
  values (p_user_id, v_flag.feature_key, v_code.id, v_activated_at)
  on conflict (user_id, feature_key) do nothing;
  update public.suly_activation_codes set used_count = used_count + 1, last_used_at = now() where id = v_code.id;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (null, 'feature_activated', 'suly_profiles', p_user_id::text,
    jsonb_build_object('feature_key', v_flag.feature_key, 'code_id', v_code.id), now());
  return jsonb_build_object('success', true, 'already_active', false, 'feature_key', v_flag.feature_key, 'label', v_flag.label, 'activated_at', v_activated_at);
end;
$function$;
