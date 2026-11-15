-- Seed current Nano Banana image models from the authenticated Soal provider catalog.
-- Keep all presets inactive until an administrator configures cost, FX, margin, and price rows.
begin;

insert into public.suly_media_generation_models(
  service_type, display_name, provider_id, model_identifier, protocol,
  endpoint_url, allowed_tiers, supported_qualities, capabilities_json,
  is_default, is_active
)
values
(
  'image',
  'Nano Banana — Gemini 3.1 Flash Image',
  22,
  'gemini-3.1-flash-image-preview',
  'openai_images',
  'https://soal.help/api/v1/images/generations',
  array['free','lite','pro','max']::text[],
  array['economy','standard','high','ultra']::text[],
  jsonb_build_object('text_to_image', true, 'image_to_image', false, 'source', 'provider_model_catalog'),
  false,
  false
),
(
  'image',
  'Nano Banana Pro — Gemini 3 Pro Image',
  22,
  'gemini-3-pro-image-preview',
  'openai_images',
  'https://soal.help/api/v1/images/generations',
  array['free','lite','pro','max']::text[],
  array['economy','standard','high','ultra']::text[],
  jsonb_build_object('text_to_image', true, 'image_to_image', false, 'source', 'provider_model_catalog'),
  false,
  false
),
(
  'image',
  'Nano Banana Flash — Gemini 2.5 Flash Image',
  22,
  'gemini-2.5-flash-image',
  'openai_images',
  'https://soal.help/api/v1/images/generations',
  array['free','lite','pro','max']::text[],
  array['economy','standard','high','ultra']::text[],
  jsonb_build_object('text_to_image', true, 'image_to_image', false, 'source', 'provider_model_catalog'),
  false,
  false
)
on conflict (service_type, provider_id, model_identifier) do nothing;

commit;
