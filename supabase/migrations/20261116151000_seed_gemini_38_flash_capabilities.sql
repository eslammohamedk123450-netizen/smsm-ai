begin;
insert into public.ai_model_capability_evidence(
  model_id, capability_key, vendor_claim_status, vendor_evidence_url,
  provider_test_status, suly_test_status, notes, updated_at
)
select m.id, cap.capability_key, 'supported', cap.source_url,
       'not_tested', 'not_tested',
       'Vendor documentation confirms the model-level capability. This does not verify the configured gateway, provider account, or SULY workflow.',
       now()
from public.ai_models m
join (values
  ('gemini-3.8-flash','text','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash'),
  ('gemini-3.8-flash','vision','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash'),
  ('gemini-3.8-flash','video_input','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash'),
  ('gemini-3.8-flash','audio_input','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash'),
  ('gemini-3.8-flash','pdf_input','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash'),
  ('gemini-3.8-flash','function_calling','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash'),
  ('gemini-3.8-flash','computer_use','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash'),
  ('gemini-3.8-flash','file_search','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash'),
  ('gemini-3.8-flash','web_search','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash'),
  ('gemini-3.8-flash','structured_output','https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash')
) as cap(model_identifier,capability_key,source_url)
  on m.model_identifier=cap.model_identifier
on conflict(model_id,capability_key) do nothing;
commit;