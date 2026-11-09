-- quick-replies-cache: exact-form repeated chit-chat and previously answered
-- questions, served with zero model calls and zero credit spend.

begin;

create table if not exists public.suly_quick_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_norm text not null check (char_length(question_norm) between 1 and 160),
  question text not null check (char_length(question) between 1 and 160),
  answer text not null check (char_length(answer) between 1 and 700),
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  unique (user_id, question_norm)
);

create index if not exists suly_quick_replies_expiry_idx
  on public.suly_quick_replies (expires_at);

alter table public.suly_quick_replies enable row level security;

drop policy if exists suly_quick_replies_owner_all on public.suly_quick_replies;
create policy suly_quick_replies_owner_all on public.suly_quick_replies
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.suly_quick_replies from anon;
grant select, insert, update, delete on public.suly_quick_replies to authenticated;
grant all on table public.suly_quick_replies to service_role;

-- Lookup returns the stored answer for an identical normalized question, or
-- null when absent/expired. Intended for the service-role router.
create or replace function public.suly_quick_reply_lookup(
  p_user_id uuid,
  p_question_norm text
)
returns text
language sql
security definer
set search_path = public
as $$
  select answer
  from public.suly_quick_replies
  where user_id = p_user_id
    and question_norm = left(p_question_norm, 160)
    and expires_at > now()
  limit 1;
$$;

-- Upsert keeps the freshest answer for the same normalized question.
create or replace function public.suly_quick_reply_store(
  p_user_id uuid,
  p_question_norm text,
  p_question text,
  p_answer text,
  p_ttl_seconds integer default 86400
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.suly_quick_replies
    (user_id, question_norm, question, answer, expires_at)
  values (
    p_user_id,
    left(p_question_norm, 160),
    left(p_question, 160),
    left(p_answer, 700),
    now() + make_interval(secs => greatest(60, least(p_ttl_seconds, 604800)))
  )
  on conflict (user_id, question_norm) do update
    set question = excluded.question,
        answer = excluded.answer,
        expires_at = excluded.expires_at,
        updated_at = now();
end;
$$;

revoke all on function public.suly_quick_reply_lookup(uuid, text) from public, anon;
revoke all on function public.suly_quick_reply_store(uuid, text, text, text, integer) from public, anon;
grant execute on function public.suly_quick_reply_lookup(uuid, text) to authenticated, service_role;
grant execute on function public.suly_quick_reply_store(uuid, text, text, text, integer) to authenticated, service_role;

commit;
