create or replace function public.suly_admin_set_provider_lifecycle(
  p_provider_id integer,
  p_enabled boolean,
  p_hide_models boolean default true
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  update public.ai_providers
  set enabled = coalesce(p_enabled, false), updated_at = now()
  where id = p_provider_id;

  if not found then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;

  if not coalesce(p_enabled, false) then
    update public.ai_route_model_assignments a
    set enabled = false, updated_at = now()
    from public.ai_models m
    where a.model_id = m.id and m.provider_id = p_provider_id;

    update public.suly_model_profile_models a
    set enabled = false, updated_at = now()
    from public.ai_models m
    where a.model_id = m.id and m.provider_id = p_provider_id;

    update public.suly_media_generation_models
    set is_active = false, is_default = false, updated_at = now()
    where provider_id = p_provider_id;

    update public.ai_router_settings s
    set gmail_task_model_id = case when gmail_task_model_id in
          (select id from public.ai_models where provider_id = p_provider_id) then null else gmail_task_model_id end,
        agent_planner_model_id = case when agent_planner_model_id in
          (select id from public.ai_models where provider_id = p_provider_id) then null else agent_planner_model_id end,
        agent_summarizer_model_id = case when agent_summarizer_model_id in
          (select id from public.ai_models where provider_id = p_provider_id) then null else agent_summarizer_model_id end,
        updated_at = now()
    where id = 1;
  end if;
end;
$$;
