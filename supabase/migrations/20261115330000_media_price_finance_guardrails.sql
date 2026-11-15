-- Prevent activation of image/video prices without a complete cost, FX, credit-value, and margin model.
begin;

alter table public.suly_media_generation_prices
  drop constraint if exists suly_media_generation_prices_enabled_finance_check;

alter table public.suly_media_generation_prices
  add constraint suly_media_generation_prices_enabled_finance_check
  check (
    not enabled
    or (
      estimated_provider_cost_usd > 0
      and credit_value_egp > 0
      and usd_to_egp > 0
      and target_margin >= 0
      and target_margin < 1
      and price_credits >= ceil(
        (estimated_provider_cost_usd * usd_to_egp)
        / ((1 - target_margin) * credit_value_egp)
      )
    )
  );

comment on constraint suly_media_generation_prices_enabled_finance_check
  on public.suly_media_generation_prices is
  'Enabled media prices must reserve enough SULY Credits to cover the estimated provider cost, FX conversion, credit value, and configured gross margin.';

commit;
