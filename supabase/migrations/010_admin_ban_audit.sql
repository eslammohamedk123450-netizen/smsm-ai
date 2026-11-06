begin;

create or replace function public.suly_admin_set_user_banned(
  p_user_id uuid,
  p_banned boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_admin uuid := auth.uid();
  v_old_banned boolean;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_banned is null then
    raise exception 'Invalid user ban parameters' using errcode = '22023';
  end if;
  if exists (select 1 from public.suly_admins where user_id = p_user_id) then
    raise exception 'Administrator accounts cannot be banned from this panel' using errcode = '42501';
  end if;

  select is_banned into v_old_banned
  from public.suly_profiles
  where id = p_user_id
  for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  update public.suly_profiles
  set is_banned = p_banned, updated_at = now()
  where id = p_user_id;

  if v_old_banned is distinct from p_banned then
    insert into public.admin_audit_logs(
      admin_id, action, target_table, target_id, old_value, new_value, created_at
    ) values (
      v_admin,
      case when p_banned then 'user_banned' else 'user_unbanned' end,
      'suly_profiles',
      p_user_id::text,
      jsonb_build_object('is_banned', v_old_banned),
      jsonb_build_object('is_banned', p_banned),
      now()
    );
  end if;
end;
$$;

revoke all on function public.suly_admin_set_user_banned(uuid, boolean) from public, anon;
grant execute on function public.suly_admin_set_user_banned(uuid, boolean) to authenticated;

commit;
