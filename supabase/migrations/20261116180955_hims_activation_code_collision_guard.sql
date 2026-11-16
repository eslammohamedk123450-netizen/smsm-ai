-- Prevent duplicate activation-code creation from reactivating or mutating an old bearer code.
-- Existing code hashes remain immutable identities: administrators must generate a new code.
begin;

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
  if v_feature = '' or v_code = '' or length(v_code) < 12 or length(v_code) > 120 then
    raise exception 'activation code must be at least 12 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suly_feature_flags where feature_key = v_feature) then
    raise exception 'unknown feature key' using errcode = '22023';
  end if;
  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'max_uses must be positive' using errcode = '22023';
  end if;

  insert into public.suly_activation_codes (
    feature_key, code_hash, label, max_uses, expires_at, is_active, created_by
  ) values (
    v_feature,
    encode(digest(v_code, 'sha256'), 'hex'),
    left(p_label, 200),
    p_max_uses,
    p_expires_at,
    true,
    v_admin
  )
  on conflict (code_hash) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'activation code already exists; generate a new code'
      using errcode = '23505';
  end if;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (
    v_admin,
    'activation_code_created',
    'suly_activation_codes',
    v_id::text,
    jsonb_build_object('feature_key', v_feature, 'label', p_label, 'max_uses', p_max_uses, 'expires_at', p_expires_at),
    now()
  );

  -- This is the only response containing the raw bearer code. Never persist it.
  return jsonb_build_object(
    'success', true,
    'id', v_id,
    'feature_key', v_feature,
    'code', v_code,
    'command', '!ACTIVATE_' || v_code
  );
end;
$$;

revoke all on function public.suly_admin_create_activation_code(text, text, text, integer, timestamptz) from public, anon;
grant execute on function public.suly_admin_create_activation_code(text, text, text, integer, timestamptz) to authenticated;

comment on function public.suly_admin_create_activation_code(text, text, text, integer, timestamptz)
  is 'Admin-only. Stores SHA-256 activation-code hashes, returns the raw code once, and rejects duplicate hashes without mutating prior codes.';

commit;
