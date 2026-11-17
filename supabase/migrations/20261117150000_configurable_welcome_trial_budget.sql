begin;

create table if not exists public.suly_welcome_trial_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  welcome_credits bigint not null default 0 check (welcome_credits between 0 and 1000000000),
  max_accounts_per_24h integer not null default 0 check (max_accounts_per_24h between 0 and 1000000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.suly_welcome_trial_settings (id,enabled,welcome_credits,max_accounts_per_24h)
values (1,false,0,0)
on conflict (id) do nothing;

alter table public.suly_welcome_trial_settings enable row level security;
revoke all on public.suly_welcome_trial_settings from public, anon;
grant select, update on public.suly_welcome_trial_settings to authenticated;

drop policy if exists suly_welcome_trial_admin_select on public.suly_welcome_trial_settings;
create policy suly_welcome_trial_admin_select
on public.suly_welcome_trial_settings
for select to authenticated
using (public.suly_is_admin());

drop policy if exists suly_welcome_trial_admin_update on public.suly_welcome_trial_settings;
create policy suly_welcome_trial_admin_update
on public.suly_welcome_trial_settings
for update to authenticated
using (public.suly_is_admin())
with check (public.suly_is_admin());

create or replace function public.suly_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_balance bigint;
  v_welcome_enabled boolean := false;
  v_welcome_credits bigint := 0;
  v_max_accounts_per_24h integer := 0;
  v_recent_claims bigint := 0;
  v_account_created boolean := false;
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
  values (new.id, 0)
  on conflict (user_id) do nothing
  returning balance into v_balance;
  v_account_created := found;

  if v_account_created then
    select enabled, welcome_credits, max_accounts_per_24h
      into v_welcome_enabled, v_welcome_credits, v_max_accounts_per_24h
    from public.suly_welcome_trial_settings
    where id = 1;

    if coalesce(v_welcome_enabled,false)
      and coalesce(v_welcome_credits,0) > 0
      and coalesce(v_max_accounts_per_24h,0) > 0 then

      select count(*) into v_recent_claims
      from public.suly_credit_transactions
      where source = 'signup_bonus'
        and created_at >= now() - interval '24 hours';

      if v_recent_claims < v_max_accounts_per_24h then
        update public.suly_credit_accounts
        set balance = balance + v_welcome_credits, updated_at = now()
        where user_id = new.id
        returning balance into v_balance;

        insert into public.suly_credit_transactions (
          user_id,event_type,amount,balance_delta,reserved_delta,
          balance_after,reserved_after,source,reason
        )
        values (
          new.id,'admin_adjust',v_welcome_credits,v_welcome_credits,0,
          v_balance,0,'signup_bonus',
          'Configured welcome trial credit grant; per-account and rolling 24-hour caps applied'
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

commit;
