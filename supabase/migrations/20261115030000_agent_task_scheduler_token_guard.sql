-- Authenticate the scheduled queue dispatcher without exposing a service-role key.
-- The scheduler token itself is stored separately in Supabase Vault, never in Git.
create or replace function public.verify_agent_task_scheduler_token(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expected text;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 512 then
    return false;
  end if;

  select decrypted_secret
    into v_expected
    from vault.decrypted_secrets
   where name = 'suly_agent_task_scheduler_token'
   limit 1;

  return v_expected is not null and p_token = v_expected;
end;
$$;

revoke all on function public.verify_agent_task_scheduler_token(text) from public, anon, authenticated;
grant execute on function public.verify_agent_task_scheduler_token(text) to service_role;
