begin;
alter table public.ai_model_capability_evidence
  drop constraint if exists ai_model_capability_evidence_capability_key_check;
alter table public.ai_model_capability_evidence
  add constraint ai_model_capability_evidence_capability_key_check
  check (capability_key in (
    'chat','text','vision','pdf','pdf_input','word','file_input','video','video_input',
    'audio_input','audio_output','image_generation','video_generation','transcription',
    'function_calling','structured_output','streaming','web_search','file_search',
    'computer_use','code_interpreter','mcp_tools','gmail','google_drive','github'
  ));
comment on column public.ai_model_capability_evidence.capability_key is
  'Model-native capability key. Connector keys (gmail/google_drive/github) represent tool-call compatibility and must not be treated as native provider modalities.';
commit;