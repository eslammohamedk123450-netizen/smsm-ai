-- Run after 20261117120000_unified_model_registry_and_capabilities.sql.
-- Read-only integrity and privilege regression checks.
begin;

do $$
declare
  v_missing_chat bigint;
  v_missing_media bigint;
  v_unreviewed_approved bigint;
  v_chat_total bigint;
  v_chat_registered bigint;
  v_media_total bigint;
  v_media_registered bigint;
  v_list_fn regprocedure := 'public.suly_admin_list_unified_model_capabilities()'::regprocedure;
  v_save_fn regprocedure := 'public.suly_admin_save_unified_model_capability(uuid,text,text,text,text,text,text,text,text,text)'::regprocedure;
begin
  if not (select relrowsecurity from pg_class where oid='public.suly_model_registry'::regclass) then
    raise exception 'RLS must be enabled on suly_model_registry';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.suly_model_capabilities'::regclass) then
    raise exception 'RLS must be enabled on suly_model_capabilities';
  end if;
  if has_function_privilege('anon',v_list_fn,'EXECUTE') or has_function_privilege('anon',v_save_fn,'EXECUTE') then
    raise exception 'anon must not execute unified model admin RPCs';
  end if;
  if not has_function_privilege('authenticated',v_list_fn,'EXECUTE')
     or not has_function_privilege('authenticated',v_save_fn,'EXECUTE') then
    raise exception 'authenticated must be able to call admin-gated RPCs';
  end if;

  select count(*) into v_chat_total from public.ai_models;
  select count(*) into v_chat_registered from public.suly_model_registry where service_type='chat' and legacy_chat_model_id is not null;
  if v_chat_total<>v_chat_registered then
    raise exception 'chat model identity mismatch: source %, registry %',v_chat_total,v_chat_registered;
  end if;

  select count(*) into v_media_total from public.suly_media_generation_models;
  select count(*) into v_media_registered from public.suly_model_registry where service_type in ('image','video') and legacy_media_model_id is not null;
  if v_media_total<>v_media_registered then
    raise exception 'media model identity mismatch: source %, registry %',v_media_total,v_media_registered;
  end if;

  select count(*) into v_missing_chat
  from public.ai_model_capability_evidence e
  join public.ai_models m on m.id=e.model_id
  left join public.suly_model_registry r on r.provider_id=m.provider_id and r.service_type='chat' and r.model_identifier=m.model_identifier
  left join public.suly_model_capabilities c on c.model_id=r.id and c.capability_key=e.capability_key
  where r.id is null or c.model_id is null;
  if v_missing_chat>0 then raise exception 'chat capability evidence missing from unified registry: %',v_missing_chat; end if;

  select count(*) into v_missing_media
  from public.suly_media_model_capability_evidence e
  left join public.suly_model_registry r on r.provider_id=e.provider_id and r.service_type=e.service_type and r.model_identifier=e.model_identifier
  left join public.suly_model_capabilities c on c.model_id=r.id and c.capability_key=e.capability_key
  where r.id is null or c.model_id is null;
  if v_missing_media>0 then raise exception 'media capability evidence missing from unified registry: %',v_missing_media; end if;

  select count(*) into v_unreviewed_approved
  from public.suly_model_capabilities
  where review_status='approved'
    and provenance->>'source' in ('provider_model_discovery','media_service_catalog','existing_model_catalog','existing_media_catalog');
  if v_unreviewed_approved>0 then
    raise exception 'discovery suggestions must never be auto-approved: %',v_unreviewed_approved;
  end if;
end;
$$;

rollback;
