begin;

alter table public.suly_profiles
  add column if not exists avatar_url text;

create or replace function public.suly_upsert_my_profile(
  p_email text default null,
  p_full_name text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := coalesce(nullif(trim(p_email), ''), nullif(trim(auth.jwt() ->> 'email'), ''));
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_avatar_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.suly_profiles (id, email, full_name, avatar_url)
  values (
    v_user_id,
    v_email,
    coalesce(v_full_name, ''),
    v_avatar_url
  )
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
$$;

revoke all on function public.suly_upsert_my_profile(text, text, text) from public, anon;
grant execute on function public.suly_upsert_my_profile(text, text, text) to authenticated;

create or replace function public.suly_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.suly_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_suly_profile on auth.users;
create trigger on_auth_user_created_suly_profile
after insert on auth.users
for each row execute procedure public.suly_handle_new_auth_user();

commit;
