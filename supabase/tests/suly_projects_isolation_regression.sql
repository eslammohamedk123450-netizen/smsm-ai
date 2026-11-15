begin;

select set_config('test.project_user_one', (
  select u.id::text
  from auth.users u join public.suly_profiles p on p.id=u.id
  where p.is_banned=false order by u.created_at limit 1
), true);
select set_config('test.project_user_two', (
  select u.id::text
  from auth.users u join public.suly_profiles p on p.id=u.id
  where p.is_banned=false
    and u.id::text <> current_setting('test.project_user_one')
  order by u.created_at limit 1
), true);

do $precheck$
begin
  if current_setting('test.project_user_one',true) is null
     or current_setting('test.project_user_two',true) is null then
    raise exception 'Two active auth users are required for project isolation regression';
  end if;
end;
$precheck$;

set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('test.project_user_one'),'role','authenticated')::text,
  true
);

insert into public.suly_projects(id,user_id,name)
values (
  '11111111-1111-4111-8111-111111111111',
  current_setting('test.project_user_one')::uuid,
  'Project isolation regression'
);

select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('test.project_user_two'),'role','authenticated')::text,
  true
);

do $test$
declare
  v_visible_count integer;
  v_updated_count integer;
begin
  select count(*) into v_visible_count
  from public.suly_projects
  where id='11111111-1111-4111-8111-111111111111';
  if v_visible_count <> 0 then
    raise exception 'Cross-user project SELECT was not isolated';
  end if;

  update public.suly_projects
  set name='Cross-user mutation'
  where id='11111111-1111-4111-8111-111111111111';
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 0 then
    raise exception 'Cross-user project UPDATE was not isolated';
  end if;

  begin
    insert into public.suly_conversations(user_id,title,project_id)
    values (
      current_setting('test.project_user_two')::uuid,
      'Cross-tenant link regression',
      '11111111-1111-4111-8111-111111111111'
    );
    raise exception 'Cross-user project reference was accepted';
  exception
    when foreign_key_violation then null;
  end;
end;
$test$;

rollback;