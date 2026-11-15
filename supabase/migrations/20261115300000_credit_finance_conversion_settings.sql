-- Optional finance conversion settings for chat Credits. Leave NULL until the
-- administrator supplies the actual business value and current USD/EGP rate.
begin;

alter table public.suly_credit_pricing
  add column if not exists credit_value_egp numeric(20,8),
  add column if not exists usd_to_egp numeric(20,8);

alter table public.suly_credit_pricing
  drop constraint if exists suly_credit_pricing_credit_value_egp_check,
  drop constraint if exists suly_credit_pricing_usd_to_egp_check;

alter table public.suly_credit_pricing
  add constraint suly_credit_pricing_credit_value_egp_check
    check (credit_value_egp is null or credit_value_egp > 0),
  add constraint suly_credit_pricing_usd_to_egp_check
    check (usd_to_egp is null or usd_to_egp > 0);

create or replace function public.suly_admin_update_credit_finance_controls(
  p_enabled boolean,
  p_minimum_request_credits bigint,
  p_input_credits_per_1k_tokens bigint,
  p_output_credits_per_1k_tokens bigint,
  p_negative_balance_limit bigint,
  p_credit_value_egp numeric,
  p_usd_to_egp numeric
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $finance$
declare
  v_admin uuid := auth.uid();
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if p_enabled is null
    or p_minimum_request_credits is null or p_minimum_request_credits < 0 or p_minimum_request_credits > 1000000000
    or p_input_credits_per_1k_tokens is null or p_input_credits_per_1k_tokens < 0 or p_input_credits_per_1k_tokens > 1000000000
    or p_output_credits_per_1k_tokens is null or p_output_credits_per_1k_tokens < 0 or p_output_credits_per_1k_tokens > 1000000000
    or p_negative_balance_limit is null or p_negative_balance_limit < 0 or p_negative_balance_limit > 1000000000
    or (p_credit_value_egp is not null and (p_credit_value_egp <= 0 or p_credit_value_egp > 1000000))
    or (p_usd_to_egp is not null and (p_usd_to_egp <= 0 or p_usd_to_egp > 1000000)) then
    raise exception 'invalid credit finance controls' using errcode = '22023';
  end if;

  update public.suly_credit_pricing
    set enabled = p_enabled,
        minimum_request_credits = p_minimum_request_credits,
        input_credits_per_1k_tokens = p_input_credits_per_1k_tokens,
        output_credits_per_1k_tokens = p_output_credits_per_1k_tokens,
        negative_balance_limit = p_negative_balance_limit,
        credit_value_egp = p_credit_value_egp,
        usd_to_egp = p_usd_to_egp,
        updated_by = v_admin,
        updated_at = now()
    where id = 1;

  if not found then
    raise exception 'credit pricing row is missing' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (
    v_admin, 'credit_finance_controls_updated', 'suly_credit_pricing', '1',
    jsonb_build_object(
      'enabled', p_enabled,
      'minimum_request_credits', p_minimum_request_credits,
      'input_credits_per_1k_tokens', p_input_credits_per_1k_tokens,
      'output_credits_per_1k_tokens', p_output_credits_per_1k_tokens,
      'negative_balance_limit', p_negative_balance_limit,
      'credit_value_egp', p_credit_value_egp,
      'usd_to_egp', p_usd_to_egp
    ), now()
  );

  return jsonb_build_object(
    'success', true,
    'credit_value_egp', p_credit_value_egp,
    'usd_to_egp', p_usd_to_egp,
    'negative_balance_limit', p_negative_balance_limit
  );
end;
$finance$;

revoke all on function public.suly_admin_update_credit_finance_controls(boolean,bigint,bigint,bigint,bigint,numeric,numeric)
  from public, anon;
grant execute on function public.suly_admin_update_credit_finance_controls(boolean,bigint,bigint,bigint,bigint,numeric,numeric)
  to authenticated;

comment on column public.suly_credit_pricing.credit_value_egp is
  'EGP value of one SULY Credit; NULL means revenue/profit cannot yet be calculated.';
comment on column public.suly_credit_pricing.usd_to_egp is
  'Admin-maintained USD to EGP exchange rate; NULL means USD costs are not converted.';

commit;
