-- Regression checks for model-specific, versioned EGP pricing.
do $$
declare
  v_total integer;
  v_current integer;
  v_bad_markup integer;
  v_formula_mismatch integer;
  v_bad_provider integer;
begin
  select count(*), count(*) filter (where is_current),
         count(*) filter (where markup_rate <> 0.40000),
         count(*) filter (
           where selling_input_egp_per_million <> round(provider_input_cost_egp_per_million * 1.4, 8)
              or selling_output_egp_per_million <> round(provider_output_cost_egp_per_million * 1.4, 8)
         ),
         count(*) filter (where model.provider_id <> 22)
    into v_total, v_current, v_bad_markup, v_formula_mismatch, v_bad_provider
  from public.ai_model_price_versions price
  join public.ai_models model on model.id = price.model_id
  where price.source_reference = 'provider_catalog_2026-11-16';

  if v_total <> 44 or v_current <> 44 or v_bad_markup <> 0
     or v_formula_mismatch <> 0 or v_bad_provider <> 0 then
    raise exception 'ai_model_price_catalog_regression';
  end if;
end;
$$;
