begin;

-- Prevent client-side updates to privilege, balance and subscription fields
-- in the legacy profiles table while preserving safe profile edits.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute $trigger$
      create or replace function public.suly_guard_legacy_profile_fields()
      returns trigger
      language plpgsql
      security definer
      set search_path = pg_catalog, public
      as $fn$
      begin
        if coalesce(auth.role(), '') <> 'service_role'
           and auth.uid() is not null
           and auth.uid() = new.id then
          if new.role is distinct from old.role
             or new.is_banned is distinct from old.is_banned
             or new.credit_balance is distinct from old.credit_balance
             or new.subscription_tier is distinct from old.subscription_tier then
            raise exception 'Sensitive profile fields can only be changed by a protected server action.' using errcode = '42501';
          end if;
        end if;
        return new;
      end;
      $fn$;
    $trigger$;
    execute 'drop trigger if exists suly_guard_legacy_profile_fields on public.profiles';
    execute 'create trigger suly_guard_legacy_profile_fields before update on public.profiles for each row execute function public.suly_guard_legacy_profile_fields()';
    execute 'revoke update on public.profiles from authenticated';
    execute 'grant update (full_name, avatar_url, updated_at) on public.profiles to authenticated';
  end if;
end $$;

-- Pause client-claimable rewarded ads until AdMob server-side verification is wired.
-- This prevents fabricated reward IDs from minting credits.
revoke execute on function public.claim_rewarded_ad(uuid) from authenticated;

commit;
