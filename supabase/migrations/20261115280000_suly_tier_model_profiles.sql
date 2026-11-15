-- Give Lite, Pro and Max distinct, verified model pools.
-- Pro and Max models are enabled only after successful minimal live provider probes.
-- Higher subscriptions still select lower profiles through minimum_subscription_tier.

begin;

do $check$
begin
  if not exists (
    select 1 from public.ai_models m
    join public.ai_providers p on p.id = m.provider_id
    where m.id = 2319 and m.model_identifier = 'claude-sonnet-5-5'
      and m.provider_id = 22 and m.enabled and p.enabled
  ) then
    raise exception 'Verified SULY Pro model is missing or provider disabled';
  end if;
  if not exists (
    select 1 from public.ai_models m
    join public.ai_providers p on p.id = m.provider_id
    where m.id = 2318 and m.model_identifier = 'claude-opus-5-5'
      and m.provider_id = 22 and m.enabled and p.enabled
  ) then
    raise exception 'Verified SULY Max model is missing or provider disabled';
  end if;
  if not exists (
    select 1 from public.ai_models m
    join public.ai_providers p on p.id = m.provider_id
    where m.id = 3 and m.model_identifier = 'allam-2-7b'
      and m.provider_id = 1 and m.enabled and p.enabled
  ) then
    raise exception 'Verified Lite model is missing or provider disabled';
  end if;
end;
$check$;

-- The provider returned a valid chat completion for Sonnet and Opus.
-- Sonnet also returned a valid OpenAI-compatible function tool call.
update public.ai_models
set routing_group = 'paid_fallback',
    allowed_tiers = array['pro','max']::text[],
    capabilities_json = '{"chat":true,"tools":true}',
    priority = 200,
    response_timeout_ms = 30000,
    updated_at = now()
where id = 2319 and provider_id = 22;

update public.ai_models
set routing_group = 'paid_fallback',
    allowed_tiers = array['max']::text[],
    capabilities_json = '{"chat":true}',
    priority = 300,
    response_timeout_ms = 45000,
    updated_at = now()
where id = 2318 and provider_id = 22;

-- Lite should start with the small Arabic-tuned model that passed a live probe,
-- not the previously top-ranked 120B model. Retain healthy fallbacks.
delete from public.suly_model_profile_models
where profile_key = 'lite' and model_id = 7;

update public.suly_model_profile_models
set priority = case model_id
  when 3 then 1
  when 2 then 2
  when 5 then 3
  when 1 then 4
  when 10 then 5
  when 320 then 6
  when 323 then 7
  when 326 then 8
  when 327 then 9
  when 331 then 10
  else priority
end,
updated_at = now()
where profile_key = 'lite';

-- Pro uses the verified Sonnet model for chat/planning/review/summarization.
-- The small Lite model remains available as a worker for bounded independent subtasks.
delete from public.suly_model_profile_models
where profile_key in ('pro','max');

insert into public.suly_model_profile_models(profile_key,model_id,route_role,priority,enabled)
values
  ('pro',2319,'chat',1,true),
  ('pro',2319,'planner',1,true),
  ('pro',2319,'reviewer',1,true),
  ('pro',2319,'summarizer',1,true),
  ('pro',3,'worker',10,true),

  ('max',2318,'chat',1,true),
  ('max',2318,'planner',1,true),
  ('max',2318,'reviewer',1,true),
  ('max',2318,'summarizer',1,true),
  ('max',3,'worker',10,true)
on conflict (profile_key,model_id,route_role)
do update set priority=excluded.priority,enabled=excluded.enabled,updated_at=now();

-- The current verified Max model is configured for a 32K context window.
-- Do not advertise or require extended context until a 64K+ model is verified.
update public.suly_model_profiles
set capabilities_json = jsonb_set(capabilities_json,'{extended_context}','false'::jsonb,true),
    updated_at = now()
where profile_key = 'max';

commit;
