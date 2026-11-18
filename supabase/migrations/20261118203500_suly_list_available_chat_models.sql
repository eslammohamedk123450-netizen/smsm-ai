-- Safe authenticated model catalog for direct basic chat.
-- Provider credentials and subscription tiers are never exposed to clients.

create or replace function public.suly_list_available_chat_models()
returns table (
  id integer,
  name text,
  provider_id integer,
  model_identifier text,
  enabled boolean,
  priority integer,
  context_window integer,
  routing_group text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    m.id,
    m.name::text,
    m.provider_id,
    m.model_identifier::text,
    m.enabled,
    m.priority,
    m.context_window,
    m.routing_group::text
  from public.ai_models as m
  join public.ai_providers as p
    on p.id = m.provider_id
   and p.enabled = true
  left join public.ai_model_health as h
    on h.model_id = m.id
  where auth.uid() is not null
    and m.enabled = true
    and m.routing_group <> 'disabled'
    and coalesce(h.auto_restricted, false) = false
  order by m.priority desc, m.id asc
  limit 200;
$function$;

revoke all on function public.suly_list_available_chat_models() from public, anon;
grant execute on function public.suly_list_available_chat_models() to authenticated;
