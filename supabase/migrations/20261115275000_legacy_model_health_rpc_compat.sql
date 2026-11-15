-- Keep the legacy CircuitBreaker caller compatible with the canonical model-health ledger.
-- record_ai_model_attempt() already persists the failure and performs auto-restriction.
-- This shim only returns that canonical state; it deliberately does not count the failure twice.
begin;

create or replace function public.record_model_health_failure(
  p_model_id text,
  p_provider text,
  p_model_name text,
  p_failure_type text,
  p_failure_reason text,
  p_response_time_ms integer default null,
  p_status_code integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $compat$
declare
  v_model_id integer;
  v_auto_suspended boolean := false;
  v_failure_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if p_model_id is null or p_model_id !~ '^[0-9]{1,10}$' then
    raise exception 'Invalid model id' using errcode = '22023';
  end if;
  v_model_id := p_model_id::integer;

  if v_model_id <= 0 or not exists (
    select 1 from public.ai_models where id = v_model_id
  ) then
    raise exception 'Model not found' using errcode = 'P0002';
  end if;

  if p_response_time_ms is not null and p_response_time_ms < 0 then
    raise exception 'Invalid response time' using errcode = '22023';
  end if;

  select coalesce(h.auto_restricted, false),
         coalesce(h.consecutive_failures, 0)
    into v_auto_suspended, v_failure_count
  from public.ai_models m
  left join public.ai_model_health h on h.model_id = m.id
  where m.id = v_model_id;

  return jsonb_build_object(
    'auto_suspended', v_auto_suspended,
    'failure_count', v_failure_count
  );
end;
$compat$;

revoke all on function public.record_model_health_failure(text,text,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.record_model_health_failure(text,text,text,text,text,integer,integer)
  to service_role;

comment on function public.record_model_health_failure(text,text,text,text,text,integer,integer) is
  'Compatibility shim for the legacy ai-router CircuitBreaker caller. Failure persistence and auto-restriction are handled by record_ai_model_attempt; this function only returns the canonical health state to avoid duplicate counting.';

commit;
