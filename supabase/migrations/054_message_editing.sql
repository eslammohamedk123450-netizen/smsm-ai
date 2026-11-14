begin;

alter table public.suly_messages
  add column if not exists edited_at timestamptz;

comment on column public.suly_messages.edited_at is
  'Set when a user message is edited in place; assistant response rows remain preserved as history.';

commit;
