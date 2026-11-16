begin;
with source_ids(model_identifier) as (values
('claude-opus-5-5'),('claude-sonnet-5-5'),('claude-fable-5-1'),('claude-opus-5'),('claude-sonnet-5'),('claude-fable-5'),
('claude-opus-4-8'),('claude-opus-4-7'),('claude-opus-4-6'),('claude-opus-4-5-20251101'),('claude-sonnet-4-6'),('claude-sonnet-4-5-20250929'),('claude-haiku-4-5-20251001'),('claude-haiku-5-5'),
('gpt-6-astra'),('gpt-6-sol'),('gpt-6-luna'),('gpt-5.6-sol'),('gpt-5.6-terra'),('gpt-5.6-luna'),('gpt-5.5'),('gpt-5.4'),('gpt-5.2'),('gpt-5.1'),('gpt-5'),('o3-pro'),('o3'),('o4-mini'),('gpt-4o'),('gpt-4.1'),('gpt-5.4-mini'),('gpt-5-mini'),('gpt-4.1-mini'),('gpt-4o-mini'),('gpt-4.1-nano'),('gpt-5-nano'),
('gemini-4-argon'),('gemini-3.1-pro-preview'),('gemini-3.8-flash'),('gemini-3.7-flash'),('gemini-3.6-flash'),('gemini-2.5-pro'),('gemini-3.5-flash'),('gemini-3-flash-preview'),('gemini-2.5-flash')
)
insert into public.ai_model_capability_evidence(
 model_id,capability_key,vendor_claim_status,vendor_evidence_url,
 provider_test_status,suly_test_status,notes,updated_at
)
select m.id,'text','supported','https://soal.help/',
 'not_tested','not_tested',
 'The provider-supplied catalog file نص ملصق(1).txt lists this ID in its text/chat model section. This records the provider-advertised text service only; no live provider probe or SULY integration test is implied.',
 now()
from source_ids s join public.ai_models m on m.model_identifier=s.model_identifier
where m.provider_id in (19,22,23) and s.model_identifier<>'gemini-4-argon'
on conflict(model_id,capability_key) do nothing;

insert into public.ai_model_capability_evidence(
 model_id,capability_key,vendor_claim_status,provider_test_status,suly_test_status,notes,updated_at
)
select m.id,'text','unknown','not_tested','not_tested',
 'Appears in the provider-supplied catalog file, but was not found in the checked public Google model catalog or Soal Help public model list. Confirm the provider alias before treating it as available.',
 now()
from public.ai_models m
where m.model_identifier='gemini-4-argon' and m.provider_id in (19,22,23)
on conflict(model_id,capability_key) do nothing;
commit;