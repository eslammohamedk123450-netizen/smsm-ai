begin;

-- Vendor-documentation claims only. Provider probes and SULY integration remain untested.
insert into public.ai_model_capability_evidence(
  model_id, capability_key, vendor_claim_status, vendor_evidence_url,
  provider_test_status, suly_test_status, notes, updated_at
)
select m.id, cap.capability_key, 'supported', cap.source_url,
       'not_tested', 'not_tested',
       'Seeded from the vendor''s public model documentation; this is not evidence that the configured gateway exposes the capability.',
       now()
from public.ai_models m
join (values
  ('claude-opus-5-5','text','https://platform.claude.com/docs/en/models/overview'),
  ('claude-opus-5-5','vision','https://platform.claude.com/docs/en/models/overview'),
  ('claude-opus-5-5','function_calling','https://platform.claude.com/docs/en/models/overview'),
  ('claude-sonnet-5-5','text','https://platform.claude.com/docs/en/models/overview'),
  ('claude-sonnet-5-5','vision','https://platform.claude.com/docs/en/models/overview'),
  ('claude-sonnet-5-5','function_calling','https://platform.claude.com/docs/en/models/overview'),
  ('claude-fable-5-1','text','https://platform.claude.com/docs/en/models/overview'),
  ('claude-fable-5-1','vision','https://platform.claude.com/docs/en/models/overview'),
  ('claude-fable-5-1','function_calling','https://platform.claude.com/docs/en/models/overview'),
  ('claude-haiku-5-5','text','https://platform.claude.com/docs/en/models/overview'),
  ('claude-haiku-5-5','vision','https://platform.claude.com/docs/en/models/overview'),
  ('claude-haiku-5-5','function_calling','https://platform.claude.com/docs/en/models/overview'),
  ('gpt-6-astra','text','https://developers.openai.com/api/docs/models'),
  ('gpt-6-astra','vision','https://developers.openai.com/api/docs/models'),
  ('gpt-6-astra','function_calling','https://developers.openai.com/api/docs/models'),
  ('gpt-6-luna','text','https://developers.openai.com/api/docs/models'),
  ('gpt-6-luna','vision','https://developers.openai.com/api/docs/models'),
  ('gpt-6-luna','function_calling','https://developers.openai.com/api/docs/models'),
  ('gpt-5.5','text','https://developers.openai.com/api/docs/models/gpt-5.5'),
  ('gpt-5.5','vision','https://developers.openai.com/api/docs/models/gpt-5.5'),
  ('gpt-5.5','function_calling','https://developers.openai.com/api/docs/models/gpt-5.5')
) as cap(model_identifier,capability_key,source_url)
  on m.model_identifier=cap.model_identifier
on conflict(model_id,capability_key) do nothing;

commit;