do $$
declare v_total integer; v_current integer; v_provider_tested integer; v_integrated integer; v_bad_formula integer; v_bad_unit integer;
begin
 select count(*),count(*) filter(where is_current),count(*) filter(where provider_tested),
        count(*) filter(where suly_integration_verified),
        count(*) filter(where selling_price_egp_per_unit<>round(provider_cost_egp_per_unit*1.4,8)),
        count(*) filter(where (service_type='image' and unit_type<>'image') or (service_type='video' and unit_type<>'video_second') or (service_type='audio' and unit_type<>'audio_minute'))
 into v_total,v_current,v_provider_tested,v_integrated,v_bad_formula,v_bad_unit
 from public.suly_media_model_price_versions where source_reference='provider_catalog_2026-11-16';
 if v_total<>22 or v_current<>22 or v_provider_tested<>22 or v_integrated<>0 or v_bad_formula<>0 or v_bad_unit<>0 then
  raise exception 'suly_media_model_price_regression';
 end if;
end $$;
