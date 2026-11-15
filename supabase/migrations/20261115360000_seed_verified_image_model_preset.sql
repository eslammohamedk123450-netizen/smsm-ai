-- Add a verified provider-catalog image model as an inactive admin preset.
-- It remains unavailable to end users until finance settings and an enabled price are configured.
begin;

insert into public.suly_media_generation_models(
  service_type,
  display_name,
  provider_id,
  model_identifier,
  protocol,
  endpoint_url,
  allowed_tiers,
  supported_qualities,
  capabilities_json,
  is_default,
  is_active
)
values (
  'image',
  'GPT Image 2',
  22,
  'gpt-image-2',
  'openai_images',
  'https://soal.help/api/v1/images/generations',
  array['free','lite','pro','max']::text[],
  array['economy','standard','high','ultra']::text[],
  jsonb_build_object(
    'text_to_image', true,
    'image_to_image', false,
    'source', 'provider_model_catalog'
  ),
  false,
  false
)
on conflict (service_type, provider_id, model_identifier) do nothing;

commit;
