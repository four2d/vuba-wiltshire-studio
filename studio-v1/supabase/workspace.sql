-- Vuba Social Studio workspace expansion.
-- Apply after schema.sql. This project is already updated in Supabase.
alter table public.studio_posts add column if not exists campaign_id uuid;
alter table public.studio_posts add column if not exists media_id uuid;
alter table public.studio_posts add column if not exists review_note text not null default '';
alter table public.studio_posts drop constraint if exists studio_posts_status_check;
alter table public.studio_posts add constraint studio_posts_status_check check(status in ('idea','draft','review','changes_requested','approved','scheduled'));

create table if not exists public.studio_campaigns (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 2 and 140),
 objective text not null default '',
 audience text not null default '',
 key_messages text not null default '',
 success_metrics text not null default '',
 start_date date,end_date date,owner_name text not null default '',
 status text not null default 'planning' check(status in ('planning','active','completed','paused')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 constraint campaign_dates check(end_date is null or start_date is null or end_date>=start_date)
);
create table if not exists public.studio_media (
 id uuid primary key default gen_random_uuid(),
 file_path text not null unique,
 filename text not null,
 description text not null default '',
 usage_rights text not null default '',
 approved boolean not null default false,
 uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 mime_type text not null default 'image/jpeg'
);
create table if not exists public.studio_review_events (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.studio_posts(id) on delete cascade,
 action text not null check(action in ('submitted','changes_requested','approved','returned_to_draft')),
 note text not null default '',
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.studio_posts add constraint studio_posts_campaign_id_fkey foreign key(campaign_id) references public.studio_campaigns(id) on delete set null;
alter table public.studio_posts add constraint studio_posts_media_id_fkey foreign key(media_id) references public.studio_media(id) on delete set null;
create index if not exists studio_posts_campaign_idx on public.studio_posts(campaign_id);
create index if not exists studio_review_events_post_idx on public.studio_review_events(post_id);

alter table public.studio_campaigns enable row level security;
alter table public.studio_media enable row level security;
alter table public.studio_review_events enable row level security;
revoke all on public.studio_campaigns,public.studio_media,public.studio_review_events from anon;
grant select,insert,update on public.studio_campaigns to authenticated;
grant select,insert,update on public.studio_media to authenticated;
grant select on public.studio_review_events to authenticated;

create policy "Staff can read campaigns" on public.studio_campaigns for select to authenticated using(studio_private.studio_role() is not null);
create policy "Leads can create campaigns" on public.studio_campaigns for insert to authenticated with check(studio_private.studio_role() in ('admin','approver') and created_by=(select auth.uid()));
create policy "Leads can update campaigns" on public.studio_campaigns for update to authenticated using(studio_private.studio_role() in ('admin','approver')) with check(studio_private.studio_role() in ('admin','approver'));
create policy "Staff can read media" on public.studio_media for select to authenticated using(studio_private.studio_role() is not null);
create policy "Staff can register uploads" on public.studio_media for insert to authenticated with check(studio_private.studio_role() is not null and uploaded_by=(select auth.uid()) and approved=false and file_path like (select auth.uid())::text||'/%');
create policy "Leads can approve media" on public.studio_media for update to authenticated using(studio_private.studio_role() in ('admin','approver')) with check(studio_private.studio_role() in ('admin','approver'));
create policy "Staff can view review events" on public.studio_review_events for select to authenticated using(studio_private.studio_role() is not null);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('vuba-approved-media','vuba-approved-media',false,10485760,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "Studio team view media objects" on storage.objects for select to authenticated using(bucket_id='vuba-approved-media' and studio_private.studio_role() is not null);
create policy "Studio team upload to own media folder" on storage.objects for insert to authenticated with check(bucket_id='vuba-approved-media' and studio_private.studio_role() is not null and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.enforce_studio_post_transition() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if (new.status in ('approved','scheduled','changes_requested') or old.status in ('approved','scheduled'))
   and studio_private.studio_role() not in ('admin','approver') then
    raise exception 'Only approvers may approve or request changes';
  end if;
  if new.created_by<>old.created_by then raise exception 'Creator cannot be changed'; end if;
 end if;
 if new.status in ('approved','scheduled') and length(trim(new.caption))=0 then
  raise exception 'Approved posts require a caption';
 end if;
 if new.status in ('approved','scheduled') and new.media_id is not null and not exists (
   select 1 from public.studio_media where id=new.media_id and approved=true
 ) then raise exception 'Only approved media can be used on approved posts'; end if;
 new.updated_at=now();return new;
end $$;

create or replace function studio_private.log_studio_review_transition() returns trigger language plpgsql security definer set search_path='' as $
declare review_action text;
begin
 if (select auth.uid()) is null then raise exception 'Authenticated staff required for review transition'; end if;
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
 review_action := case
  when new.status='review' then 'submitted'
  when new.status='changes_requested' then 'changes_requested'
  when new.status='approved' then 'approved'
  when new.status='draft' and tg_op='UPDATE' and old.status='changes_requested' then 'returned_to_draft'
  else null end;
 if review_action is not null then
  insert into public.studio_review_events(post_id,action,note,actor_id)
  values(new.id,review_action,new.review_note,(select auth.uid()));
 end if;
 return new;
end $$;
revoke all on function studio_private.log_studio_review_transition() from public,anon,authenticated;
drop trigger if exists studio_review_transition on public.studio_posts;
create trigger studio_review_transition after insert or update of status on public.studio_posts for each row execute function studio_private.log_studio_review_transition();
