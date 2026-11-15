-- Reconcile terminal Agent jobs through the canonical atomic wallet + Brain settlement wrapper.
create or replace function public.settle_terminal_agent_task_usage_batch(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job record;
  v_result jsonb;
  v_settled integer := 0;
  v_pending integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  for v_job in
    select j.id, j.task_id, j.user_id
      from public.agent_task_jobs j
     where j.task_id is not null
       and j.status in ('completed', 'failed', 'cancelled')
       and (
         exists (
           select 1 from public.suly_credit_holds h
            where h.task_id = j.task_id and h.user_id = j.user_id
              and h.status in ('held', 'settled')
         )
         or exists (
           select 1 from public.brain_usage_events b
            where b.task_id = j.task_id and b.user_id = j.user_id
              and b.status = 'reserved'
         )
       )
     order by j.updated_at asc
     for update of j skip locked
     limit greatest(1, least(coalesce(p_limit, 50), 200))
  loop
    v_result := public.finalize_agent_task_usage(v_job.id, v_job.task_id, v_job.user_id);
    if coalesce((v_result->>'finalized')::boolean, false) then
      v_settled := v_settled + 1;
    else
      v_pending := v_pending + 1;
    end if;
  end loop;

  return jsonb_build_object('settled', v_settled, 'pending', v_pending);
end;
$function$;

revoke all on function public.settle_terminal_agent_task_usage_batch(integer) from public, anon, authenticated;
grant execute on function public.settle_terminal_agent_task_usage_batch(integer) to service_role;
