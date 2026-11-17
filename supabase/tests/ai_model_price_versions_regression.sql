-- Regression checks for model-specific, versioned EGP pricing.
-- The reconciliation migration intentionally supersedes two original source rows.
do $$
declare
  v_source_total integer;
  v_source_current integer;
  v_reconciled_total integer;
  v_reconciled_current integer;
  v_bad_markup integer;
  v_formula_mismatch integer;
  v_bad_provider integer;
  v_duplicate_current integer;
  v_o3_input numeric;
  v_o3_output numeric;
  v_o3_pro_input numeric;
  v_o3_pro_output numeric;
begin
  select count(*), count(*) filter (where is_current),
         count(*) filter (where markup_rate <> 0.40000),
         count(*) filter (
           where selling_input_egp_per_million <> round(provider_input_cost_egp_per_million * 1.4, 8)
              or selling_output_egp_per_million <> round(provider_output_cost_egp_per_million * 1.4, 8)
         ),
         count(*) filter (where model.provider_id <> 22)
    into v_source_total, v_source_current, v_bad_markup, v_formula_mismatch, v_bad_provider
  from public.ai_model_price_versions price
  join public.ai_models model on model.id = price.model_id
  where price.source_reference = 'provider_catalog_2026-11-16';

  select count(*), count(*) filter (where is_current)
    into v_reconciled_total, v_reconciled_current
  from public.ai_model_price_versions
  where source_reference = 'provider_catalog_2026-11-16_reconciliation';

  select count(*) into v_duplicate_current
  from (
    select price.model_id
    from public.ai_model_price_versions price
    where price.is_current
    group by price.model_id
    having count(*) > 1
  ) duplicate_current;

  select price.provider_input_cost_egp_per_million, price.provider_output_cost_egp_per_million
    into v_o3_input, v_o3_output
  from public.ai_model_price_versions price
  join public.ai_models model on model.id = price.model_id
  where model.provider_id = 22 and model.model_identifier = 'o3' and price.is_current;

  select price.provider_input_cost_egp_per_million, price.provider_output_cost_egp_per_million
    into v_o3_pro_input, v_o3_pro_output
  from public.ai_model_price_versions price
  join public.ai_models model on model.id = price.model_id
  where model.provider_id = 22 and model.model_identifier = 'o3-pro' and price.is_current;

  if v_source_total <> 44 or v_source_current <> 42
     or v_reconciled_total <> 2 or v_reconciled_current <> 2
     or v_bad_markup <> 0 or v_formula_mismatch <> 0 or v_bad_provider <> 0
     or v_duplicate_current <> 0
     or v_o3_input <> 116 or v_o3_output <> 464
     or v_o3_pro_input <> 1160 or v_o3_pro_output <> 4640 then
    raise exception 'ai_model_price_catalog_regression: source %, source_current %, reconciled %, reconciled_current %, bad_markup %, formula_mismatch %, bad_provider %, duplicate_current %',
      v_source_total, v_source_current, v_reconciled_total, v_reconciled_current,
      v_bad_markup, v_formula_mismatch, v_bad_provider, v_duplicate_current;
  end if;
end;
$$;
