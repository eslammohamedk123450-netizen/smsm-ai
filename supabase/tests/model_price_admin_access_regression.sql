-- Regression check: pricing tables are not writable by client roles,
-- and non-admin authenticated users cannot invoke admin pricing RPCs.
begin;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
declare
  denied_text boolean := false;
  denied_media boolean := false;
begin
  if has_table_privilege(current_user, 'public.ai_model_price_versions', 'insert') then
    raise exception 'authenticated users must not insert text model prices directly';
  end if;
  if has_table_privilege(current_user, 'public.suly_media_model_price_versions', 'insert') then
    raise exception 'authenticated users must not insert media model prices directly';
  end if;
  begin
    perform public.suly_admin_set_ai_model_price(1, 1, 1, 40);
  exception when others then
    if sqlerrm ilike '%admin%' or sqlstate = '42501' then denied_text := true; else raise; end if;
  end;
  begin
    perform public.suly_admin_set_media_model_price(22, 'image', 'test-model', 'image', 'per_image', 1, 40);
  exception when others then
    if sqlerrm ilike '%admin%' or sqlstate = '42501' then denied_media := true; else raise; end if;
  end;
  if not denied_text then raise exception 'non-admin text pricing RPC was not denied'; end if;
  if not denied_media then raise exception 'non-admin media pricing RPC was not denied'; end if;
end;
$$;
reset role;
select 'PASS' as model_price_admin_access_regression;
rollback;
