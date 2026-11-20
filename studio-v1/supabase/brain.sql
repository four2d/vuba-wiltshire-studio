-- Vuba Brain schema, deployed 2026-11-20.
-- Run after schema.sql and workspace.sql in fresh installs.
create table if not exists public.studio_brain_entries (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(trim(title)) between 2 and 180),
 body text not null check (length(trim(body)) between 5 and 20000),
 category text not null check (category in ('Brand','Audience','Operations','Marketing','Website','Product','Team','Open question','Other')),
 verification text not null default 'needs_review' check (verification in ('needs_review','approved','superseded')),
 source_label text not null default '',
 source_path text not null default '',
 source_date date,
 notes text not null default '',
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists studio_brain_category_idx on public.studio_brain_entries(category,verification);
alter table public.studio_brain_entries enable row level security;
revoke all on public.studio_brain_entries from anon;
grant select,insert,update on public.studio_brain_entries to authenticated;
create policy "Team members can read Vuba Brain" on public.studio_brain_entries for select to authenticated
 using(studio_private.studio_role() is not null);
create policy "Team members can submit Brain information" on public.studio_brain_entries for insert to authenticated
 with check(studio_private.studio_role() in ('admin','editor','approver')
 and (verification='needs_review' or studio_private.studio_role() in ('admin','approver'))
 and (created_by=(select auth.uid()) or created_by is null));
create policy "Only leads can review and update Brain" on public.studio_brain_entries for update to authenticated
 using(studio_private.studio_role() in ('admin','approver'))
 with check(studio_private.studio_role() in ('admin','approver') and updated_by=(select auth.uid()));
create or replace function public.studio_brain_set_updated_at() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin new.updated_at=now();return new;end;$$;
revoke all on function public.studio_brain_set_updated_at() from public,anon;
create trigger studio_brain_updated before update on public.studio_brain_entries
 for each row execute function public.studio_brain_set_updated_at();

-- Imported content is seeded separately from private repository source documents,
-- with verification=needs_review. Never embed private GitHub credentials in frontend.
