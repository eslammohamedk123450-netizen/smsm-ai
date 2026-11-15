begin;

-- A profile email is identity data, not user-editable profile metadata.
-- Keep the RPC signature for client compatibility, but derive the stored
-- address only from the verified Supabase JWT claim.
create or replace function public.suly_upsert_my_profile(
  p_email text default null,
  p_full_name text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text := nullif(trim(auth.jwt() ->> 'email'), '');
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_avatar_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.suly_profiles (id, email, full_name, avatar_url)
  values (v_user_id, v_email, coalesce(v_full_name, ''), v_avatar_url)
  on conflict (id) do update set
    email = coalesce(excluded.email, public.suly_profiles.email),
    full_name = case
      when excluded.full_name is not null and excluded.full_name <> ''
      then excluded.full_name
      else public.suly_profiles.full_name
    end,
    avatar_url = coalesce(excluded.avatar_url, public.suly_profiles.avatar_url),
    updated_at = now();
end;
$function$;

revoke all on function public.suly_upsert_my_profile(text, text, text) from public, anon;
grant execute on function public.suly_upsert_my_profile(text, text, text) to authenticated, service_role;

commit;
