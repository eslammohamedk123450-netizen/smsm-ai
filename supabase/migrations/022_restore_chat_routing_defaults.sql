begin;

-- Restore the default chat pool after the interactive-chat update.
-- Keep audio, moderation, and disabled models out of auto chat routing.
update public.ai_models
set routing_group = 'free_race',
    updated_at = now()
where provider_id = 1
  and enabled = true
  and model_identifier not like 'whisper%'
  and model_identifier not like 'canopylabs/orpheus%'
  and model_identifier not like 'meta-llama/llama-prompt-guard%'
  and routing_group = 'disabled';

commit;
