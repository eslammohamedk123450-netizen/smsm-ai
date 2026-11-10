begin;

-- A conversation request has one durable lifecycle row. This is not a replacement
-- for task_ledger/workspaces (step bookkeeping) or credit holds (wallet ledger):
-- it binds a request id to its authenticated owner/input and points to its one
-- user-visible assistant result so retries can replay instead of execute again.
alter table public.suly_messages
  add column if not exists request_id uuid;

create unique index if not exists suly_messages_request_id_uidx
  on public.suly_messages (request_id);

create table if not exists public.suly_ai_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.suly_conversations(id) on delete set null,
  user_message_id uuid references public.suly_messages(id) on delete set null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'cancelled')),
  response_message_id uuid references public.suly_messages(id) on delete set null,
  response_text text,
  response_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(response_metadata) = 'object'),
  error_code text,
  lease_expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists suly_ai_requests_user_updated_idx
  on public.suly_ai_requests (user_id, updated_at desc);
create index if not exists suly_ai_requests_status_lease_idx
  on public.suly_ai_requests (status, lease_expires_at);

alter table public.suly_ai_requests enable row level security;
drop policy if exists suly_ai_requests_owner_read on public.suly_ai_requests;
create policy suly_ai_requests_owner_read
  on public.suly_ai_requests for select to authenticated
  using (user_id = auth.uid() or public.suly_is_admin());
revoke all on public.suly_ai_requests from anon, authenticated;
grant all on public.suly_ai_requests to service_role;

create or replace function public.suly_claim_ai_request(
  p_request_id uuid,
  p_user_id uuid,
  p_conversation_id uuid,
  p_user_message_id uuid,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_request public.suly_ai_requests%rowtype;
  v_inserted integer := 0;
  v_message public.suly_messages%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_request_id is null or p_user_id is null
     or p_request_fingerprint is null
     or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid AI request claim' using errcode = '22023';
  end if;
  if p_conversation_id is not null and not exists (
    select 1 from public.suly_conversations c
    where c.id = p_conversation_id and c.user_id = p_user_id
  ) then
    return jsonb_build_object('claimed', false, 'error', 'conversation_access_denied');
  end if;
  if p_user_message_id is not null and not exists (
    select 1 from public.suly_messages m
    where m.id = p_user_message_id
      and m.user_id = p_user_id
      and m.role = 'user'
      and (p_conversation_id is null or m.conversation_id = p_conversation_id)
  ) then
    return jsonb_build_object('claimed', false, 'error', 'user_message_access_denied');
  end if;

  insert into public.suly_ai_requests (
    request_id, user_id, conversation_id, user_message_id,
    request_fingerprint, status, lease_expires_at
  ) values (
    p_request_id, p_user_id, p_conversation_id, p_user_message_id,
    p_request_fingerprint, 'running', now() + interval '5 minutes'
  ) on conflict (request_id) do nothing;
  get diagnostics v_inserted = row_count;

  select * into v_request
  from public.suly_ai_requests
  where request_id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'error', 'request_claim_unavailable');
  end if;
  if v_request.user_id <> p_user_id
     or v_request.conversation_id is distinct from p_conversation_id
     or v_request.user_message_id is distinct from p_user_message_id
     or v_request.request_fingerprint <> p_request_fingerprint then
    return jsonb_build_object('claimed', false, 'error', 'request_id_conflict');
  end if;
  if v_inserted = 1 then
    return jsonb_build_object('claimed', true, 'status', 'running');
  end if;
  if v_request.status = 'completed' then
    return jsonb_build_object(
      'claimed', false,
      'already_completed', true,
      'status', v_request.status,
      'response_message_id', v_request.response_message_id,
      'response_text', v_request.response_text,
      'response_metadata', v_request.response_metadata
    );
  end if;
  if v_request.status = 'running' and v_request.lease_expires_at <= now() then
    -- Recover work after an Edge Function crash. The five-minute lease is
    -- longer than configured model timeouts; all final writes remain fenced by
    -- the unique request_id on suly_messages and this status row.
    update public.suly_ai_requests
      set lease_expires_at = now() + interval '5 minutes', updated_at = now()
      where request_id = p_request_id;
    return jsonb_build_object('claimed', true, 'status', 'running', 'recovered', true);
  end if;
  if v_request.status = 'running' then
    -- Recover the narrow crash window after the assistant row was saved but
    -- before the request lifecycle was finalized.
    select * into v_message
    from public.suly_messages
    where request_id = p_request_id and role = 'assistant'
      and user_id = p_user_id
    limit 1;
    if found then
      update public.suly_ai_requests
        set status = 'completed', response_message_id = v_message.id,
            response_text = null, completed_at = coalesce(completed_at, now()),
            updated_at = now(), lease_expires_at = now()
        where request_id = p_request_id;
      return jsonb_build_object(
        'claimed', false,
        'already_completed', true,
        'status', 'completed',
        'response_message_id', v_message.id,
        'response_text', null,
        'response_metadata', v_request.response_metadata
      );
    end if;
    return jsonb_build_object('claimed', false, 'in_progress', true, 'status', 'running');
  end if;
  return jsonb_build_object(
    'claimed', false,
    'terminal', true,
    'status', v_request.status,
    'error_code', v_request.error_code,
    'response_message_id', v_request.response_message_id,
    'response_text', v_request.response_text,
    'response_metadata', v_request.response_metadata
  );
end;
$$;
revoke all on function public.suly_claim_ai_request(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.suly_claim_ai_request(uuid, uuid, uuid, uuid, text) to service_role;

create or replace function public.suly_finish_ai_request(
  p_request_id uuid,
  p_user_id uuid,
  p_status text,
  p_response_message_id uuid default null,
  p_response_text text default null,
  p_response_metadata jsonb default '{}'::jsonb,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_request public.suly_ai_requests%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_request_id is null or p_user_id is null
     or p_status not in ('completed', 'failed', 'cancelled')
     or coalesce(jsonb_typeof(p_response_metadata), 'null') <> 'object' then
    raise exception 'invalid AI request finalization' using errcode = '22023';
  end if;
  select * into v_request from public.suly_ai_requests
  where request_id = p_request_id and user_id = p_user_id
  for update;
  if not found then
    return jsonb_build_object('finalized', false, 'error', 'request_not_found');
  end if;
  if v_request.status = 'completed' then
    return jsonb_build_object('finalized', false, 'already_completed', true,
      'response_message_id', v_request.response_message_id);
  end if;
  if v_request.status <> 'running' then
    return jsonb_build_object('finalized', false, 'status', v_request.status);
  end if;
  if p_response_message_id is not null and not exists (
    select 1 from public.suly_messages m
    where m.id = p_response_message_id
      and m.request_id = p_request_id
      and m.user_id = p_user_id
      and m.role = 'assistant'
  ) then
    raise exception 'response message does not belong to this AI request' using errcode = '23514';
  end if;
  if p_status = 'completed' and p_response_message_id is null
     and (p_response_text is null or length(p_response_text) = 0) then
    raise exception 'completed AI request requires a persisted response' using errcode = '23514';
  end if;
  update public.suly_ai_requests
    set status = p_status,
        response_message_id = coalesce(p_response_message_id, response_message_id),
        response_text = case when p_response_message_id is null then p_response_text else null end,
        response_metadata = coalesce(p_response_metadata, '{}'::jsonb),
        error_code = case when p_status = 'completed' then null else left(p_error_code, 120) end,
        updated_at = now(),
        completed_at = case when p_status in ('completed', 'failed', 'cancelled') then now() else null end,
        lease_expires_at = now()
    where request_id = p_request_id and user_id = p_user_id;
  return jsonb_build_object('finalized', true, 'status', p_status);
end;
$$;
revoke all on function public.suly_finish_ai_request(uuid, uuid, text, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.suly_finish_ai_request(uuid, uuid, text, uuid, text, jsonb, text) to service_role;

-- Brain usage reservations are task-scoped. Reusing a task id for another
-- owner, or rerunning an in-progress task, must never authorize another worker
-- sequence. Completed tasks are replayed by brain-router from final_response.
alter table public.brain_task_contexts
  add column if not exists final_response text;

create or replace function public.brain_reserve_usage(p_user_id uuid, p_task_id uuid, p_tokens integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_plan public.plans%rowtype;
  v_usage public.brain_usage_daily%rowtype;
  v_event public.brain_usage_events%rowtype;
  v_tier text;
  v_date date := current_date;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_task_id is null or p_tokens is null or p_tokens < 1 or p_tokens > 100000000 then
    raise exception 'invalid usage reservation' using errcode = '22023';
  end if;
  select * into v_event from public.brain_usage_events where task_id = p_task_id for update;
  if found then
    if v_event.user_id <> p_user_id then
      return jsonb_build_object('allowed', false, 'error', 'task_id_conflict');
    end if;
    if v_event.status = 'completed' then
      return jsonb_build_object('allowed', true, 'already_completed', true,
        'actual_tokens', v_event.actual_tokens, 'status', v_event.status);
    end if;
    if v_event.status = 'reserved' then
      return jsonb_build_object('allowed', false, 'error', 'task_in_progress',
        'reserved_tokens', v_event.reserved_tokens);
    end if;
    return jsonb_build_object('allowed', false, 'error', 'task_failed', 'status', v_event.status);
  end if;
  select lower(coalesce(subscription_tier, 'free')) into v_tier
  from public.suly_profiles where id = p_user_id;
  if not found then raise exception 'application profile is missing' using errcode = 'P0002'; end if;
  select * into v_plan from public.plans
  where name = case when v_tier = 'pro' then 'pro' when v_tier in ('max','ultra') then 'max' else 'free' end
  limit 1;
  if not found then raise exception 'brain plan is not configured' using errcode = '55000'; end if;
  insert into public.brain_usage_daily(user_id, usage_date)
  values (p_user_id, v_date) on conflict do nothing;
  select * into v_usage from public.brain_usage_daily
  where user_id = p_user_id and usage_date = v_date for update;
  if v_usage.tasks_used >= v_plan.daily_tasks_limit then
    return jsonb_build_object('allowed', false, 'error', 'daily_tasks_limit');
  end if;
  if v_usage.tokens_used + v_usage.tokens_reserved + p_tokens > v_plan.daily_tokens_limit then
    return jsonb_build_object('allowed', false, 'error', 'daily_tokens_limit');
  end if;
  update public.brain_usage_daily
  set tasks_used = tasks_used + 1, tokens_reserved = tokens_reserved + p_tokens
  where user_id = p_user_id and usage_date = v_date;
  insert into public.brain_usage_events(task_id, user_id, usage_date, reserved_tokens)
  values (p_task_id, p_user_id, v_date, p_tokens);
  return jsonb_build_object('allowed', true, 'already_reserved', false,
    'reserved_tokens', p_tokens, 'plan', v_plan.name,
    'daily_tokens_limit', v_plan.daily_tokens_limit);
end;
$$;
revoke all on function public.brain_reserve_usage(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.brain_reserve_usage(uuid, uuid, integer) to service_role;

commit;
