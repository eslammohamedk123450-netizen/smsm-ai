-- Rollback-only owner-isolation regression for Library folders and favorites.
-- Uses an existing asset and two auth identities, but leaves no persistent rows.
begin;
set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.global_media_assets order by created_at limit 1),
  true
);

insert into public.suly_media_folders(id,user_id,name)
select '00000000-0000-4000-8000-000000000001', user_id, '__library_rls_regression__'
from public.global_media_assets order by created_at limit 1;

insert into public.suly_media_asset_folders(asset_id,folder_id,user_id)
select a.id, f.id, a.user_id
from public.global_media_assets a
join public.suly_media_folders f on f.user_id=a.user_id
where f.id='00000000-0000-4000-8000-000000000001'
order by a.created_at
limit 1;

insert into public.suly_media_favorites(user_id,asset_id)
select user_id, asset_id from public.suly_media_asset_folders
where folder_id='00000000-0000-4000-8000-000000000001';

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.suly_media_folders
  where id='00000000-0000-4000-8000-000000000001';
  if v_count<>1 then raise exception 'library owner cannot read own folder'; end if;
  select count(*) into v_count from public.suly_media_asset_folders
  where folder_id='00000000-0000-4000-8000-000000000001';
  if v_count<>1 then raise exception 'library owner cannot read own folder membership'; end if;
  select count(*) into v_count from public.suly_media_favorites;
  if v_count<>1 then raise exception 'library owner cannot read own favorite'; end if;
end $$;

select set_config('app.library_test_asset_id', (select asset_id::text from public.suly_media_asset_folders where folder_id='00000000-0000-4000-8000-000000000001' limit 1), true);

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users
   where id <> (select user_id from public.suly_media_folders where id='00000000-0000-4000-8000-000000000001')
   order by created_at limit 1),
  true
);

do $$
declare v_count integer; v_rejected boolean := false;
begin
  if auth.uid() is null then raise exception 'second auth identity is required for isolation regression'; end if;
  select count(*) into v_count from public.suly_media_folders
  where id='00000000-0000-4000-8000-000000000001';
  if v_count<>0 then raise exception 'non-owner can read another user folder'; end if;
  select count(*) into v_count from public.suly_media_asset_folders
  where folder_id='00000000-0000-4000-8000-000000000001';
  if v_count<>0 then raise exception 'non-owner can read another user folder membership'; end if;
  select count(*) into v_count from public.suly_media_favorites;
  if v_count<>0 then raise exception 'non-owner can read another user favorites'; end if;
  begin
    insert into public.suly_media_favorites(user_id,asset_id)
    values (auth.uid(), current_setting('app.library_test_asset_id')::uuid);
  exception when foreign_key_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'cross-owner favorite association was not rejected'; end if;
end $$;
rollback;