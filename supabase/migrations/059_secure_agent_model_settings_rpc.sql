begin;

create or replace function public.suly_get_model_settings()
returns table (
  agent_planner_model_id integer,
  agent_summarizer_model_id integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then
    raise exception 'غير مسموح لك بالوصول';
  end if;

  return query
  select s.agent_planner_model_id, s.agent_summarizer_model_id
  from public.ai_router_settings as s
  where s.id = 1;
end;
$$;

create or replace function public.suly_set_model_settings(
  p_planner_model_id integer,
  p_summarizer_model_id integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then
    raise exception 'غير مسموح لك بالوصول';
  end if;

  if p_planner_model_id is not null and not exists (
    select 1 from public.ai_models as m
    join public.ai_providers as p on p.id = m.provider_id
    where m.id = p_planner_model_id and m.enabled
      and m.routing_group <> 'disabled' and p.enabled
  ) then
    raise exception 'نموذج Planner غير متاح';
  end if;

  if p_summarizer_model_id is not null and not exists (
    select 1 from public.ai_models as m
    join public.ai_providers as p on p.id = m.provider_id
    where m.id = p_summarizer_model_id and m.enabled
      and m.routing_group <> 'disabled' and p.enabled
  ) then
    raise exception 'نموذج Summarizer غير متاح';
  end if;

  update public.ai_router_settings
  set agent_planner_model_id = p_planner_model_id,
      agent_summarizer_model_id = p_summarizer_model_id,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;
end;
$$;

revoke all on function public.suly_get_model_settings() from public, anon;
revoke all on function public.suly_set_model_settings(integer, integer) from public, anon;
grant execute on function public.suly_get_model_settings() to authenticated;
grant execute on function public.suly_set_model_settings(integer, integer) to authenticated;

commit;
