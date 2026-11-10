begin;

create table if not exists public.suly_image_generation_settings (
  id boolean primary key default true check (id is true),
  account_id text not null default '',
  token_vault_id uuid,
  enabled boolean not null default false,
  credits_per_image bigint not null default 1 check (credits_per_image between 1 and 1000000000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.suly_image_generation_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.suly_image_generation_settings enable row level security;
revoke all on table public.suly_image_generation_settings from public, anon, authenticated;
grant all on table public.suly_image_generation_settings to service_role;

create or replace function public.suly_admin_get_cloudflare_image_config()
returns table (
  account_id text,
  token_configured boolean,
  enabled boolean,
  credits_per_image bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  select s.account_id, s.token_vault_id is not null, s.enabled, s.credits_per_image
  from public.suly_image_generation_settings s
  where s.id is true;
end;
$function$;

revoke all on function public.suly_admin_get_cloudflare_image_config() from public, anon;
grant execute on function public.suly_admin_get_cloudflare_image_config() to authenticated;

create or replace function public.suly_admin_save_cloudflare_image_config(
  p_account_id text,
  p_api_token text default null,
  p_enabled boolean default false,
  p_credits_per_image bigint default 1
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, vault
as $function$
declare
  v_user_id uuid := auth.uid();
  v_account_id text := lower(btrim(coalesce(p_account_id, '')));
  v_token text := nullif(btrim(coalesce(p_api_token, '')), '');
  v_vault_id uuid;
begin
  if v_user_id is null or not public.suly_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if v_account_id !~ '^[0-9a-f]{32}$' then
    raise exception 'Invalid Cloudflare account ID' using errcode = '22023';
  end if;
  if p_credits_per_image is null or p_credits_per_image < 1 or p_credits_per_image > 1000000000 then
    raise exception 'Invalid image credit cost' using errcode = '22023';
  end if;
  if v_token is not null and char_length(v_token) not between 20 and 4096 then
    raise exception 'Invalid Cloudflare API token' using errcode = '22023';
  end if;

  select s.token_vault_id into v_vault_id
  from public.suly_image_generation_settings s
  where s.id is true
  for update;

  if v_token is not null then
    if v_vault_id is null then
      v_vault_id := vault.create_secret(
        v_token,
        'suly-cloudflare-image-api-token',
        'Cloudflare Workers AI image generation token; server-side only'
      );
    else
      perform vault.update_secret(
        v_vault_id,
        v_token,
        'suly-cloudflare-image-api-token',
        'Cloudflare Workers AI image generation token; server-side only',
        null
      );
    end if;
  end if;

  if p_enabled is true and v_vault_id is null then
    raise exception 'Cloudflare API token must be configured before enabling image generation' using errcode = '22023';
  end if;

  update public.suly_image_generation_settings
  set account_id = v_account_id,
      token_vault_id = v_vault_id,
      enabled = coalesce(p_enabled, false),
      credits_per_image = p_credits_per_image,
      updated_by = v_user_id,
      updated_at = now()
  where id is true;

  return jsonb_build_object(
    'success', true,
    'account_id', v_account_id,
    'token_configured', v_vault_id is not null,
    'enabled', coalesce(p_enabled, false),
    'credits_per_image', p_credits_per_image
  );
end;
$function$;

revoke all on function public.suly_admin_save_cloudflare_image_config(text, text, boolean, bigint) from public, anon;
grant execute on function public.suly_admin_save_cloudflare_image_config(text, text, boolean, bigint) to authenticated;

create or replace function public.suly_service_get_cloudflare_image_config()
returns table (
  account_id text,
  api_token text,
  enabled boolean,
  credits_per_image bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, vault
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  return query
  select s.account_id, d.decrypted_secret, s.enabled, s.credits_per_image
  from public.suly_image_generation_settings s
  left join vault.decrypted_secrets d on d.id = s.token_vault_id
  where s.id is true;
end;
$function$;

revoke all on function public.suly_service_get_cloudflare_image_config() from public, anon, authenticated;
grant execute on function public.suly_service_get_cloudflare_image_config() to service_role;

commit;
