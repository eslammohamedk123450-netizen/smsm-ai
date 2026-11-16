begin;
insert into public.ai_model_capability_evidence(
 model_id,capability_key,vendor_claim_status,vendor_evidence_url,
 provider_test_status,suly_test_status,notes,updated_at
)
select m.id,cap.capability_key,'supported','https://developers.openai.com/api/docs/models',
 'not_tested','not_tested',
 'OpenAI model catalog lists this tool for this exact flagship model ID. This is upstream documentation evidence only; the Soal gateway and SULY integration remain untested.',
 now()
from public.ai_models m
join (values
 ('gpt-6-astra','web_search'),('gpt-6-astra','file_search'),('gpt-6-astra','computer_use'),
 ('gpt-6-luna','web_search'),('gpt-6-luna','file_search'),('gpt-6-luna','computer_use')
) as cap(model_identifier,capability_key)
 on m.model_identifier=cap.model_identifier
on conflict(model_id,capability_key) do nothing;
commit;