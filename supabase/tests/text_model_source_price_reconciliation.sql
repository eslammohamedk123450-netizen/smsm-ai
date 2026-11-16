-- Verify all 45 text-model prices against the original provider catalog.
do $$
declare
  v_missing_or_wrong integer;
  v_bad_markup integer;
  v_source_count integer;
begin
  with source(model_identifier,input_cost,output_cost) as (values
    ('claude-opus-5-5',232.00000000,1160.00000000),
    ('claude-sonnet-5-5',116.00000000,580.00000000),
    ('claude-fable-5-1',580.00000000,2900.00000000),
    ('claude-opus-5',290.00000000,1450.00000000),
    ('claude-sonnet-5',116.00000000,580.00000000),
    ('claude-fable-5',580.00000000,2900.00000000),
    ('claude-opus-4-8',290.00000000,1450.00000000),
    ('claude-opus-4-7',290.00000000,1450.00000000),
    ('claude-opus-4-6',290.00000000,1450.00000000),
    ('claude-opus-4-5-20251101',290.00000000,1450.00000000),
    ('claude-sonnet-4-6',174.00000000,870.00000000),
    ('claude-sonnet-4-5-20250929',174.00000000,870.00000000),
    ('claude-haiku-4-5-20251001',58.00000000,290.00000000),
    ('claude-haiku-5-5',5.80000000,29.00000000),
    ('gpt-6-astra',580.00000000,2900.00000000),
    ('gpt-6-sol',116.00000000,580.00000000),
    ('gpt-6-luna',5.80000000,29.00000000),
    ('gpt-5.6-sol',232.00000000,1160.00000000),
    ('gpt-5.6-terra',116.00000000,696.00000000),
    ('gpt-5.6-luna',11.60000000,69.60000000),
    ('gpt-5.5',290.00000000,1740.00000000),
    ('gpt-5.4',145.00000000,870.00000000),
    ('gpt-5.2',101.50000000,812.00000000),
    ('gpt-5.1',72.50000000,580.00000000),
    ('gpt-5',72.50000000,580.00000000),
    ('o3-pro',1160.00000000,4640.00000000),
    ('o3',116.00000000,464.00000000),
    ('o4-mini',63.80000000,255.20000000),
    ('gpt-4o',145.00000000,580.00000000),
    ('gpt-4.1',116.00000000,464.00000000),
    ('gpt-5.4-mini',43.50000000,261.00000000),
    ('gpt-5-mini',14.50000000,116.00000000),
    ('gpt-4.1-mini',23.20000000,92.80000000),
    ('gpt-4o-mini',8.70000000,34.80000000),
    ('gpt-4.1-nano',5.80000000,23.20000000),
    ('gpt-5-nano',2.90000000,23.20000000),
    ('gemini-4-argon',232.00000000,1160.00000000),
    ('gemini-3.1-pro-preview',116.00000000,696.00000000),
    ('gemini-3.8-flash',43.50000000,217.50000000),
    ('gemini-3.7-flash',43.50000000,217.50000000),
    ('gemini-3.6-flash',43.50000000,217.50000000),
    ('gemini-2.5-pro',72.50000000,580.00000000),
    ('gemini-3.5-flash',87.00000000,522.00000000),
    ('gemini-3-flash-preview',29.00000000,174.00000000),
    ('gemini-2.5-flash',17.40000000,145.00000000)
  )
  select count(*) into v_source_count from source;

  if v_source_count <> 45 then
    raise exception 'Expected 45 source catalog rows, found %', v_source_count;
  end if;

  with source(model_identifier,input_cost,output_cost) as (values
    ('claude-opus-5-5',232.00000000,1160.00000000),
    ('claude-sonnet-5-5',116.00000000,580.00000000),
    ('claude-fable-5-1',580.00000000,2900.00000000),
    ('claude-opus-5',290.00000000,1450.00000000),
    ('claude-sonnet-5',116.00000000,580.00000000),
    ('claude-fable-5',580.00000000,2900.00000000),
    ('claude-opus-4-8',290.00000000,1450.00000000),
    ('claude-opus-4-7',290.00000000,1450.00000000),
    ('claude-opus-4-6',290.00000000,1450.00000000),
    ('claude-opus-4-5-20251101',290.00000000,1450.00000000),
    ('claude-sonnet-4-6',174.00000000,870.00000000),
    ('claude-sonnet-4-5-20250929',174.00000000,870.00000000),
    ('claude-haiku-4-5-20251001',58.00000000,290.00000000),
    ('claude-haiku-5-5',5.80000000,29.00000000),
    ('gpt-6-astra',580.00000000,2900.00000000),
    ('gpt-6-sol',116.00000000,580.00000000),
    ('gpt-6-luna',5.80000000,29.00000000),
    ('gpt-5.6-sol',232.00000000,1160.00000000),
    ('gpt-5.6-terra',116.00000000,696.00000000),
    ('gpt-5.6-luna',11.60000000,69.60000000),
    ('gpt-5.5',290.00000000,1740.00000000),
    ('gpt-5.4',145.00000000,870.00000000),
    ('gpt-5.2',101.50000000,812.00000000),
    ('gpt-5.1',72.50000000,580.00000000),
    ('gpt-5',72.50000000,580.00000000),
    ('o3-pro',1160.00000000,4640.00000000),
    ('o3',116.00000000,464.00000000),
    ('o4-mini',63.80000000,255.20000000),
    ('gpt-4o',145.00000000,580.00000000),
    ('gpt-4.1',116.00000000,464.00000000),
    ('gpt-5.4-mini',43.50000000,261.00000000),
    ('gpt-5-mini',14.50000000,116.00000000),
    ('gpt-4.1-mini',23.20000000,92.80000000),
    ('gpt-4o-mini',8.70000000,34.80000000),
    ('gpt-4.1-nano',5.80000000,23.20000000),
    ('gpt-5-nano',2.90000000,23.20000000),
    ('gemini-4-argon',232.00000000,1160.00000000),
    ('gemini-3.1-pro-preview',116.00000000,696.00000000),
    ('gemini-3.8-flash',43.50000000,217.50000000),
    ('gemini-3.7-flash',43.50000000,217.50000000),
    ('gemini-3.6-flash',43.50000000,217.50000000),
    ('gemini-2.5-pro',72.50000000,580.00000000),
    ('gemini-3.5-flash',87.00000000,522.00000000),
    ('gemini-3-flash-preview',29.00000000,174.00000000),
    ('gemini-2.5-flash',17.40000000,145.00000000)
  )
  select count(*) into v_missing_or_wrong
  from source s
  left join public.ai_models m on m.provider_id=22 and m.model_identifier=s.model_identifier
  left join public.ai_model_price_versions p on p.model_id=m.id and p.is_current
  where m.id is null or p.id is null
     or p.provider_input_cost_egp_per_million<>s.input_cost
     or p.provider_output_cost_egp_per_million<>s.output_cost;

  if v_missing_or_wrong <> 0 then
    raise exception 'Source price reconciliation failed for % of 45 models', v_missing_or_wrong;
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
