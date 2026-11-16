-- Feature flag registry client-write isolation regression.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.suly_feature_flags'::regclass) then
    raise exception 'feature flags table must keep RLS enabled';
  end if;
  if not has_table_privilege('authenticated','public.suly_feature_flags','select') then
    raise exception 'authenticated users must retain active feature flag reads';
  end if;
  if has_table_privilege('authenticated','public.suly_feature_flags','insert')
     or has_table_privilege('authenticated','public.suly_feature_flags','update')
     or has_table_privilege('authenticated','public.suly_feature_flags','delete')
     or has_table_privilege('authenticated','public.suly_feature_flags','truncate')
     or has_table_privilege('authenticated','public.suly_feature_flags','trigger')
     or has_table_privilege('anon','public.suly_feature_flags','insert')
     or has_table_privilege('anon','public.suly_feature_flags','update')
     or has_table_privilege('anon','public.suly_feature_flags','delete') then
    raise exception 'client DML privileges must be revoked';
  end if;
  if not has_table_privilege('service_role','public.suly_feature_flags','insert')
     or not has_table_privilege('service_role','public.suly_feature_flags','update')
     or not has_table_privilege('service_role','public.suly_feature_flags','delete') then
    raise exception 'service_role must retain feature flag administration access';
  end if;
  if not has_function_privilege('authenticated','public.suly_admin_grant_feature(uuid,text,boolean)','execute') then
    raise exception 'guarded admin RPC must remain callable for authorized admins';
  end if;
  if pg_get_functiondef('public.suly_admin_grant_feature(uuid,text,boolean)'::regprocedure) not ilike '%suly_is_admin%' then
    raise exception 'feature grant RPC must retain its administrator guard';
  end if;
end;
$$;
select 'PASS: feature flag reads retained, client writes revoked, service/admin paths preserved' as result;
