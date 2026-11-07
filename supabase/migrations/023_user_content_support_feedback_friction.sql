-- Additive private-content, support, feedback, and product-friction schema.
-- Existing external files and their registry rows are preserved.
begin;

create table if not exists public.suly_support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 3 and 160),
  category text not null default 'other' check (category in ('bug','account','billing','content','other')),
  description text not null check (char_length(trim(description)) between 3 and 8000),
  status text not null default 'new' check (status in ('new','in_progress','waiting_user','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists suly_support_tickets_owner_idx on public.suly_support_tickets (user_id, updated_at desc);
create index if not exists suly_support_tickets_status_idx on public.suly_support_tickets (status, created_at desc);
alter table public.suly_support_tickets enable row level security;
revoke all on public.suly_support_tickets from public, anon;
grant select, insert, update on public.suly_support_tickets to authenticated;
create policy suly_support_tickets_owner_select on public.suly_support_tickets
  for select to authenticated using (user_id = auth.uid() or public.suly_is_admin());
create policy suly_support_tickets_owner_insert on public.suly_support_tickets
  for insert to authenticated with check (
    user_id = auth.uid() and status = 'new' and priority = 'normal'
  );
create policy suly_support_tickets_admin_update on public.suly_support_tickets
  for update to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());

create table if not exists public.suly_support_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.suly_support_tickets(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  is_admin_reply boolean not null default false,
  body text not null check (char_length(trim(body)) between 1 and 8000),
  created_at timestamptz not null default now()
);
create index if not exists suly_support_replies_ticket_idx on public.suly_support_replies (ticket_id, created_at);
alter table public.suly_support_replies enable row level security;
revoke all on public.suly_support_replies from public, anon;
grant select, insert on public.suly_support_replies to authenticated;
create policy suly_support_replies_owner_select on public.suly_support_replies
  for select to authenticated using (
    public.suly_is_admin() or exists (
      select 1 from public.suly_support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );
create policy suly_support_replies_insert on public.suly_support_replies
  for insert to authenticated with check (
    sender_id = auth.uid() and (
      (not is_admin_reply and exists (
        select 1 from public.suly_support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid() and t.status not in ('resolved','closed')
      ))
      or (is_admin_reply and public.suly_is_admin())
    )
  );

create table if not exists public.suly_message_feedback (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message_id uuid not null references public.suly_messages(id) on delete cascade,
  reaction text not null check (reaction in ('like','dislike')),
  reason text check (reason is null or reason in ('incorrect','unclear','irrelevant','unsafe','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index if not exists suly_message_feedback_created_idx on public.suly_message_feedback (created_at desc);
alter table public.suly_message_feedback enable row level security;
revoke all on public.suly_message_feedback from public, anon;
grant select, insert, update, delete on public.suly_message_feedback to authenticated;
create policy suly_message_feedback_owner_read on public.suly_message_feedback
  for select to authenticated using (user_id = auth.uid() or public.suly_is_admin());
create policy suly_message_feedback_owner_insert on public.suly_message_feedback
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.suly_messages m
      join public.suly_conversations c on c.id = m.conversation_id
      where m.id = message_id and m.user_id = auth.uid() and m.role = 'assistant' and c.user_id = auth.uid()
    )
  );
create policy suly_message_feedback_owner_update on public.suly_message_feedback
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists (
      select 1 from public.suly_messages m
      join public.suly_conversations c on c.id = m.conversation_id
      where m.id = message_id and m.user_id = auth.uid() and m.role = 'assistant' and c.user_id = auth.uid()
    )
  );
create policy suly_message_feedback_owner_delete on public.suly_message_feedback
  for delete to authenticated using (user_id = auth.uid());

create table if not exists public.suly_friction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid references public.suly_conversations(id) on delete set null,
  event_kind text not null check (event_kind in ('screen_open','task_start','task_stuck','action_failed','response_stopped','upload_failed')),
  feature_key text not null default 'general' check (feature_key in ('chat','support','hims','settings','general')),
  screen_key text not null check (screen_key in ('chat','media','support','settings','hims','other')),
  step_key text check (step_key is null or step_key ~ '^[a-z0-9_]{1,60}$'),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,60}$'),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  created_at timestamptz not null default now()
);
create index if not exists suly_friction_events_recent_idx on public.suly_friction_events (created_at desc, event_kind, screen_key);
alter table public.suly_friction_events enable row level security;
revoke all on public.suly_friction_events from public, anon;
grant insert on public.suly_friction_events to authenticated;
create policy suly_friction_events_owner_insert on public.suly_friction_events
  for insert to authenticated with check (
    user_id = auth.uid() and (conversation_id is null or exists (
      select 1 from public.suly_conversations c where c.id = conversation_id and c.user_id = auth.uid()
    ))
  );

-- Files remain in Cloudinary. Supabase keeps their owner and access context only.
alter table public.global_media_assets alter column storage_provider set default 'cloudinary';
alter table public.global_media_assets alter column public_url drop not null;
alter table public.global_media_assets add column if not exists delivery_type text not null default 'upload'
  check (delivery_type in ('upload','authenticated'));
alter table public.global_media_assets add column if not exists conversation_id uuid
  references public.suly_conversations(id) on delete cascade;
alter table public.global_media_assets add column if not exists message_id uuid
  references public.suly_messages(id) on delete cascade;
alter table public.global_media_assets add column if not exists support_ticket_id uuid
  references public.suly_support_tickets(id) on delete cascade;
alter table public.global_media_assets drop constraint if exists global_media_assets_context_check;
alter table public.global_media_assets add constraint global_media_assets_context_check
  check (support_ticket_id is null or (conversation_id is null and message_id is null));
create index if not exists global_media_assets_conversation_idx on public.global_media_assets (conversation_id, created_at desc) where conversation_id is not null;
create index if not exists global_media_assets_support_ticket_idx on public.global_media_assets (support_ticket_id, created_at desc) where support_ticket_id is not null;
create index if not exists global_media_assets_message_idx on public.global_media_assets (message_id) where message_id is not null;

drop policy if exists global_media_assets_select_admin on public.global_media_assets;
create policy global_media_assets_select_admin on public.global_media_assets
  for select to authenticated using (public.suly_is_admin());

-- Only a verified user may register a server-signed Cloudinary authenticated asset.
create or replace function public.suly_media_register_self_v2(
  p_feature_key text,
  p_resource_type text,
  p_object_key text,
  p_mime_type text,
  p_size_bytes bigint,
  p_original_filename text,
  p_metadata jsonb,
  p_conversation_id uuid default null,
  p_message_id uuid default null,
  p_support_ticket_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_feature text := lower(coalesce(nullif(trim(p_feature_key), ''), 'general'));
  v_id uuid;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_resource_type not in ('image','video','raw') or p_object_key is null
    or p_object_key not like ('suly/' || v_user::text || '/%') then
    raise exception 'invalid cloudinary object' using errcode = '22023';
  end if;
  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 524288000 then
    raise exception 'invalid file size' using errcode = '22023';
  end if;
  if p_conversation_id is not null and not exists (
    select 1 from public.suly_conversations c where c.id = p_conversation_id and c.user_id = v_user
  ) then raise exception 'conversation access denied' using errcode = '42501'; end if;
  if p_message_id is not null and not exists (
    select 1 from public.suly_messages m where m.id = p_message_id and m.user_id = v_user
      and m.role = 'user' and (p_conversation_id is null or m.conversation_id = p_conversation_id)
  ) then raise exception 'message access denied' using errcode = '42501'; end if;
  if p_support_ticket_id is not null and not exists (
    select 1 from public.suly_support_tickets t where t.id = p_support_ticket_id and t.user_id = v_user
  ) then raise exception 'support ticket access denied' using errcode = '42501'; end if;
  if v_feature = 'chat' and p_conversation_id is null then raise exception 'chat files require a conversation' using errcode = '22023'; end if;
  if v_feature = 'support' and p_support_ticket_id is null then raise exception 'support files require a ticket' using errcode = '22023'; end if;
  if v_feature in ('hims','general') and not public.suly_is_admin() then raise exception 'administrator privileges required' using errcode = '42501'; end if;
  if v_feature not in ('chat','support','hims','general') then raise exception 'unsupported media feature' using errcode = '22023'; end if;
  if p_support_ticket_id is not null and (p_conversation_id is not null or p_message_id is not null) then
    raise exception 'a file may belong to a ticket or chat, not both' using errcode = '22023';
  end if;
  insert into public.global_media_assets (
    user_id, feature_key, storage_provider, bucket, object_key, public_url,
    mime_type, size_bytes, original_filename, metadata, delivery_type,
    conversation_id, message_id, support_ticket_id
  ) values (
    v_user, v_feature, 'cloudinary', p_resource_type, left(p_object_key, 1024), null,
    left(p_mime_type, 200), p_size_bytes, left(p_original_filename, 300),
    coalesce(p_metadata, '{}'::jsonb), 'authenticated',
    p_conversation_id, p_message_id, p_support_ticket_id
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.suly_media_register_self_v2(text,text,text,text,bigint,text,jsonb,uuid,uuid,uuid) from public, anon;
grant execute on function public.suly_media_register_self_v2(text,text,text,text,bigint,text,jsonb,uuid,uuid,uuid) to authenticated;

-- Admin sees only privacy-minimized aggregates; no raw user-level friction event feed.
create or replace function public.suly_admin_friction_summary(p_days integer default 30)
returns table(event_day date, event_kind text, feature_key text, screen_key text, event_count bigint, user_count bigint, latest_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then raise exception 'administrator privileges required' using errcode = '42501'; end if;
  return query
    select date_trunc('day', e.created_at)::date, e.event_kind, e.feature_key, e.screen_key,
      count(*)::bigint, count(distinct e.user_id)::bigint, max(e.created_at)
    from public.suly_friction_events e
    where e.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days,30),1),90))
    group by 1,2,3,4 order by 1 desc, 5 desc limit 500;
end;
$$;
revoke all on function public.suly_admin_friction_summary(integer) from public, anon;
grant execute on function public.suly_admin_friction_summary(integer) to authenticated;

-- Basic rating aggregates for the admin dashboard; message contents are not returned.
create or replace function public.suly_admin_feedback_summary(p_days integer default 30)
returns table(reaction text, rating_count bigint, latest_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then raise exception 'administrator privileges required' using errcode = '42501'; end if;
  return query
    select f.reaction, count(*)::bigint, max(f.created_at)
    from public.suly_message_feedback f
    where f.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days,30),1),90))
    group by f.reaction order by f.reaction limit 10;
end;
$$;
revoke all on function public.suly_admin_feedback_summary(integer) from public, anon;
grant execute on function public.suly_admin_feedback_summary(integer) to authenticated;

commit;
