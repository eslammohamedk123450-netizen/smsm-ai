begin;

-- Re-assert provider-aware summaries after installing the custom page builder.
-- Archived provider models stay out of operational health/catalog counts.
-- Financial, credit, usage, and audit history remain untouched.
create or replace function public.suly_admin_custom_page_source(p_source text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  case p_source
    when 'system_health_summary' then
      select jsonb_build_object(
        'source', p_source,
        'enabled_models', count(*) filter (where m.enabled),
        'healthy_enabled_models', count(*) filter (
          where m.enabled and h.model_id is not null and h.last_status = 'success'
            and coalesce(h.auto_restricted,false)=false
        ),
        'restricted_models', count(*) filter (where m.enabled and coalesce(h.auto_restricted,false)),
        'generated_at', now()
      ) into v_result
      from public.ai_models m
      join public.ai_providers p on p.id=m.provider_id and p.enabled is true
      left join public.ai_model_health h on h.model_id=m.id;

    when 'model_catalog_summary' then
      select jsonb_build_object(
        'source', p_source,
        'enabled_providers', (select count(*) from public.ai_providers where enabled is true),
        'enabled_models', (
          select count(*) from public.ai_models m
          join public.ai_providers p on p.id=m.provider_id
          where p.enabled is true and m.enabled is true
        ),
        'disabled_models', (
          select count(*) from public.ai_models m
          join public.ai_providers p on p.id=m.provider_id
          where p.enabled is true and m.enabled is false
        ),
        'generated_at', now()
      ) into v_result;

    when 'admin_activity_summary' then
      select jsonb_build_object(
        'source', p_source,
        'events_last_24h', (select count(*) from public.admin_audit_logs where created_at >= now() - interval '24 hours'),
        'latest_actions', coalesce((
          select jsonb_agg(jsonb_build_object('action', recent.action, 'created_at', recent.created_at) order by recent.created_at desc)
          from (
            select action, created_at from public.admin_audit_logs
            order by created_at desc limit 5
          ) recent
        ), '[]'::jsonb),
        'generated_at', now()
      ) into v_result;

    else
      raise exception 'unsupported custom page data source' using errcode = '22023';
  end case;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

commit;
