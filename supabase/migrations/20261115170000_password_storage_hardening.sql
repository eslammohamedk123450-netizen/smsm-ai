-- Retire legacy password storage in public.users.
-- The active Expo client authenticates exclusively through Supabase Auth.
-- The legacy row is preserved, but its old credential is invalidated without exposing it.

update public.users
set hashed_password = extensions.crypt(
  gen_random_uuid()::text || gen_random_uuid()::text,
  extensions.gen_salt('bf', 12)
)
where hashed_password is not null;

alter table public.users
  add constraint users_hashed_password_bcrypt_only
  check (hashed_password ~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$');

revoke all privileges on table public.users
  from public, anon, authenticated, service_role;

comment on table public.users is
  'Retired legacy account table. Active authentication is handled exclusively by Supabase Auth.';

comment on column public.users.hashed_password is
  'Retired legacy credential field. Existing value replaced with an unusable random bcrypt hash; client and service roles have no table access.';
