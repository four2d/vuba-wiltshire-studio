-- FOXON Studio: scheduled publishing queue.
-- Apply to the FOXON Supabase project (mpmcxxfowxohghhxrmgm) ONLY, and only with Pete's OK.
-- This migration does NOT create or enable any cron job. See ../cron/foxon-scheduler-cron.sql.
-- Browser clients can only READ the queue. Every write goes through the foxon-social-publish
-- (admin actions) or foxon-social-scheduler (cron) Edge Functions using the service role.

create table if not exists public.studio_publish_schedules(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.studio_posts(id) on delete cascade,
  social_account_id uuid not null references public.studio_social_accounts(id) on delete cascade,
  scheduled_for timestamptz not null,
  display_time_zone text not null default 'Europe/London' check (display_time_zone = 'Europe/London'),
  -- scheduled: waiting; sending: claimed by the scheduler; published: confirmed by provider;
  -- failed: gave up safely, nothing was posted; needs_reconciliation: the provider may or may not
  -- have posted, a human must check the platform; cancelled: removed before sending.
  status text not null default 'scheduled'
    check (status in ('scheduled','sending','published','failed','needs_reconciliation','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  next_attempt_at timestamptz not null,
  claimed_at timestamptz,
  delivery_id uuid references public.studio_publish_deliveries(id) on delete set null,
  external_post_id text,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotency gate 1: one live schedule per post and destination. A post cannot be queued twice
-- for the same account while an earlier entry is waiting, sending, published or unreconciled.
create unique index if not exists studio_publish_schedules_one_live
  on public.studio_publish_schedules(post_id, social_account_id)
  where status in ('scheduled','sending','published','needs_reconciliation');
create index if not exists studio_publish_schedules_due
  on public.studio_publish_schedules(next_attempt_at)
  where status = 'scheduled';
create index if not exists studio_publish_schedules_sending
  on public.studio_publish_schedules(claimed_at)
  where status = 'sending';

alter table public.studio_publish_schedules enable row level security;
revoke all on public.studio_publish_schedules from anon, authenticated;
grant select on public.studio_publish_schedules to authenticated;
drop policy if exists "Studio members read the publishing queue" on public.studio_publish_schedules;
create policy "Studio members read the publishing queue" on public.studio_publish_schedules
  for select to authenticated using (studio_private.studio_role() is not null);

-- Claim due schedules for one scheduler run. FOR UPDATE SKIP LOCKED means two overlapping cron
-- runs can never claim the same row. Also recovers rows stuck in 'sending' (function crash):
--  * if no delivery row exists for that post/account, nothing reached the provider: requeue it;
--  * if a delivery row exists, the provider call may have happened: needs a human to reconcile.
create or replace function public.foxon_claim_due_schedules(batch_size integer default 10)
returns setof public.studio_publish_schedules
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.studio_publish_schedules s
     set status = case when exists (
             select 1 from public.studio_publish_deliveries d
              where d.post_id = s.post_id and d.social_account_id = s.social_account_id)
           then 'needs_reconciliation' else 'scheduled' end,
         last_error = case when exists (
             select 1 from public.studio_publish_deliveries d
              where d.post_id = s.post_id and d.social_account_id = s.social_account_id)
           then 'Scheduler stopped mid-send. Check the platform before doing anything else.'
           else 'Scheduler stopped before sending; requeued.' end,
         claimed_at = null,
         updated_at = now()
   where s.status = 'sending' and s.claimed_at < now() - interval '15 minutes';

  return query
  with claimed as (
    update public.studio_publish_schedules s
       set status = 'sending', claimed_at = now(), attempts = s.attempts + 1, updated_at = now()
     where s.id in (
       select q.id from public.studio_publish_schedules q
        where q.status = 'scheduled' and q.next_attempt_at <= now()
        order by q.next_attempt_at
        limit greatest(1, least(batch_size, 25))
        for update skip locked)
    returning s.*)
  select * from claimed;
end;
$$;
revoke all on function public.foxon_claim_due_schedules(integer) from public, anon, authenticated;
grant execute on function public.foxon_claim_due_schedules(integer) to service_role;
