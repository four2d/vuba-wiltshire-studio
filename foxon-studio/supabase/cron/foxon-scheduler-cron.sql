-- FOXON scheduled publishing: Supabase Cron job. DO NOT RUN without Pete's explicit OK.
-- Prerequisites (all need Pete's OK, see foxon-studio/SCHEDULED-PUBLISHING.md):
--   1. migrations/20261126120000_foxon_scheduled_publishing.sql applied;
--   2. foxon-social-publish and foxon-social-scheduler deployed;
--   3. Edge Function secret FOXON_SCHEDULER_SECRET set, and the SAME value stored in Vault as
--      'foxon_scheduler_secret' (Dashboard > Integrations > Vault). Never paste it into git or chat.
--   4. Vault secret 'foxon_project_url' = https://mpmcxxfowxohghhxrmgm.supabase.co
--   5. Edge Function secret FOXON_SCHEDULER_ENABLED=true when Pete wants posts to actually go out.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'foxon-social-scheduler',
  '* * * * *',  -- every minute, so a 07:30 UK post goes out between 07:30 and 07:31
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'foxon_project_url') || '/functions/v1/foxon-social-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-foxon-scheduler-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'foxon_scheduler_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- To stop it again:  select cron.unschedule('foxon-social-scheduler');
-- Run history:       select * from cron.job_run_details order by start_time desc limit 20;
