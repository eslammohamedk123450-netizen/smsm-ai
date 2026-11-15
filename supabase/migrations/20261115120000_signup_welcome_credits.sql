begin;

-- Give every newly created Auth user a one-time 200-credit welcome balance.
-- The account primary key makes the grant idempotent, including when more than
-- one auth.users trigger invokes this function for the same new user.
create or replace function public.suly_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  insert into public.suly_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  insert into public.suly_credit_accounts (user_id, balance)
  values (new.id, 200)
  on conflict (user_id) do nothing
  returning balance into v_balance;

  if found then
    insert into public.suly_credit_transactions (
      user_id,
      event_type,
      amount,
      balance_delta,
      reserved_delta,
      balance_after,
      reserved_after,
      source,
      reason
    )
    values (
      new.id,
      'admin_adjust',
      200,
      200,
      0,
      v_balance,
      0,
      'signup_bonus',
      'One-time 200-credit welcome bonus for a newly registered account'
    );
  end if;

  return new;
end;
$$;

commit;
