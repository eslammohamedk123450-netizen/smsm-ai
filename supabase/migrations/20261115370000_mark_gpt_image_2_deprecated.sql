-- The provider still lists GPT Image 2, but OpenAI has deprecated it with a
-- February 10, 2027 shutdown date. Keep the preset disabled and label it clearly.
begin;

update public.suly_media_generation_models
set display_name = 'GPT Image 2 (Deprecated 2027-02-10)',
    is_active = false,
    is_default = false,
    capabilities_json = coalesce(capabilities_json, '{}'::jsonb) || jsonb_build_object(
      'deprecated', true,
      'shutdown_date', '2027-02-10',
      'recommended_replacements', jsonb_build_array('gpt-image-2.6-sunburst','gpt-image-2.6-flare'),
      'availability_status', 'provider_catalog_only'
    ),
    updated_at = now()
where provider_id = 22
  and model_identifier = 'gpt-image-2';

commit;
