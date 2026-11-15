begin;

do $test$
declare
  v_user_one uuid;
  v_user_two uuid;
  v_project_id uuid;
  v_visible_count integer;
  v_updated_count integer;
begin
  select u.id into v_user_one
  from auth.users u
  join public.suly_profiles p on p.id = u.id
  where p.is_banned = false
  order by u.created_at
  limit 1;

  select u.id into v_user_two
  from auth.users u
  join public.suly_profiles p on p.id = u.id
  where p.is_banned = false and u.id <> v_user_one
  order by u.created_at
  limit 1;

  if v_user_one is null or v_user_two is null then
    raise exception 'Two active auth users are required for project isolation regression';
  end if;

  insert into public.suly_projects(user_id, name)
  values (v_user_one, 'Project isolation regression')
  returning id into v_project_id;

  -- RLS visibility: the second owner cannot read or update the first owner's project.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_user_two::text,'role','authenticated')::text, true);

  select count(*) into v_visible_count
  from public.suly_projects where id = v_project_id;
  if v_visible_count <> 0 then
    raise exception 'Cross-user project SELECT was not isolated';
  end if;

  update public.suly_projects
  set name = 'Cross-user mutation'
  where id = v_project_id;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 0 then
    raise exception 'Cross-user project UPDATE was not isolated';
  end if;

  -- Even an owner-scoped conversation cannot point at another user's project.
  begin
    insert into public.suly_conversations(user_id, title, project_id)
    values (v_user_two, 'Cross-tenant link regression', v_project_id);
    raise exception 'Cross-user project reference was accepted';
  exception
    when foreign_key_violation then null;
  end;
end;
$test$;

rollback;