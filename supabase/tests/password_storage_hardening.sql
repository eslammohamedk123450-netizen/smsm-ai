-- Password-storage regression checks.
-- Read-only assertions inside a transaction; no credentials or hash values are selected.

begin;

do $$
declare
  v_count integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'encrypted_password'
  ) then
    raise exception 'Supabase Auth encrypted_password storage column is missing';
  end if;

  select count(*) into v_count
  from auth.users
  where encrypted_password is not null;
  if v_count = 0 then
    raise exception 'No Supabase Auth password hashes were found';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and column_name ~* '(password|passwd|passphrase)'
      and not (table_name = 'users' and column_name = 'hashed_password')
  ) then
    raise exception 'Unexpected password-like column found in public schema';
  end if;

  if exists (
    select 1 from public.users
    where length(hashed_password) <> 60
       or left(hashed_password, 4) not in ('$2a$', '$2b$', '$2y$')
       or substring(hashed_password from 5 for 2) !~ '^[0-9]{2}$'
       or substring(hashed_password from 8) !~ '^[./A-Za-z0-9]{53}$'
  ) then
    raise exception 'Legacy users table contains a value outside bcrypt format';
  end if;

  if has_table_privilege('anon', 'public.users', 'SELECT')
     or has_table_privilege('authenticated', 'public.users', 'SELECT')
     or has_table_privilege('service_role', 'public.users', 'SELECT') then
    raise exception 'Legacy users table is readable by an API role';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_hashed_password_bcrypt_only'
  ) then
    raise exception 'Bcrypt-only constraint is missing';
  end if;
end
$$;

rollback;
