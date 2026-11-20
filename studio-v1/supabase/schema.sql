-- Run once in Supabase SQL Editor. Invite staff in Authentication > Users.
create extension if not exists pgcrypto;
create table if not exists public.studio_members(
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','editor','approver')),
 created_at timestamptz not null default now()
);
create table if not exists public.studio_posts(
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 1 and 140),
 scheduled_date date not null,
 channel text not null check(channel in ('Instagram','Facebook','LinkedIn')),
 pillar text not null,
 format text not null default 'Single image',
 series text,
 status text not null default 'idea' check(status in ('idea','draft','review','approved','scheduled')),
 caption text not null default '',
 source_notes text not null default '',
 created_by uuid not null references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists studio_posts_date_idx on public.studio_posts(scheduled_date);
alter table public.studio_members enable row level security;
alter table public.studio_posts enable row level security;
revoke all on public.studio_members from anon;
revoke all on public.studio_posts from anon;
grant select on public.studio_members to authenticated;
grant select, insert, update, delete on public.studio_posts to authenticated;
create schema if not exists studio_private;
revoke all on schema studio_private from public;
grant usage on schema studio_private to authenticated;
create or replace function studio_private.studio_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.studio_members where user_id=(select auth.uid())
$$;
revoke all on function studio_private.studio_role() from public, anon;
grant execute on function studio_private.studio_role() to authenticated;
create policy "Members read own membership" on public.studio_members for select to authenticated using (user_id=(select auth.uid()));
create policy "Members read posts" on public.studio_posts for select to authenticated using (studio_private.studio_role() is not null);
create policy "Members create ideas and drafts" on public.studio_posts for insert to authenticated with check(
 studio_private.studio_role() in ('admin','editor','approver') and created_by=(select auth.uid()) and updated_by=(select auth.uid())
 and (status in ('idea','draft','review') or studio_private.studio_role() in ('admin','approver'))
);
create policy "Members edit posts" on public.studio_posts for update to authenticated
 using(studio_private.studio_role() in ('admin','editor','approver'))
 with check(studio_private.studio_role() in ('admin','editor','approver') and updated_by=(select auth.uid()));
create policy "Admins delete posts" on public.studio_posts for delete to authenticated using(studio_private.studio_role()='admin');
-- Database-enforced approval transition. UI controls alone are not security.
create or replace function public.enforce_studio_post_transition() returns trigger language plpgsql security invoker as $$
begin
 if tg_op='UPDATE' then
  if (new.status in ('approved','scheduled') or old.status in ('approved','scheduled'))
   and studio_private.studio_role() not in ('admin','approver') then
    raise exception 'Only approvers may modify approved or scheduled posts';
  end if;
  if new.created_by<>old.created_by then raise exception 'Creator cannot be changed'; end if;
 end if;
 if new.status in ('approved','scheduled') and length(trim(new.caption))=0 then
  raise exception 'Approved posts require a caption';
 end if;
 new.updated_at=now();return new;
end $$;
revoke all on function public.enforce_studio_post_transition() from public, anon;
alter function public.enforce_studio_post_transition() set search_path = '';
drop trigger if exists studio_post_transition on public.studio_posts;
create trigger studio_post_transition before insert or update on public.studio_posts for each row execute function public.enforce_studio_post_transition();
-- Initial administrator: replace with actual auth.users UUID after inviting the user.
-- insert into public.studio_members(user_id,role) values ('UUID-HERE','admin');
