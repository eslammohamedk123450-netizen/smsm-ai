-- Persistent, owner-scoped Library folders and favorites.
-- Composite foreign keys prevent cross-owner asset/folder associations.

begin;
create unique index if not exists global_media_assets_id_user_id_uidx
  on public.global_media_assets (id, user_id);

create table if not exists public.suly_media_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suly_media_folders_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint suly_media_folders_id_user_unique unique (id, user_id)
);
create unique index if not exists suly_media_folders_owner_name_uidx
  on public.suly_media_folders (user_id, lower(btrim(name)));

create table if not exists public.suly_media_asset_folders (
  asset_id uuid primary key,
  folder_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint suly_media_asset_folders_asset_owner_fk
    foreign key (asset_id, user_id) references public.global_media_assets (id, user_id) on delete cascade,
  constraint suly_media_asset_folders_folder_owner_fk
    foreign key (folder_id, user_id) references public.suly_media_folders (id, user_id) on delete cascade
);
create index if not exists suly_media_asset_folders_folder_idx
  on public.suly_media_asset_folders (user_id, folder_id);

create table if not exists public.suly_media_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, asset_id),
  constraint suly_media_favorites_asset_owner_fk
    foreign key (asset_id, user_id) references public.global_media_assets (id, user_id) on delete cascade
);
create index if not exists suly_media_favorites_asset_idx on public.suly_media_favorites (asset_id);

alter table public.suly_media_folders enable row level security;
alter table public.suly_media_asset_folders enable row level security;
alter table public.suly_media_favorites enable row level security;

revoke all on public.suly_media_folders, public.suly_media_asset_folders, public.suly_media_favorites
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.suly_media_folders, public.suly_media_asset_folders, public.suly_media_favorites
  to authenticated;
grant all
  on public.suly_media_folders, public.suly_media_asset_folders, public.suly_media_favorites
  to service_role;

drop policy if exists suly_media_folders_owner_all on public.suly_media_folders;
create policy suly_media_folders_owner_all on public.suly_media_folders
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists suly_media_asset_folders_owner_all on public.suly_media_asset_folders;
create policy suly_media_asset_folders_owner_all on public.suly_media_asset_folders
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists suly_media_favorites_owner_all on public.suly_media_favorites;
create policy suly_media_favorites_owner_all on public.suly_media_favorites
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

comment on table public.suly_media_folders is
  'User-owned flat Library folders; ownership is enforced by RLS and composite foreign keys.';
comment on table public.suly_media_asset_folders is
  'One-folder-per-asset membership, scoped to the same owner as both folder and asset.';
comment on table public.suly_media_favorites is
  'Owner-scoped favorite markers for Library assets.';
commit;