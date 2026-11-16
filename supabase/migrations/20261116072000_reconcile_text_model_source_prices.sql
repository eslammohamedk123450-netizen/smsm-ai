-- Reconcile two text-model prices against the user's original provider catalog.
-- o3 was omitted from the first seed; o3-pro was seeded at one tenth of its source cost.
begin;

do $$
declare
  r record;
  v_model_id integer;
  v_next_version integer;
begin
  for r in
    select * from (values
      ('o3'::text, 116.00000000::numeric, 464.00000000::numeric),
      ('o3-pro'::text, 1160.00000000::numeric, 4640.00000000::numeric)
    ) as source(model_identifier, input_cost, output_cost)
  loop
    select id into v_model_id
    from public.ai_models
    where provider_id = 22 and model_identifier = r.model_identifier;

    if v_model_id is null then
      raise exception 'Expected provider catalog model % (provider 22) was not found', r.model_identifier;
    end if;

    select coalesce(max(price_version), 0) + 1 into v_next_version
    from public.ai_model_price_versions
    where model_id = v_model_id;

    update public.ai_model_price_versions
    set is_current = false
    where model_id = v_model_id and is_current;

    insert into public.ai_model_price_versions (
      model_id, price_version,
      provider_input_cost_egp_per_million,
      provider_output_cost_egp_per_million,
      markup_rate, currency, source_reference, is_current, effective_at
    ) values (
      v_model_id, v_next_version, r.input_cost, r.output_cost,
      0.40000, 'EGP', 'provider_catalog_2026-11-16_reconciliation',
      true, now()
    );
  end loop;
end;
$$;

commit;
