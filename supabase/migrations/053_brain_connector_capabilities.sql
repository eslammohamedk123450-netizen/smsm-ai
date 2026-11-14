begin;

alter table public.capabilities
  drop constraint if exists capabilities_key_check;

alter table public.capabilities
  add constraint capabilities_key_check
  check (key in (
    'text', 'coding', 'image', 'video', 'vision', 'audio', 'reasoning', 'web_search',
    'gmail', 'google_drive', 'github'
  ));

insert into public.capabilities(key, label) values
  ('gmail', 'التعامل مع Gmail'),
  ('google_drive', 'التعامل مع Google Drive'),
  ('github', 'التعامل مع GitHub')
on conflict (key) do update set label = excluded.label;

commit;
