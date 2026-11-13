begin;

-- A connector write is an external side effect and cannot be transactionally
-- rolled back with the AI request. Consume its approval before calling the
-- connector so lease recovery/replay can never execute the same approval twice.
alter table public.suly_ai_requests
  add column if not exists connector_approval_consumed boolean not null default false;

create or replace function public.suly_consume_connector_approval(
  p_request_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_request_id is null or p_user_id is null then
    raise exception 'invalid connector approval claim' using errcode = '22023';
  end if;

  update public.suly_ai_requests
    set connector_approval_consumed = true, updated_at = now()
    where request_id = p_request_id
      and user_id = p_user_id
      and status = 'running'
      and connector_approval_consumed = false;
  return found;
end;
$$;

revoke all on function public.suly_consume_connector_approval(uuid, uuid) from public, anon, authenticated;
grant execute on function public.suly_consume_connector_approval(uuid, uuid) to service_role;

commit;
