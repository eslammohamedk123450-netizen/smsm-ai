-- HIMS activation codes are bearer credentials: retain only SHA-256 hashes at rest.
-- The raw code is returned to the admin exactly once by the creation RPC.
begin;

alter table public.suly_activation_codes
  drop column if exists code_plain;

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
  on conflict (code_hash) do update set
    feature_key = excluded.feature_key,
    label = excluded.label,
    max_uses = excluded.max_uses,
    expires_at = excluded.expires_at,
    is_active = true
  returning id into v_id;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (
    v_admin,
    'activation_code_upserted',
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
      null::text as code_plain,
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

revoke all on function public.suly_admin_create_activation_code(text, text, text, integer, timestamptz) from public, anon;
grant execute on function public.suly_admin_create_activation_code(text, text, text, integer, timestamptz) to authenticated;
revoke all on function public.suly_admin_list_activation_codes(text) from public, anon;
grant execute on function public.suly_admin_list_activation_codes(text) to authenticated;

comment on function public.suly_admin_create_activation_code(text, text, text, integer, timestamptz)
  is 'Admin-only. Stores SHA-256 activation-code hashes; returns the raw code once at creation and never persists it.';
comment on function public.suly_admin_list_activation_codes(text)
  is 'Admin-only. Returns code fingerprint and metadata; code_plain is always NULL for backward compatibility.';

commit;
