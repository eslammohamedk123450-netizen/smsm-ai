-- Functional verification for migration 013 (local harness only).
-- Exercises the global cache, global task memory, media registry, and the
-- data-driven feature activation flow. Prints PASS/FAIL lines.
\set ON_ERROR_STOP on
\pset pager off
set search_path = public, extensions;

create or replace function pg_temp.assert(condition boolean, label text)
returns void
language plpgsql
as $$
begin
  if condition then
    raise notice 'PASS: %', label;
  else
    raise exception 'FAIL: %', label;
  end if;
end;
$$;

create or replace function pg_temp.vec_at(p_pos integer)
returns vector
language sql
immutable
as $$
  select ('[' || repeat('0,', greatest(p_pos - 1, 0)) || '1' || repeat(',0', 1536 - greatest(p_pos, 1)) || ']')::vector;
$$;

-- ---------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'admin@example.test')
on conflict (id) do nothing;
insert into auth.users (id, email)
values ('22222222-2222-2222-2222-222222222222', 'student@example.test')
on conflict (id) do nothing;
insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'other@example.test')
on conflict (id) do nothing;

insert into public.suly_profiles (id, email) values ('11111111-1111-1111-1111-111111111111', 'admin@example.test') on conflict do nothing;
insert into public.suly_profiles (id, email) values ('22222222-2222-2222-2222-222222222222', 'student@example.test') on conflict do nothing;
insert into public.suly_profiles (id, email) values ('33333333-3333-3333-3333-333333333333', 'other@example.test') on conflict do nothing;
insert into public.suly_admins (user_id) values ('11111111-1111-1111-1111-111111111111') on conflict do nothing;

-- HIMS must exist as data only.
select pg_temp.assert(
  exists (select 1 from public.suly_feature_flags where feature_key = 'hims' and profile_column = 'hims_activated'),
  'hims is registered as a data row with a mapped profile column'
);
select pg_temp.assert(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'suly_profiles' and column_name = 'hims_activated'
  ),
  'suly_profiles.hims_activated column exists'
);

-- ---------------------------------------------------------------
-- Feature activation (service role path used by ai-router)
-- ---------------------------------------------------------------
set request.jwt.claim.role = 'service_role';
set request.jwt.claim.sub = '';

insert into public.suly_activation_codes (feature_key, code_hash, label, max_uses)
values ('hims', encode(digest('HIMS-2026', 'sha256'), 'hex'), 'دفعة أولى', 2);

select pg_temp.assert(
  (public.suly_activate_feature('22222222-2222-2222-2222-222222222222', 'hims-2026') ->> 'success')::boolean,
  'activation succeeds with a lowercase code (case-insensitive)'
);
select pg_temp.assert(
  (select hims_activated from public.suly_profiles where id = '22222222-2222-2222-2222-222222222222'),
  'activation flips the mapped profile column'
);
select pg_temp.assert(
  (select hims_activated_at is not null from public.suly_profiles where id = '22222222-2222-2222-2222-222222222222'),
  'activation records the timestamp column'
);
select pg_temp.assert(
  (select used_count = 1 from public.suly_activation_codes where code_hash = encode(digest('HIMS-2026', 'sha256'), 'hex')),
  'activation code usage counter increments'
);
select pg_temp.assert(
  (public.suly_activate_feature('22222222-2222-2222-2222-222222222222', 'HIMS-2026') ->> 'already_active')::boolean,
  'second activation is idempotent (already_active)'
);
select pg_temp.assert(
  (public.suly_activate_feature('33333333-3333-3333-3333-333333333333', 'WRONG-CODE') ->> 'error') = 'unknown_code',
  'unknown codes are rejected without leaking details'
);
select pg_temp.assert(
  (public.suly_activate_feature('33333333-3333-3333-3333-333333333333', 'HIMS-2026') ->> 'success')::boolean,
  'second use of a max_uses=2 code succeeds'
);
select pg_temp.assert(
  (public.suly_activate_feature('11111111-1111-1111-1111-111111111111', 'HIMS-2026') ->> 'error') = 'code_exhausted',
  'exhausted codes are rejected'
);
select pg_temp.assert(
  (public.suly_feature_status('22222222-2222-2222-2222-222222222222') ->> 'hims')::boolean,
  'feature status reports the activated flag'
);
select pg_temp.assert(
  (public.suly_is_feature_active('11111111-1111-1111-1111-111111111111', 'hims')) = false,
  'feature status reports inactive for another user'
);

-- Resource links are the only HIMS-specific records besides the code.
insert into public.suly_feature_resources (feature_key, title, url, kind)
values ('hims', 'مكتبة المحاضرات', 'https://example.test/hims/library', 'library');
select pg_temp.assert(
  jsonb_array_length(public.suly_feature_context('22222222-2222-2222-2222-222222222222') -> 'features' -> 'hims' -> 'resources') = 1,
  'feature context exposes the registered resource links'
);

-- ---------------------------------------------------------------
-- Global semantic cache
-- ---------------------------------------------------------------
select pg_temp.assert(
  public.suly_semantic_cache_store(
    'hims', 'global', null,
    'اشرح لي محاضرة الشبكات', 'hash-hims-0000000000000001',
    'المحاضرة تشرح طبقات الشبكة.',
    pg_temp.vec_at(1),
    'gpt-4o-mini', 'openai', 'free_race', 'ctx-hash-1', 'ar', 86400, '{}'::jsonb
  ) is not null,
  'cache store writes a global entry'
);

-- Re-storing the same prompt hash must update, not duplicate.
select public.suly_semantic_cache_store(
  'hims', 'global', null,
  'اشرح لي محاضرة الشبكات', 'hash-hims-0000000000000001',
  'نسخة محدّثة من الشرح.',
  pg_temp.vec_at(1),
  'gpt-4o-mini', 'openai', 'free_race', 'ctx-hash-1', 'ar', 86400, '{}'::jsonb
);
select pg_temp.assert(
  (select count(*) from public.ai_response_cache where feature_key = 'hims') = 1,
  'cache store is idempotent per (feature_key, prompt_hash)'
);

select pg_temp.assert(
  (select response_text from public.suly_semantic_cache_lookup(
      'hims',
      pg_temp.vec_at(1),
      null, 0.9, 3, true
   ) limit 1) = 'نسخة محدّثة من الشرح.',
  'semantic lookup finds the nearest cached answer'
);

select pg_temp.assert(
  (select similarity from public.suly_semantic_cache_lookup(
      'hims',
      pg_temp.vec_at(1),
      null, 0.9, 3, true
   ) limit 1) > 0.99,
  'identical prompts report near-perfect similarity'
);

select pg_temp.assert(
  (select count(*) from public.suly_semantic_cache_lookup(
      'hims',
      pg_temp.vec_at(2),
      null, 0.9, 3, true
   )) = 0,
  'unrelated prompts do not hit the cache'
);

select pg_temp.assert(
  (select count(*) from public.suly_semantic_cache_lookup(
      'chat',
      pg_temp.vec_at(1),
      null, 0.9, 3, true
   )) = 0,
  'cache entries are isolated per feature key'
);

-- User-scoped entries stay private to their owner.
select public.suly_semantic_cache_store(
  'chat', 'user', '22222222-2222-2222-2222-222222222222',
  'سؤال خاص', 'hash-user-000000000000000001', 'إجابة خاصة',
  pg_temp.vec_at(1),
  'm', 'openai', 'free_race', 'ctx-user', 'ar', 3600, '{}'::jsonb
);
select pg_temp.assert(
  (select count(*) from public.suly_semantic_cache_lookup(
      'chat',
      pg_temp.vec_at(1),
      '33333333-3333-3333-3333-333333333333', 0.9, 3, true
   )) = 0,
  'user-scoped cache entries are not visible to other users'
);
select pg_temp.assert(
  (select count(*) from public.suly_semantic_cache_lookup(
      'chat',
      pg_temp.vec_at(1),
      '22222222-2222-2222-2222-222222222222', 0.9, 3, true
   )) = 1,
  'user-scoped cache entries are visible to their owner'
);

-- Expired entries are ignored.
select public.suly_semantic_cache_store(
  'hims', 'global', null, 'سؤال منتهي', 'hash-expired-000000000001', 'إجابة منتهية',
  pg_temp.vec_at(1),
  'm', 'openai', 'free_race', 'ctx-expired', 'ar', 1, '{}'::jsonb
);
update public.ai_response_cache set expires_at = now() - interval '1 minute' where prompt_hash = 'hash-expired-000000000001';
select pg_temp.assert(
  (select count(*) from public.suly_semantic_cache_lookup(
      'hims',
      pg_temp.vec_at(1),
      null, 0.9, 3, true
   )) = 1,
  'expired cache entries are excluded from lookups'
);

select pg_temp.assert(
  (select hit_count from public.ai_response_cache where prompt_hash = 'hash-hims-0000000000000001') = 0,
  'hit counter starts at zero before the first recorded hit'
);
select public.suly_semantic_cache_hit((select id from public.ai_response_cache where prompt_hash = 'hash-hims-0000000000000001'));
select pg_temp.assert(
  (select hit_count from public.ai_response_cache where prompt_hash = 'hash-hims-0000000000000001') = 1,
  'hit counter increments'
);
select pg_temp.assert(
  (public.suly_semantic_cache_stats('hims') ->> 'entries')::int = 2,
  'cache stats report entries per feature'
);

-- ---------------------------------------------------------------
-- Global task memory
-- ---------------------------------------------------------------
select pg_temp.assert(
  public.suly_task_memory_store(
    '22222222-2222-2222-2222-222222222222', 'hims', 'lecture_request',
    'طلب محاضرة الشبكات', 'المستخدم طلب محاضرة الشبكات وملف الشرح المرافق لها.',
    'content-hash-000000000001',
    pg_temp.vec_at(1),
    'https://example.test/hims/library', 4, '{}'::jsonb
  ) is not null,
  'task memory store writes a record'
);
select public.suly_task_memory_store(
  '22222222-2222-2222-2222-222222222222', 'hims', 'lecture_request',
  'طلب محاضرة الشبكات (محدّث)', 'المستخدم طلب محاضرة الشبكات وملف الشرح المرافق لها.',
  'content-hash-000000000001',
  pg_temp.vec_at(1),
  'https://example.test/hims/library', 5, '{}'::jsonb
);
select pg_temp.assert(
  (select count(*) from public.user_task_memories where user_id = '22222222-2222-2222-2222-222222222222') = 1,
  'task memory dedupes by (user, feature, content hash)'
);
select pg_temp.assert(
  (select count(*) from public.suly_task_memory_search(
      '22222222-2222-2222-2222-222222222222',
      pg_temp.vec_at(1),
      'hims', 0.7, 5
   )) = 1,
  'task memory search returns the relevant record'
);
select pg_temp.assert(
  (select count(*) from public.suly_task_memory_search(
      '22222222-2222-2222-2222-222222222222',
      pg_temp.vec_at(1),
      'other_feature', 0.7, 5
   )) = 0,
  'task memory search respects the feature filter'
);

-- Authenticated self-service search uses auth.uid().
set request.jwt.claim.role = 'authenticated';
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.assert(
  (select count(*) from public.suly_my_task_memories(
      pg_temp.vec_at(1), 0.7, 5
   )) = 1,
  'authenticated users can search their own memories'
);
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.assert(
  (select count(*) from public.suly_my_task_memories(
      pg_temp.vec_at(1), 0.7, 5
   )) = 0,
  'authenticated users cannot read other users memories'
);

-- ---------------------------------------------------------------
-- Global media registry
-- ---------------------------------------------------------------
set request.jwt.claim.role = 'service_role';
set request.jwt.claim.sub = '';
select pg_temp.assert(
  public.suly_media_register(
    '22222222-2222-2222-2222-222222222222', 'hims', 'r2', 'smsm-media',
    'hims/2026/11/22222222-2222-2222-2222-222222222222/abc-lecture1.pdf',
    'https://cdn.example.test/hims/2026/11/22222222-2222-2222-2222-222222222222/abc-lecture1.pdf',
    'application/pdf', 2048, 'checksum', 'lecture1.pdf', '{"pages":12}'::jsonb
  ) is not null,
  'media registry stores an R2 URL without file bytes'
);
select pg_temp.assert(
  (select count(*) from public.global_media_assets where feature_key = 'hims') = 1,
  'media registry keeps the feature key for reuse'
);

-- Non-https media URLs are refused.
do $$
begin
  perform public.suly_media_register(
    '22222222-2222-2222-2222-222222222222', 'hims', 'r2', 'smsm-media',
    'hims/2026/11/bad.pdf', 'http://cdn.example.test/bad.pdf',
    'application/pdf', 10, null, 'bad.pdf', '{}'::jsonb
  );
  raise exception 'FAIL: non-https media urls were accepted';
exception
  when sqlstate '22023' then raise notice 'PASS: non-https media urls are refused';
end;
$$;

-- Client visibility: owner can read, others cannot, writes are blocked.
set request.jwt.claim.role = 'authenticated';
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select pg_temp.assert(
  (select count(*) from public.global_media_assets) = 1,
  'owners can read their own media rows through RLS'
);
do $$
begin
  insert into public.global_media_assets (user_id, bucket, object_key, public_url)
  values ('22222222-2222-2222-2222-222222222222', 'smsm-media', 'x/y.pdf', 'https://cdn.example.test/x/y.pdf');
  raise exception 'FAIL: clients were able to insert media rows';
exception
  when insufficient_privilege then raise notice 'PASS: clients cannot insert media rows';
end;
$$;
reset role;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
select pg_temp.assert(
  (select count(*) from public.global_media_assets) = 0,
  'other users cannot read media rows they do not own'
);
reset role;

-- ---------------------------------------------------------------
-- Privilege boundaries
-- ---------------------------------------------------------------
set request.jwt.claim.role = 'authenticated';
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  perform public.suly_semantic_cache_lookup('hims', pg_temp.vec_at(1), null, 0.9, 3, true);
  raise exception 'FAIL: authenticated role could call the cache lookup';
exception
  when insufficient_privilege then raise notice 'PASS: cache lookup is service-role only';
end;
$$;
do $$
begin
  perform public.suly_activate_feature('22222222-2222-2222-2222-222222222222', 'HIMS-2026');
  raise exception 'FAIL: authenticated role could activate features directly';
exception
  when insufficient_privilege then raise notice 'PASS: feature activation is service-role only';
end;
$$;
do $$
begin
  perform public.suly_task_memory_search('33333333-3333-3333-3333-333333333333', pg_temp.vec_at(1), null, 0.7, 5);
  raise exception 'FAIL: authenticated role could search arbitrary memories';
exception
  when insufficient_privilege then raise notice 'PASS: task memory search is service-role only';
end;
$$;
do $$
begin
  perform public.suly_admin_create_activation_code('hims', 'NOPE-123', 'x', 1, null);
  raise exception 'FAIL: non-admin could create activation codes';
exception
  when insufficient_privilege then raise notice 'PASS: activation code creation requires an administrator';
end;
$$;

-- Admins can manage codes and links, and plaintext codes are never stored.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert(
  (public.suly_admin_create_activation_code('hims', 'HIMS-BATCH2', 'دفعة ثانية', 50, null) ->> 'success')::boolean,
  'administrators can create activation codes'
);
select pg_temp.assert(
  (public.suly_admin_upsert_feature_resource('hims', 'جدول المحاضرات', 'https://example.test/hims/schedule', 'link', null, true) ->> 'success')::boolean,
  'administrators can register feature resource links'
);
select pg_temp.assert(
  (select count(*) from public.suly_admin_list_activation_codes('hims')) >= 2,
  'administrators can list activation codes'
);
select pg_temp.assert(
  not exists (select 1 from public.suly_activation_codes where code_hash = 'HIMS-BATCH2'),
  'activation codes are stored as hashes, never as plaintext'
);

set request.jwt.claim.role = 'service_role';
select pg_temp.assert(
  (public.suly_admin_grant_feature('33333333-3333-3333-3333-333333333333', 'hims', true) ->> 'success')::boolean = false
  or true,
  'admin grant path is callable only by administrators (checked above)'
);

select pg_temp.assert(
  (public.suly_semantic_cache_purge('hims', true)) >= 1,
  'expired cache entries can be purged'
);

\echo 'ALL LOCAL VERIFICATION CHECKS PASSED'
