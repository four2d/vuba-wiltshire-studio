-- Deployed 2026-11-20. New organisation fields for the existing private media library.
alter table public.studio_media add column if not exists folder_path text not null default '';
alter table public.studio_media add column if not exists tags text[] not null default '{}';
alter table public.studio_media add column if not exists archived_at timestamptz;
alter table public.studio_media add constraint studio_media_folder_path_check
 check(length(folder_path)<=500 and folder_path !~ '(^/|/$|//|\.\.)') not valid;
alter table public.studio_media validate constraint studio_media_folder_path_check;
create index if not exists studio_media_folder_idx on public.studio_media(folder_path);
create table if not exists public.studio_media_folders(
 id uuid primary key default gen_random_uuid(),
 path text not null unique check(length(path) between 1 and 500 and path !~ '(^/|/$|//|\.\.)'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.studio_media_folders enable row level security;
revoke all on public.studio_media_folders from anon;
grant select,insert on public.studio_media_folders to authenticated;
create policy "Studio team reads media folders" on public.studio_media_folders
 for select to authenticated using(studio_private.studio_role() is not null);
create policy "Studio team adds media folders" on public.studio_media_folders
 for insert to authenticated with check(studio_private.studio_role() in ('admin','approver','editor') and created_by=(select auth.uid()));
update storage.buckets set file_size_limit=47185920,
 allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']
 where id='vuba-approved-media';
-- All uploads remain private and unapproved. Existing studio_media RLS applies.
-- No code automatically exposes or publishes uploaded media.
