-- Text chat is gated by spendable credits, not a daily request counter.
begin;
create or replace function public.suly_check_ai_rate_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_balance bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22023';
  end if;
  select balance into v_balance
  from public.suly_credit_accounts
  where user_id = p_user_id
  limit 1;
  if coalesce(v_balance, 0) > 0 then
    return jsonb_build_object('allowed', true, 'reason', 'credit_balance');
  end if;
  -- reserve_credits remains the final atomic gate and returns insufficient_credits.
  return jsonb_build_object('allowed', true, 'reason', 'credit_gate_delegated_to_reserve');
end;
$$;
revoke all on function public.suly_check_ai_rate_limit(uuid) from public, anon, authenticated;
grant execute on function public.suly_check_ai_rate_limit(uuid) to service_role;
commit;
