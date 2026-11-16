create or replace function public.suly_admin_list_media_model_capability_evidence()
returns setof public.suly_media_model_capability_evidence
language plpgsql stable security definer set search_path=public
as $$
begin
  if auth.uid() is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode='42501';
  end if;
  return query select e.* from public.suly_media_model_capability_evidence e
    order by e.service_type,e.model_identifier,e.capability_key;
end;
$$;
revoke all on function public.suly_admin_list_media_model_capability_evidence() from public,anon;
grant execute on function public.suly_admin_list_media_model_capability_evidence() to authenticated;