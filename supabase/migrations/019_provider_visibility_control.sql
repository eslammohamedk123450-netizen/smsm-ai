begin;
create or replace function public.suly_admin_set_provider_lifecycle(p_provider_id integer, p_enabled boolean, p_hide_models boolean default true)
returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$
begin
  if not public.suly_is_admin() then raise exception 'administrator privileges required' using errcode='42501'; end if;
  update public.ai_providers set enabled=coalesce(p_enabled,false),updated_at=now() where id=p_provider_id;
  if not found then raise exception 'provider not found' using errcode='P0002'; end if;
  if coalesce(p_hide_models,true) then
    update public.ai_models set enabled=coalesce(p_enabled,false),routing_group=case when p_enabled then routing_group else 'disabled' end where provider_id=p_provider_id;
  end if;
end;
$$;
revoke all on function public.suly_admin_set_provider_lifecycle(integer,boolean,boolean) from public,anon;
grant execute on function public.suly_admin_set_provider_lifecycle(integer,boolean,boolean) to authenticated;
commit;
