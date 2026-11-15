-- Preserve actual Brain token usage when a task exceeds its initial reservation.
-- The reservation is released once; any overage is recorded and counts toward
-- the user's daily usage so later requests cannot benefit from under-accounting.
alter table public.brain_usage_events
  add column if not exists overage_tokens integer not null default 0
  check (overage_tokens >= 0);

create or replace function public.brain_finalize_usage(
  p_task_id uuid,
  p_actual_tokens integer,
  p_status text default 'completed'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_event public.brain_usage_events%rowtype;
  v_actual integer := greatest(0, coalesce(p_actual_tokens, 0));
  v_overage integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into v_event
    from public.brain_usage_events
   where task_id = p_task_id
   for update;

  if not found then
    raise exception 'usage reservation not found' using errcode = 'P0002';
  end if;

  if v_event.status <> 'reserved' then
    return jsonb_build_object(
      'finalized', false,
      'status', v_event.status,
      'actual_tokens', v_event.actual_tokens,
      'overage_tokens', v_event.overage_tokens
    );
  end if;

  v_overage := greatest(0, v_actual - v_event.reserved_tokens);

  update public.brain_usage_daily
     set tokens_reserved = greatest(0, tokens_reserved - v_event.reserved_tokens),
         tokens_used = tokens_used + v_actual
   where user_id = v_event.user_id
     and usage_date = v_event.usage_date;

  update public.brain_usage_events
     set actual_tokens = v_actual,
         overage_tokens = v_overage,
         status = case when p_status in ('failed', 'completed') then p_status else 'completed' end,
         completed_at = now()
   where task_id = p_task_id;

  return jsonb_build_object(
    'finalized', true,
    'actual_tokens', v_actual,
    'overage_tokens', v_overage,
    'status', case when p_status in ('failed', 'completed') then p_status else 'completed' end
  );
end;
$$;

revoke all on function public.brain_finalize_usage(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.brain_finalize_usage(uuid, integer, text) to service_role;

comment on column public.brain_usage_events.overage_tokens is
  'Actual tokens consumed above the enqueue-time reservation; included in daily tokens_used.';
