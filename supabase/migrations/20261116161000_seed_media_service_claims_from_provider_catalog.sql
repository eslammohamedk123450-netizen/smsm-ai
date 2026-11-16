begin;
insert into public.suly_media_model_capability_evidence(
  provider_id,service_type,model_identifier,capability_key,
  vendor_claim_status,vendor_evidence_url,provider_test_status,suly_test_status,notes,updated_at
)
select p.provider_id,p.service_type,p.model_identifier,cap.capability_key,
       'supported','https://soal.help/','not_tested','not_tested',
       'Listed in the provider-supplied catalog file نص ملصق(1).txt (received 2026-11-16). This records the advertised service category only; it is not a live provider probe or SULY integration test. Check upstream lifecycle and gateway alias mapping before activation.',
       now()
from public.suly_media_model_price_versions p
join (values
  ('video','kling-4','video_generation'),
  ('video','seedance-2.5','video_generation'),
  ('video','gemini-omni-flash','video_generation'),
  ('video','kling-4-flash','video_generation'),
  ('video','wan-3','video_generation'),
  ('video','seedance-2-fast','video_generation'),
  ('video','minimax-h3','video_generation'),
  ('image','nano-banana-2.1','image_generation'),
  ('image','gemini-3.1-flash-image-preview','image_generation'),
  ('image','gemini-3-pro-image-preview','image_generation'),
  ('image','gpt-image-2','image_generation'),
  ('image','gpt-image-1.5','image_generation'),
  ('image','gpt-image-1','image_generation'),
  ('image','gemini-2.5-flash-image','image_generation'),
  ('image','flux-3','image_generation'),
  ('image','flux-2-pro','image_generation'),
  ('image','seedream-5.5','image_generation'),
  ('image','seedream-5-flash','image_generation'),
  ('image','ideogram-4.5','image_generation'),
  ('audio','whisper-1','transcription'),
  ('audio','gpt-4o-transcribe','transcription'),
  ('audio','gpt-4o-mini-transcribe','transcription')
) as cap(service_type,model_identifier,capability_key)
  on p.service_type=cap.service_type and p.model_identifier=cap.model_identifier
where p.provider_id=22 and p.is_current=true
on conflict(provider_id,service_type,model_identifier,capability_key) do nothing;
commit;