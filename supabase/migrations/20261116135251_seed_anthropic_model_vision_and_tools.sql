begin;
insert into public.ai_model_capability_evidence(
 model_id,capability_key,vendor_claim_status,vendor_evidence_url,
 provider_test_status,suly_test_status,notes,updated_at
)
select m.id,cap.capability_key,'supported','https://platform.claude.com/docs/en/models/overview',
 'not_tested','not_tested',
 'Anthropic model overview lists this model in the current model catalog and documents text/image input, vision and tool use for current Claude models. Gateway and SULY integration remain untested.',
 now()
from public.ai_models m
join (values
 ('claude-opus-5','vision'),('claude-opus-5','function_calling'),
 ('claude-sonnet-5','vision'),('claude-sonnet-5','function_calling'),
 ('claude-fable-5','vision'),('claude-fable-5','function_calling'),
 ('claude-opus-4-8','vision'),('claude-opus-4-8','function_calling'),
 ('claude-opus-4-7','vision'),('claude-opus-4-7','function_calling'),
 ('claude-opus-4-6','vision'),('claude-opus-4-6','function_calling'),
 ('claude-opus-4-5-20251101','vision'),('claude-opus-4-5-20251101','function_calling'),
 ('claude-sonnet-4-6','vision'),('claude-sonnet-4-6','function_calling'),
 ('claude-sonnet-4-5-20250929','vision'),('claude-sonnet-4-5-20250929','function_calling'),
 ('claude-haiku-4-5-20251001','vision'),('claude-haiku-4-5-20251001','function_calling')
) as cap(model_identifier,capability_key)
 on m.model_identifier=cap.model_identifier
on conflict(model_id,capability_key) do nothing;
commit;