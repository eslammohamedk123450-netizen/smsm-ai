-- Expose only caller-owned task status through RLS and invoker rights.
alter table public.agent_task_jobs add column if not exists task_id uuid;
update public.agent_task_jobs
set task_id = case
  when jsonb_typeof(payload->'task_id') = 'string'
   and (payload->>'task_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then (payload->>'task_id')::uuid
  else null
end
where task_id is null;
create index if not exists agent_task_jobs_user_task_idx on public.agent_task_jobs(user_id,task_id) where task_id is not null;
drop policy if exists agent_task_jobs_select_own on public.agent_task_jobs;
create policy agent_task_jobs_select_own on public.agent_task_jobs for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.agent_task_jobs from anon,authenticated;
grant select (id,user_id,status,task_id,result,error_code,error_message,updated_at,completed_at) on public.agent_task_jobs to authenticated;
drop function if exists public.get_agent_task_job_status(uuid);
create function public.get_agent_task_job_status(p_job_id uuid)
returns table(job_id uuid,status text,task_id uuid,result jsonb,error_code text,error_message text,updated_at timestamptz,completed_at timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select j.id,j.status,j.task_id,j.result,j.error_code,j.error_message,j.updated_at,j.completed_at
  from public.agent_task_jobs j where j.id = p_job_id limit 1;
$$;
revoke all on function public.get_agent_task_job_status(uuid) from public,anon;
grant execute on function public.get_agent_task_job_status(uuid) to authenticated;
comment on function public.get_agent_task_job_status(uuid) is 'Returns only caller-owned task status using invoker rights and row-level security.';
