-- Verify all source-catalog text model prices reconciled by the follow-up migration.
do $$
declare
  v_missing_or_wrong integer;
  v_bad_markup integer;
begin
  with source(model_identifier,input_cost,output_cost) as (values
    ('o3'::text,116.00000000::numeric,464.00000000::numeric),
    ('o3-pro'::text,1160.00000000::numeric,4640.00000000::numeric)
  )
  select count(*) into v_missing_or_wrong
  from source s
  join public.ai_models m on m.provider_id=22 and m.model_identifier=s.model_identifier
  left join public.ai_model_price_versions p on p.model_id=m.id and p.is_current
  where p.id is null
     or p.provider_input_cost_egp_per_million<>s.input_cost
     or p.provider_output_cost_egp_per_million<>s.output_cost;

  if v_missing_or_wrong <> 0 then
    raise exception 'Source price reconciliation failed for % models', v_missing_or_wrong;
  end if;

  select count(*) into v_bad_markup
  from public.ai_model_price_versions p
  join public.ai_models m on m.id=p.model_id
  where p.is_current and m.provider_id=22
    and (p.markup_rate<>0.40000
      or p.selling_input_egp_per_million<>round(p.provider_input_cost_egp_per_million*1.4,8)
      or p.selling_output_egp_per_million<>round(p.provider_output_cost_egp_per_million*1.4,8));

  if v_bad_markup <> 0 then
    raise exception 'Expected exact 40%% markup; found % incorrect current price rows', v_bad_markup;
  end if;
end;
$$;
