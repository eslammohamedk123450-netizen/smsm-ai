-- Defense-in-depth for profile entitlements, legacy media registration, and admin model-health reset.
-- Client profile changes must go through narrowly scoped SECURITY DEFINER RPCs.
revoke insert, update, delete, truncate, references, trigger
  on table public.suly_profiles from public, anon, authenticated;

-- The v2 media gateway is the supported upload-registration path. The legacy
-- self-registration RPC accepted arbitrary feature_key values and has no
-- current application call sites; remove its client execution surface.
revoke all on function public.suly_media_register_self(text, text, text, text, text, text, bigint, text, jsonb)
  from public, anon, authenticated;

-- A health reset must not override an administrator's independent disabled state.
create or replace function public.suly_admin_reset_model_health(p_model_id integer)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_model_enabled boolean;
begin
  if not public.suly_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select m.enabled into v_model_enabled
  from public.ai_models m
  where m.id = p_model_id
  for update;

  if not found then
    raise exception 'Model not found' using errcode = 'P0002';
  end if;

  insert into public.ai_model_health (model_id)
  values (p_model_id)
  on conflict (model_id) do update set
    consecutive_failures = 0,
    failure_window_started_at = null,
    auto_restricted = false,
    restriction_reason = null,
    restricted_at = null,
    last_status = 'unknown',
    updated_at = now();

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (
    auth.uid(),
    'model_health_reset',
    'ai_model_health',
    p_model_id::text,
    jsonb_build_object('model_enabled_preserved', v_model_enabled),
    now()
  );

  return jsonb_build_object(
    'success', true,
    'model_id', p_model_id,
    'health_reset', true,
    'enabled', v_model_enabled
  );
end;
$function$;

-- Keep the legacy admin RPC compatible, but route it through the full provider
-- lifecycle guard instead of the older partial toggle implementation.
create or replace function public.suly_admin_set_provider_enabled(p_provider_id integer, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
begin
  perform public.suly_admin_set_provider_lifecycle(p_provider_id, coalesce(p_enabled, false), true);
end;
$function$;
