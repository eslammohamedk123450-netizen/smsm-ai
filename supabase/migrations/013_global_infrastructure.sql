-- ============================================================
-- Migration 013: Global Infrastructure
-- ============================================================
-- Adds four application-wide layers that every feature (HIMS, university,
-- research, ...) reuses without feature-specific backend code:
--
--   1. ai_response_cache    -- global semantic (vector + text) response cache
--   2. user_task_memories   -- global vector memory for user tasks/requests
--   3. global_media_assets  -- registry of externally stored media (R2 URLs only)
--   4. suly_feature_flags / suly_activation_codes / suly_feature_activations /
--      suly_feature_resources -- generic feature activation driven by DATA.
--
-- HIMS is registered here as a data row (feature_key = 'hims'), never as a
-- hard-coded branch. Adding another feature later means inserting rows, not
-- editing Edge Functions.
--
-- The migration is additive and non-destructive: no table, column, or row that
-- existed before is dropped or rewritten.
-- ============================================================
begin;

create extension if not exists vector with schema public;
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 1) Global semantic response cache
-- ------------------------------------------------------------
create table if not exists public.ai_response_cache (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null default 'general',
  scope text not null default 'global' check (scope in ('global', 'user')),
  user_id uuid references auth.users(id) on delete cascade,
  prompt_text text not null,
  prompt_hash text not null,
  context_hash text,
  response_text text not null,
  embedding public.vector(1536),
  model_identifier text,
  provider_type text,
  routing_group text,
  language text,
  hit_count integer not null default 0 check (hit_count >= 0),
  last_hit_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_response_cache_scope_owner check (
    (scope = 'global' and user_id is null) or (scope = 'user' and user_id is not null)
  )
);

create index if not exists ai_response_cache_feature_created_idx
  on public.ai_response_cache (feature_key, created_at desc);
create index if not exists ai_response_cache_expires_idx
  on public.ai_response_cache (expires_at)
  where expires_at is not null;
create unique index if not exists ai_response_cache_global_prompt_idx
  on public.ai_response_cache (feature_key, prompt_hash)
  where scope = 'global';
create unique index if not exists ai_response_cache_user_prompt_idx
  on public.ai_response_cache (feature_key, user_id, prompt_hash)
  where scope = 'user';
create index if not exists ai_response_cache_embedding_idx
  on public.ai_response_cache using hnsw (embedding public.vector_cosine_ops);

alter table public.ai_response_cache enable row level security;
revoke all on table public.ai_response_cache from public, anon, authenticated;
grant all on table public.ai_response_cache to service_role;
drop policy if exists ai_response_cache_deny_client on public.ai_response_cache;
create policy ai_response_cache_deny_client
  on public.ai_response_cache
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Similarity search over the shared cache. Service-role only: the ai-router
-- calls it, and cached answers must never be readable by browsing clients.
create or replace function public.suly_semantic_cache_lookup(
  p_feature_key text,
  p_embedding public.vector,
  p_user_id uuid default null,
  p_match_threshold double precision default 0.93,
  p_match_count integer default 3,
  p_include_global boolean default true
)
returns table (
  id uuid,
  response_text text,
  similarity double precision,
  model_identifier text,
  provider_type text,
  routing_group text,
  cache_scope text,
  hit_count integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_embedding is null then
    return;
  end if;
  return query
    select
      c.id,
      c.response_text,
      (1 - (c.embedding <=> p_embedding))::double precision as similarity,
      c.model_identifier,
      c.provider_type,
      c.routing_group,
      c.scope,
      c.hit_count,
      c.created_at
    from public.ai_response_cache as c
    where c.feature_key = coalesce(nullif(trim(p_feature_key), ''), 'general')
      and c.embedding is not null
      and (c.expires_at is null or c.expires_at > now())
      and (
        (p_include_global and c.scope = 'global')
        or (p_user_id is not null and c.scope = 'user' and c.user_id = p_user_id)
      )
      and 1 - (c.embedding <=> p_embedding) >= least(greatest(coalesce(p_match_threshold, 0.93), 0), 1)
    order by c.embedding <=> p_embedding
    limit least(greatest(coalesce(p_match_count, 3), 1), 20);
end;
$$;

create or replace function public.suly_semantic_cache_store(
  p_feature_key text,
  p_scope text,
  p_user_id uuid,
  p_prompt_text text,
  p_prompt_hash text,
  p_response_text text,
  p_embedding public.vector,
  p_model_identifier text default null,
  p_provider_type text default null,
  p_routing_group text default null,
  p_context_hash text default null,
  p_language text default null,
  p_ttl_seconds integer default 604800,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_scope text := case when p_scope = 'user' then 'user' else 'global' end;
  v_expires timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_prompt_hash is null or length(p_prompt_hash) < 16 or p_prompt_text is null
    or p_response_text is null or length(trim(p_response_text)) = 0 then
    raise exception 'invalid cache entry' using errcode = '22023';
  end if;
  if v_scope = 'user' and p_user_id is null then
    raise exception 'user scope requires a user id' using errcode = '22023';
  end if;
  v_expires := case
    when p_ttl_seconds is null or p_ttl_seconds <= 0 then null
    else now() + make_interval(secs => least(p_ttl_seconds, 2592000))
  end;
  if v_scope = 'global' then
    insert into public.ai_response_cache (
      feature_key, scope, user_id, prompt_text, prompt_hash, context_hash,
      response_text, embedding, model_identifier, provider_type, routing_group,
      language, expires_at, metadata
    ) values (
      coalesce(nullif(trim(p_feature_key), ''), 'general'), 'global', null,
      left(p_prompt_text, 8000), p_prompt_hash, p_context_hash,
      p_response_text, p_embedding, p_model_identifier, p_provider_type, p_routing_group,
      p_language, v_expires, coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (feature_key, prompt_hash) where scope = 'global'
    do update set
      response_text = excluded.response_text,
      embedding = coalesce(excluded.embedding, public.ai_response_cache.embedding),
      context_hash = excluded.context_hash,
      model_identifier = excluded.model_identifier,
      provider_type = excluded.provider_type,
      routing_group = excluded.routing_group,
      language = excluded.language,
      expires_at = excluded.expires_at,
      metadata = excluded.metadata,
      hit_count = 0,
      last_hit_at = null,
      updated_at = now()
    returning id into v_id;
  else
    insert into public.ai_response_cache (
      feature_key, scope, user_id, prompt_text, prompt_hash, context_hash,
      response_text, embedding, model_identifier, provider_type, routing_group,
      language, expires_at, metadata
    ) values (
      coalesce(nullif(trim(p_feature_key), ''), 'general'), 'user', p_user_id,
      left(p_prompt_text, 8000), p_prompt_hash, p_context_hash,
      p_response_text, p_embedding, p_model_identifier, p_provider_type, p_routing_group,
      p_language, v_expires, coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (feature_key, user_id, prompt_hash) where scope = 'user'
    do update set
      response_text = excluded.response_text,
      embedding = coalesce(excluded.embedding, public.ai_response_cache.embedding),
      context_hash = excluded.context_hash,
      model_identifier = excluded.model_identifier,
      provider_type = excluded.provider_type,
      routing_group = excluded.routing_group,
      language = excluded.language,
      expires_at = excluded.expires_at,
      metadata = excluded.metadata,
      hit_count = 0,
      last_hit_at = null,
      updated_at = now()
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.suly_semantic_cache_hit(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_hits integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  update public.ai_response_cache
  set hit_count = hit_count + 1, last_hit_at = now()
  where id = p_id
  returning hit_count into v_hits;
  return coalesce(v_hits, 0);
end;
$$;

create or replace function public.suly_semantic_cache_stats(p_feature_key text default null)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'entries', count(*),
    'total_hits', coalesce(sum(hit_count), 0),
    'expired', count(*) filter (where expires_at is not null and expires_at <= now())
  )
  from public.ai_response_cache
  where p_feature_key is null or feature_key = p_feature_key;
$$;

create or replace function public.suly_semantic_cache_purge(
  p_feature_key text default null,
  p_expired_only boolean default true
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_removed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  delete from public.ai_response_cache
  where (p_feature_key is null or feature_key = p_feature_key)
    and (not coalesce(p_expired_only, true) or (expires_at is not null and expires_at <= now()));
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

revoke all on function public.suly_semantic_cache_lookup(text, public.vector, uuid, double precision, integer, boolean) from public, anon, authenticated;
revoke all on function public.suly_semantic_cache_store(text, text, uuid, text, text, text, public.vector, text, text, text, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.suly_semantic_cache_hit(uuid) from public, anon, authenticated;
revoke all on function public.suly_semantic_cache_stats(text) from public, anon, authenticated;
revoke all on function public.suly_semantic_cache_purge(text, boolean) from public, anon, authenticated;
grant execute on function public.suly_semantic_cache_lookup(text, public.vector, uuid, double precision, integer, boolean) to service_role;
grant execute on function public.suly_semantic_cache_store(text, text, uuid, text, text, text, public.vector, text, text, text, text, text, integer, jsonb) to service_role;
grant execute on function public.suly_semantic_cache_hit(uuid) to service_role;
grant execute on function public.suly_semantic_cache_stats(text) to service_role;
grant execute on function public.suly_semantic_cache_purge(text, boolean) to service_role;

-- ------------------------------------------------------------
-- 2) Global vector memory for user tasks
-- ------------------------------------------------------------
create table if not exists public.user_task_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null default 'general',
  task_kind text not null default 'task',
  title text,
  content text not null,
  content_hash text not null,
  embedding public.vector(1536),
  source_ref text,
  importance smallint not null default 3 check (importance between 1 and 5),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_task_memories_user_feature_idx
  on public.user_task_memories (user_id, feature_key, created_at desc);
create index if not exists user_task_memories_feature_created_idx
  on public.user_task_memories (feature_key, created_at desc);
create unique index if not exists user_task_memories_user_content_idx
  on public.user_task_memories (user_id, feature_key, content_hash);
create index if not exists user_task_memories_embedding_idx
  on public.user_task_memories using hnsw (embedding public.vector_cosine_ops);

alter table public.user_task_memories enable row level security;
revoke all on table public.user_task_memories from public, anon, authenticated;
grant all on table public.user_task_memories to service_role;
drop policy if exists user_task_memories_deny_client on public.user_task_memories;
create policy user_task_memories_deny_client
  on public.user_task_memories
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.suly_task_memory_store(
  p_user_id uuid,
  p_feature_key text,
  p_task_kind text,
  p_title text,
  p_content text,
  p_content_hash text,
  p_embedding public.vector default null,
  p_source_ref text default null,
  p_importance integer default 3,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_feature text := coalesce(nullif(trim(p_feature_key), ''), 'general');
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_content is null or length(trim(p_content)) = 0
    or p_content_hash is null or length(p_content_hash) < 16 then
    raise exception 'invalid task memory' using errcode = '22023';
  end if;
  insert into public.user_task_memories (
    user_id, feature_key, task_kind, title, content, content_hash,
    embedding, source_ref, importance, metadata
  ) values (
    p_user_id, v_feature, coalesce(nullif(trim(p_task_kind), ''), 'task'),
    left(p_title, 300), left(p_content, 8000), p_content_hash,
    p_embedding, left(p_source_ref, 2048),
    least(greatest(coalesce(p_importance, 3), 1), 5)::smallint, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, feature_key, content_hash)
  do update set
    title = excluded.title,
    content = excluded.content,
    task_kind = excluded.task_kind,
    embedding = coalesce(excluded.embedding, public.user_task_memories.embedding),
    source_ref = excluded.source_ref,
    importance = excluded.importance,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.suly_task_memory_search(
  p_user_id uuid,
  p_embedding public.vector,
  p_feature_key text default null,
  p_match_threshold double precision default 0.72,
  p_match_count integer default 5
)
returns table (
  id uuid,
  feature_key text,
  task_kind text,
  title text,
  content text,
  source_ref text,
  similarity double precision,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_embedding is null then
    return;
  end if;
  return query
    select
      m.id,
      m.feature_key,
      m.task_kind,
      m.title,
      m.content,
      m.source_ref,
      (1 - (m.embedding <=> p_embedding))::double precision as similarity,
      m.created_at
    from public.user_task_memories as m
    where m.user_id = p_user_id
      and m.embedding is not null
      and (p_feature_key is null or m.feature_key = p_feature_key)
      and 1 - (m.embedding <=> p_embedding) >= least(greatest(coalesce(p_match_threshold, 0.72), 0), 1)
    order by m.embedding <=> p_embedding
    limit least(greatest(coalesce(p_match_count, 5), 1), 50);
end;
$$;

-- Authenticated users may search their own memories only (mirrors the
-- get_relevant_memories convention from migration 008).
create or replace function public.suly_my_task_memories(
  query_embedding public.vector,
  match_threshold double precision default 0.72,
  match_count integer default 5
)
returns table (
  id uuid,
  feature_key text,
  task_kind text,
  title text,
  content text,
  similarity double precision,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public, auth
as $$
  select
    m.id,
    m.feature_key,
    m.task_kind,
    m.title,
    m.content,
    (1 - (m.embedding <=> query_embedding))::double precision as similarity,
    m.created_at
  from public.user_task_memories as m
  where m.user_id = auth.uid()
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) >= least(greatest(coalesce(match_threshold, 0.72), 0), 1)
  order by m.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 5), 1), 50);
$$;

revoke all on function public.suly_task_memory_store(uuid, text, text, text, text, text, public.vector, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.suly_task_memory_search(uuid, public.vector, text, double precision, integer) from public, anon, authenticated;
revoke all on function public.suly_my_task_memories(public.vector, double precision, integer) from public, anon;
grant execute on function public.suly_task_memory_store(uuid, text, text, text, text, text, public.vector, text, integer, jsonb) to service_role;
grant execute on function public.suly_task_memory_search(uuid, public.vector, text, double precision, integer) to service_role;
grant execute on function public.suly_my_task_memories(public.vector, double precision, integer) to authenticated;

-- ------------------------------------------------------------
-- 3) Global external media registry (Cloudflare R2 and future drivers)
-- ------------------------------------------------------------
-- Supabase stores only metadata and the public URL. File bytes live in the
-- external object store chosen by the storage strategy.
create table if not exists public.global_media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null default 'general',
  storage_provider text not null default 'r2',
  bucket text not null,
  object_key text not null,
  public_url text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  checksum_sha256 text,
  original_filename text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (storage_provider, bucket, object_key)
);

create index if not exists global_media_assets_user_feature_idx
  on public.global_media_assets (user_id, feature_key, created_at desc);
create index if not exists global_media_assets_feature_created_idx
  on public.global_media_assets (feature_key, created_at desc);

alter table public.global_media_assets enable row level security;
revoke all on table public.global_media_assets from public, anon;
grant select on table public.global_media_assets to authenticated;
grant all on table public.global_media_assets to service_role;

drop policy if exists global_media_assets_select_own on public.global_media_assets;
create policy global_media_assets_select_own
  on public.global_media_assets
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists global_media_assets_no_client_write on public.global_media_assets;
create policy global_media_assets_no_client_write
  on public.global_media_assets
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists global_media_assets_no_client_update on public.global_media_assets;
create policy global_media_assets_no_client_update
  on public.global_media_assets
  for update
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists global_media_assets_no_client_delete on public.global_media_assets;
create policy global_media_assets_no_client_delete
  on public.global_media_assets
  for delete
  to anon, authenticated
  using (false);

create or replace function public.suly_media_register(
  p_user_id uuid,
  p_feature_key text,
  p_storage_provider text,
  p_bucket text,
  p_object_key text,
  p_public_url text,
  p_mime_type text default null,
  p_size_bytes bigint default 0,
  p_checksum_sha256 text default null,
  p_original_filename text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_object_key is null or p_bucket is null or p_public_url is null
    or length(trim(p_object_key)) = 0 or length(trim(p_public_url)) = 0 then
    raise exception 'invalid media asset' using errcode = '22023';
  end if;
  if p_public_url !~* '^https://' then
    raise exception 'media urls must be https' using errcode = '22023';
  end if;
  insert into public.global_media_assets (
    user_id, feature_key, storage_provider, bucket, object_key, public_url,
    mime_type, size_bytes, checksum_sha256, original_filename, metadata
  ) values (
    p_user_id,
    coalesce(nullif(trim(p_feature_key), ''), 'general'),
    coalesce(nullif(trim(p_storage_provider), ''), 'r2'),
    p_bucket,
    left(p_object_key, 1024),
    left(p_public_url, 2048),
    left(p_mime_type, 200),
    greatest(coalesce(p_size_bytes, 0), 0),
    left(p_checksum_sha256, 128),
    left(p_original_filename, 300),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (storage_provider, bucket, object_key)
  do update set
    public_url = excluded.public_url,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    checksum_sha256 = excluded.checksum_sha256,
    metadata = excluded.metadata
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.suly_media_register(uuid, text, text, text, text, text, text, bigint, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.suly_media_register(uuid, text, text, text, text, text, text, bigint, text, text, jsonb) to service_role;

-- ------------------------------------------------------------
-- 4) Generic feature activation (data-driven; HIMS is a row, not code)
-- ------------------------------------------------------------
create table if not exists public.suly_feature_flags (
  feature_key text primary key,
  label text not null,
  profile_column text not null unique,
  activated_at_column text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.suly_activation_codes (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null references public.suly_feature_flags(feature_key) on delete cascade,
  code_hash text not null unique,
  label text,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists suly_activation_codes_feature_idx
  on public.suly_activation_codes (feature_key, is_active);

create table if not exists public.suly_feature_activations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null references public.suly_feature_flags(feature_key) on delete cascade,
  code_id uuid references public.suly_activation_codes(id) on delete set null,
  activated_at timestamptz not null default now(),
  unique (user_id, feature_key)
);

create index if not exists suly_feature_activations_feature_idx
  on public.suly_feature_activations (feature_key, activated_at desc);

create table if not exists public.suly_feature_resources (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null references public.suly_feature_flags(feature_key) on delete cascade,
  title text not null,
  url text not null,
  kind text not null default 'link',
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (feature_key, url)
);

create index if not exists suly_feature_resources_feature_idx
  on public.suly_feature_resources (feature_key, is_active);

-- Register HIMS as data. No Edge Function branches on this key.
insert into public.suly_feature_flags (feature_key, label, profile_column, activated_at_column, description)
values (
  'hims',
  'HIMS - المحتوى الدراسي والمحاضرات',
  'hims_activated',
  'hims_activated_at',
  'يستخدم المخزن الخارجي العالمي والذاكرة الدلالية وأدوات الوكيل العامة.'
)
on conflict (feature_key) do nothing;

alter table public.suly_profiles
  add column if not exists hims_activated boolean not null default false;
alter table public.suly_profiles
  add column if not exists hims_activated_at timestamptz;

alter table public.suly_feature_flags enable row level security;
alter table public.suly_activation_codes enable row level security;
alter table public.suly_feature_activations enable row level security;
alter table public.suly_feature_resources enable row level security;

revoke all on table public.suly_activation_codes from public, anon, authenticated;
revoke all on table public.suly_feature_activations from public, anon, authenticated;
revoke all on table public.suly_feature_flags from public, anon;
revoke all on table public.suly_feature_resources from public, anon;
grant all on table public.suly_activation_codes to service_role;
grant all on table public.suly_feature_activations to service_role;
grant all on table public.suly_feature_flags to service_role;
grant all on table public.suly_feature_resources to service_role;
-- Feature names and resource links are public product metadata; codes are not.
grant select on table public.suly_feature_flags to authenticated;
grant select on table public.suly_feature_resources to authenticated;

drop policy if exists suly_activation_codes_deny_client on public.suly_activation_codes;
create policy suly_activation_codes_deny_client
  on public.suly_activation_codes
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists suly_feature_activations_deny_client on public.suly_feature_activations;
create policy suly_feature_activations_deny_client
  on public.suly_feature_activations
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists suly_feature_flags_read_active on public.suly_feature_flags;
create policy suly_feature_flags_read_active
  on public.suly_feature_flags
  for select
  to authenticated
  using (is_active);

drop policy if exists suly_feature_resources_read_active on public.suly_feature_resources;
create policy suly_feature_resources_read_active
  on public.suly_feature_resources
  for select
  to authenticated
  using (is_active);

-- Activation: validates the code, then flips the mapped profile column using a
-- whitelisted identifier from suly_feature_flags (never user input).
create or replace function public.suly_activate_feature(
  p_user_id uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_code_hash text;
  v_flag public.suly_feature_flags%rowtype;
  v_code public.suly_activation_codes%rowtype;
  v_existing public.suly_feature_activations%rowtype;
  v_column_exists boolean;
  v_activated_at timestamptz := now();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or length(trim(coalesce(p_code, ''))) = 0 or length(p_code) > 200 then
    return jsonb_build_object('success', false, 'error', 'invalid_code');
  end if;
  v_code_hash := encode(digest(upper(trim(p_code)), 'sha256'), 'hex');
  select * into v_code
  from public.suly_activation_codes
  where code_hash = v_code_hash
  for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'unknown_code');
  end if;
  select * into v_flag
  from public.suly_feature_flags
  where feature_key = v_code.feature_key;
  if not found or not v_flag.is_active then
    return jsonb_build_object('success', false, 'error', 'feature_disabled');
  end if;
  if not v_code.is_active then
    return jsonb_build_object('success', false, 'error', 'code_disabled');
  end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'code_expired');
  end if;
  if v_code.max_uses is not null and v_code.used_count >= v_code.max_uses then
    return jsonb_build_object('success', false, 'error', 'code_exhausted');
  end if;
  if not exists (select 1 from public.suly_profiles where id = p_user_id) then
    return jsonb_build_object('success', false, 'error', 'profile_missing');
  end if;
  select * into v_existing
  from public.suly_feature_activations
  where user_id = p_user_id and feature_key = v_flag.feature_key;
  if found then
    return jsonb_build_object(
      'success', true,
      'already_active', true,
      'feature_key', v_flag.feature_key,
      'label', v_flag.label,
      'activated_at', v_existing.activated_at
    );
  end if;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'suly_profiles'
      and column_name = v_flag.profile_column
  ) into v_column_exists;
  if not v_column_exists then
    raise exception 'feature % maps to a missing profile column', v_flag.feature_key using errcode = '42703';
  end if;
  if v_flag.activated_at_column is not null then
    execute format(
      'update public.suly_profiles set %I = true, %I = coalesce(%I, $2), updated_at = now() where id = $1',
      v_flag.profile_column, v_flag.activated_at_column, v_flag.activated_at_column
    ) using p_user_id, v_activated_at;
  else
    execute format(
      'update public.suly_profiles set %I = true, updated_at = now() where id = $1',
      v_flag.profile_column
    ) using p_user_id;
  end if;
  insert into public.suly_feature_activations (user_id, feature_key, code_id, activated_at)
  values (p_user_id, v_flag.feature_key, v_code.id, v_activated_at)
  on conflict (user_id, feature_key) do nothing;
  update public.suly_activation_codes
  set used_count = used_count + 1, last_used_at = now()
  where id = v_code.id;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (
    null,
    'feature_activated',
    'suly_profiles',
    p_user_id::text,
    jsonb_build_object('feature_key', v_flag.feature_key, 'code_id', v_code.id),
    now()
  );
  return jsonb_build_object(
    'success', true,
    'already_active', false,
    'feature_key', v_flag.feature_key,
    'label', v_flag.label,
    'activated_at', v_activated_at
  );
end;
$$;

create or replace function public.suly_feature_status(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_flag record;
  v_value boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    return v_result;
  end if;
  for v_flag in select feature_key, profile_column from public.suly_feature_flags where is_active loop
    execute format('select coalesce(%I, false) from public.suly_profiles where id = $1', v_flag.profile_column)
      into v_value using p_user_id;
    v_result := v_result || jsonb_build_object(v_flag.feature_key, coalesce(v_value, false));
  end loop;
  return v_result;
end;
$$;

create or replace function public.suly_feature_context(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_features jsonb := '{}'::jsonb;
  v_flag record;
  v_value boolean;
  v_resources jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    return jsonb_build_object('features', v_features);
  end if;
  for v_flag in
    select feature_key, label, profile_column
    from public.suly_feature_flags
    where is_active
    order by feature_key
  loop
    execute format('select coalesce(%I, false) from public.suly_profiles where id = $1', v_flag.profile_column)
      into v_value using p_user_id;
    select coalesce(jsonb_agg(jsonb_build_object(
        'title', r.title,
        'url', r.url,
        'kind', r.kind,
        'description', r.description
      ) order by r.created_at), '[]'::jsonb)
    into v_resources
    from public.suly_feature_resources as r
    where r.feature_key = v_flag.feature_key and r.is_active;
    v_features := v_features || jsonb_build_object(
      v_flag.feature_key,
      jsonb_build_object(
        'label', v_flag.label,
        'activated', coalesce(v_value, false),
        'resources', v_resources
      )
    );
  end loop;
  return jsonb_build_object('features', v_features);
end;
$$;

create or replace function public.suly_is_feature_active(p_user_id uuid, p_feature_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_column text;
  v_value boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select profile_column into v_column
  from public.suly_feature_flags
  where feature_key = trim(coalesce(p_feature_key, '')) and is_active;
  if v_column is null then
    return false;
  end if;
  execute format('select coalesce(%I, false) from public.suly_profiles where id = $1', v_column)
    into v_value using p_user_id;
  return coalesce(v_value, false);
end;
$$;

-- Client-safe read: a signed-in user can see which features are active on their
-- own account (needed to render activation state without exposing other users).
create or replace function public.suly_my_feature_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb := '{}'::jsonb;
  v_flag record;
  v_value boolean;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  for v_flag in
    select feature_key, profile_column, label
    from public.suly_feature_flags
    where is_active
    order by feature_key
  loop
    execute format('select coalesce(%I, false) from public.suly_profiles where id = $1', v_flag.profile_column)
      into v_value using v_uid;
    v_result := v_result || jsonb_build_object(
      v_flag.feature_key,
      jsonb_build_object('label', v_flag.label, 'activated', coalesce(v_value, false))
    );
  end loop;
  return v_result;
end;
$$;

revoke all on function public.suly_activate_feature(uuid, text) from public, anon, authenticated;
revoke all on function public.suly_feature_status(uuid) from public, anon, authenticated;
revoke all on function public.suly_feature_context(uuid) from public, anon, authenticated;
revoke all on function public.suly_is_feature_active(uuid, text) from public, anon, authenticated;
revoke all on function public.suly_my_feature_status() from public, anon;
grant execute on function public.suly_activate_feature(uuid, text) to service_role;
grant execute on function public.suly_feature_status(uuid) to service_role;
grant execute on function public.suly_feature_context(uuid) to service_role;
grant execute on function public.suly_is_feature_active(uuid, text) to service_role;
grant execute on function public.suly_my_feature_status() to authenticated;

-- Administrator helpers so activation codes and resource links are managed as
-- data from the admin panel instead of ad-hoc SQL.
create or replace function public.suly_admin_create_activation_code(
  p_feature_key text,
  p_code text,
  p_label text default null,
  p_max_uses integer default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_admin uuid := auth.uid();
  v_feature text := lower(trim(coalesce(p_feature_key, '')));
  v_code text := upper(trim(coalesce(p_code, '')));
  v_id uuid;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if v_feature = '' or v_code = '' or length(v_code) < 6 or length(v_code) > 120 then
    raise exception 'invalid activation code request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suly_feature_flags where feature_key = v_feature) then
    raise exception 'unknown feature key' using errcode = '22023';
  end if;
  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'max_uses must be positive' using errcode = '22023';
  end if;
  insert into public.suly_activation_codes (
    feature_key, code_hash, label, max_uses, expires_at, is_active, created_by
  ) values (
    v_feature,
    encode(digest(v_code, 'sha256'), 'hex'),
    left(p_label, 200),
    p_max_uses,
    p_expires_at,
    true,
    v_admin
  )
  on conflict (code_hash) do update set
    feature_key = excluded.feature_key,
    label = excluded.label,
    max_uses = excluded.max_uses,
    expires_at = excluded.expires_at,
    is_active = true
  returning id into v_id;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (v_admin, 'activation_code_upserted', 'suly_activation_codes', v_id::text,
    jsonb_build_object('feature_key', v_feature, 'label', p_label, 'max_uses', p_max_uses, 'expires_at', p_expires_at),
    now());
  return jsonb_build_object('success', true, 'id', v_id, 'feature_key', v_feature);
end;
$$;

create or replace function public.suly_admin_list_activation_codes(p_feature_key text default null)
returns table (
  id uuid,
  feature_key text,
  label text,
  code_fingerprint text,
  max_uses integer,
  used_count integer,
  expires_at timestamptz,
  is_active boolean,
  last_used_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin uuid := auth.uid();
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query
    select
      c.id,
      c.feature_key,
      c.label,
      left(c.code_hash, 12) as code_fingerprint,
      c.max_uses,
      c.used_count,
      c.expires_at,
      c.is_active,
      c.last_used_at,
      c.created_at
    from public.suly_activation_codes as c
    where p_feature_key is null or c.feature_key = lower(trim(p_feature_key))
    order by c.created_at desc
    limit 200;
end;
$$;

create or replace function public.suly_admin_set_activation_code_active(
  p_code_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin uuid := auth.uid();
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if p_code_id is null or p_is_active is null then
    raise exception 'invalid parameters' using errcode = '22023';
  end if;
  update public.suly_activation_codes
  set is_active = p_is_active
  where id = p_code_id;
  if not found then
    raise exception 'activation code not found' using errcode = 'P0002';
  end if;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (v_admin, 'activation_code_status_changed', 'suly_activation_codes', p_code_id::text,
    jsonb_build_object('is_active', p_is_active), now());
  return jsonb_build_object('success', true, 'id', p_code_id, 'is_active', p_is_active);
end;
$$;

create or replace function public.suly_admin_upsert_feature_resource(
  p_feature_key text,
  p_title text,
  p_url text,
  p_kind text default 'link',
  p_description text default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin uuid := auth.uid();
  v_feature text := lower(trim(coalesce(p_feature_key, '')));
  v_url text := trim(coalesce(p_url, ''));
  v_id uuid;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if v_feature = '' or length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'invalid resource request' using errcode = '22023';
  end if;
  if v_url !~* '^https://' or length(v_url) > 2048 then
    raise exception 'resource urls must be https' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suly_feature_flags where feature_key = v_feature) then
    raise exception 'unknown feature key' using errcode = '22023';
  end if;
  insert into public.suly_feature_resources (feature_key, title, url, kind, description, is_active)
  values (v_feature, left(p_title, 300), v_url, coalesce(nullif(trim(p_kind), ''), 'link'), left(p_description, 1000), coalesce(p_is_active, true))
  on conflict (feature_key, url) do update set
    title = excluded.title,
    kind = excluded.kind,
    description = excluded.description,
    is_active = excluded.is_active
  returning id into v_id;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (v_admin, 'feature_resource_upserted', 'suly_feature_resources', v_id::text,
    jsonb_build_object('feature_key', v_feature, 'url', v_url, 'is_active', p_is_active), now());
  return jsonb_build_object('success', true, 'id', v_id, 'feature_key', v_feature);
end;
$$;

create or replace function public.suly_admin_grant_feature(
  p_user_id uuid,
  p_feature_key text,
  p_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin uuid := auth.uid();
  v_flag public.suly_feature_flags%rowtype;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if p_user_id is null or p_enabled is null then
    raise exception 'invalid parameters' using errcode = '22023';
  end if;
  select * into v_flag
  from public.suly_feature_flags
  where feature_key = lower(trim(coalesce(p_feature_key, '')));
  if not found then
    raise exception 'unknown feature key' using errcode = '22023';
  end if;
  if v_flag.activated_at_column is not null then
    execute format(
      'update public.suly_profiles set %I = $2, %I = case when $2 then coalesce(%I, now()) else null end, updated_at = now() where id = $1',
      v_flag.profile_column, v_flag.activated_at_column, v_flag.activated_at_column
    ) using p_user_id, p_enabled;
  else
    execute format(
      'update public.suly_profiles set %I = $2, updated_at = now() where id = $1',
      v_flag.profile_column
    ) using p_user_id, p_enabled;
  end if;
  if p_enabled then
    insert into public.suly_feature_activations (user_id, feature_key, activated_at)
    values (p_user_id, v_flag.feature_key, now())
    on conflict (user_id, feature_key) do nothing;
  else
    delete from public.suly_feature_activations
    where user_id = p_user_id and feature_key = v_flag.feature_key;
  end if;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (v_admin, case when p_enabled then 'feature_granted' else 'feature_revoked' end,
    'suly_profiles', p_user_id::text,
    jsonb_build_object('feature_key', v_flag.feature_key), now());
  return jsonb_build_object('success', true, 'feature_key', v_flag.feature_key, 'enabled', p_enabled);
end;
$$;

revoke all on function public.suly_admin_create_activation_code(text, text, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.suly_admin_list_activation_codes(text) from public, anon, authenticated;
revoke all on function public.suly_admin_set_activation_code_active(uuid, boolean) from public, anon, authenticated;
revoke all on function public.suly_admin_upsert_feature_resource(text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.suly_admin_grant_feature(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.suly_admin_create_activation_code(text, text, text, integer, timestamptz) to authenticated;
grant execute on function public.suly_admin_list_activation_codes(text) to authenticated;
grant execute on function public.suly_admin_set_activation_code_active(uuid, boolean) to authenticated;
grant execute on function public.suly_admin_upsert_feature_resource(text, text, text, text, text, boolean) to authenticated;
grant execute on function public.suly_admin_grant_feature(uuid, text, boolean) to authenticated;

commit;
