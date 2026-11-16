begin;
insert into public.ai_model_capability_evidence(
  model_id,capability_key,vendor_claim_status,vendor_evidence_url,
  provider_test_status,suly_test_status,notes,updated_at
)
select m.id,cap.capability_key,cap.vendor_status,
       'https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash',
       'not_tested','not_tested',
       cap.evidence_note,now()
from public.ai_models m
join (values
  ('gemini-3.8-flash','code_interpreter','supported','Official model page marks code execution supported.'),
  ('gemini-3.8-flash','image_generation','unsupported','Official model page marks image generation not supported; image input is supported separately.'),
  ('gemini-3.8-flash','audio_output','unsupported','Official model page marks audio generation not supported; audio input is supported separately.')
) as cap(model_identifier,capability_key,vendor_status,evidence_note)
  on m.model_identifier=cap.model_identifier
on conflict(model_id,capability_key) do nothing;
commit;