-- Disable a Groq model that consistently returns model_not_found.
-- Keep its row and routing history for audit; the central eligibility filter will skip it.
begin;

update public.ai_models
set enabled = false,
    updated_at = now()
where id = 1
  and provider_id = 1
  and model_identifier = 'llama-3.3-70b-versatile';

commit;
