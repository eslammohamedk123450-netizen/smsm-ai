-- Chat requests can return provider-confirmed EGP billing without USD FX data.
-- Unknown costs must remain NULL/unknown, never be presented as zero or profit.
begin;

alter table public.suly_company_cost_ledger
  alter column provider_cost_usd drop not null,
  alter column credit_value_egp drop not null,
  alter column usd_to_egp drop not null,
  alter column revenue_egp drop not null,
  alter column provider_cost_egp drop not null,
  alter column gross_profit_egp drop not null;

alter table public.suly_company_cost_ledger
  drop constraint if exists suly_company_cost_ledger_cost_status_check;

alter table public.suly_company_cost_ledger
  add constraint suly_company_cost_ledger_cost_status_check
  check (cost_status in ('estimated','confirmed','reconciled','confirmed_egp','unknown'));

create index if not exists suly_company_cost_ledger_cost_status_created_idx
  on public.suly_company_cost_ledger(cost_status, created_at desc);

comment on column public.suly_company_cost_ledger.provider_cost_usd is
  'Nullable when the provider reports cost in another currency or does not report cost.';
comment on column public.suly_company_cost_ledger.provider_cost_egp is
  'Nullable when no provider-confirmed or safely converted EGP cost is available.';
comment on column public.suly_company_cost_ledger.cost_status is
  'unknown means provider cost was not returned; confirmed_egp means provider returned a confirmed EGP charge without USD conversion.';

commit;
