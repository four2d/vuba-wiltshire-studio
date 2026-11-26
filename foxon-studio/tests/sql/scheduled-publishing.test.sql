-- Local test of migrations/20261126120000_foxon_scheduled_publishing.sql against a throwaway database.
-- Run: foxon-studio/tests/sql/run.sh  (needs a local PostgreSQL; never point it at Supabase)
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.studio_members values ('00000000-0000-4000-8000-000000000001','admin');
insert into public.studio_posts(id,title) values ('10000000-0000-4000-8000-000000000001','a'),('10000000-0000-4000-8000-000000000002','b'),('10000000-0000-4000-8000-000000000003','c');
insert into public.studio_social_accounts(id,platform) values ('20000000-0000-4000-8000-000000000001','LinkedIn');

-- 1. one live schedule per post + destination
insert into public.studio_publish_schedules(post_id,social_account_id,scheduled_for,next_attempt_at,created_by)
values ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()-interval '1 minute','00000000-0000-4000-8000-000000000001');
do $$ begin
  insert into public.studio_publish_schedules(post_id,social_account_id,scheduled_for,next_attempt_at,created_by)
  values ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',now()+interval '1 day',now()+interval '1 day','00000000-0000-4000-8000-000000000001');
  raise exception 'FAIL: duplicate live schedule was allowed';
exception when unique_violation then raise notice 'PASS 1: duplicate live schedule rejected';
end $$;
-- a cancelled entry does not block a new one
update public.studio_publish_schedules set status='cancelled' where post_id='10000000-0000-4000-8000-000000000001';
insert into public.studio_publish_schedules(post_id,social_account_id,scheduled_for,next_attempt_at,created_by)
values ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()-interval '1 minute','00000000-0000-4000-8000-000000000001');
\echo PASS 2: cancelled entry does not block rescheduling
-- a future entry and a due entry for another post
insert into public.studio_publish_schedules(post_id,social_account_id,scheduled_for,next_attempt_at,created_by) values
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',now()+interval '2 days',now()+interval '2 days','00000000-0000-4000-8000-000000000001');

-- 3. claim takes only due rows, once
do $$ declare n int; m int; begin
  select count(*) into n from public.foxon_claim_due_schedules(10);
  select count(*) into m from public.foxon_claim_due_schedules(10);
  if n<>1 or m<>0 then raise exception 'FAIL: claim returned % then %', n, m; end if;
  if (select attempts from public.studio_publish_schedules where status='sending')<>1 then raise exception 'FAIL: attempts not counted'; end if;
  raise notice 'PASS 3: due row claimed exactly once, future row untouched';
end $$;

-- 4. stuck 'sending' row without a delivery is requeued; with a delivery it needs reconciliation
update public.studio_publish_schedules set claimed_at=now()-interval '20 minutes' where status='sending';
select count(*) as reclaimed from public.foxon_claim_due_schedules(10);
do $$ begin
  if not exists (select 1 from public.studio_publish_schedules where status='sending' and post_id='10000000-0000-4000-8000-000000000001')
  then raise exception 'FAIL: stuck row without delivery was not requeued and reclaimed'; end if;
  raise notice 'PASS 4a: stuck row with no delivery requeued';
end $$;
insert into public.studio_publish_deliveries(post_id,social_account_id,status) values ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','sending');
update public.studio_publish_schedules set claimed_at=now()-interval '20 minutes' where status='sending';
select count(*) from public.foxon_claim_due_schedules(10);
do $$ begin
  if (select status from public.studio_publish_schedules where post_id='10000000-0000-4000-8000-000000000001' and status<>'cancelled')<>'needs_reconciliation'
  then raise exception 'FAIL: stuck row with a delivery must need reconciliation'; end if;
  raise notice 'PASS 4b: stuck row with a delivery is never resent';
end $$;
-- needs_reconciliation is still "live", so it blocks a second schedule for the same pair
do $$ begin
  insert into public.studio_publish_schedules(post_id,social_account_id,scheduled_for,next_attempt_at,created_by)
  values ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',now()+interval '1 day',now()+interval '1 day','00000000-0000-4000-8000-000000000001');
  raise exception 'FAIL: schedule allowed while reconciliation pending';
exception when unique_violation then raise notice 'PASS 5: unreconciled entry blocks a new schedule';
end $$;

-- 6. RLS and privileges: members read, nobody writes from the browser roles, claim is service-only
set role authenticated;
select set_config('test.uid','00000000-0000-4000-8000-000000000001',false);
do $$ begin
  if (select count(*) from public.studio_publish_schedules)=0 then raise exception 'FAIL: member cannot read queue'; end if;
  raise notice 'PASS 6a: studio member can read the queue';
end $$;
do $$ begin
  update public.studio_publish_schedules set status='cancelled';
  raise exception 'FAIL: browser role could write';
exception when insufficient_privilege then raise notice 'PASS 6b: browser role cannot write';
end $$;
do $$ begin
  perform public.foxon_claim_due_schedules(1);
  raise exception 'FAIL: browser role could claim';
exception when insufficient_privilege then raise notice 'PASS 6c: browser role cannot claim';
end $$;
select set_config('test.uid','00000000-0000-4000-8000-000000000002',false);
do $$ begin
  if (select count(*) from public.studio_publish_schedules)<>0 then raise exception 'FAIL: non-member can read queue'; end if;
  raise notice 'PASS 6d: non-member sees nothing';
end $$;
reset role;
set role anon;
do $$ begin
  perform 1 from public.studio_publish_schedules;
  raise exception 'FAIL: anon could read';
exception when insufficient_privilege then raise notice 'PASS 6e: anon cannot read';
end $$;
reset role;
\echo ALL SQL TESTS PASSED
