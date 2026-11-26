# FOXON Studio — scheduled publishing and LinkedIn image posts

Status (26 Nov 2026): **code only, nothing deployed.** The migration is not applied, the functions are not
deployed, no cron job exists and no secrets are set. Each step below needs Pete's own OK.

## What it does
- **Schedule:** in Connections → Posts and activity, an admin picks a destination, a **UK date and time**
  (Europe/London, default **07:30**) and presses **Schedule**. The same typed `PUBLISH` confirmation as
  Publish now is required. The post is stored in `studio_publish_schedules` as `scheduled`.
- **Queue:** "Scheduled posts" lists waiting, sending, failed and unconfirmed entries, plus the last 10
  published/cancelled. Waiting entries can be **edited** (time/destination) or **cancelled**. Failed entries
  can be given a new time. The words/image are edited on the post itself; the latest approved version is sent.
- **Cron:** every minute, Supabase Cron (pg_cron + pg_net) calls the `foxon-social-scheduler` Edge Function,
  which claims due entries and sends them through the same publishing core as Publish now.
- **LinkedIn images:** organisation posts can carry one approved JPEG/PNG/GIF via the Images API
  (`initializeUpload` → `PUT` the bytes → wait for `AVAILABLE` → `POST /rest/posts` with `content.media`).
  Text-only LinkedIn posts work as before.
- **Instagram stays off** for scheduling (UI and server both refuse it).

## Failures, retries and why nothing double-posts
1. `studio_publish_schedules_one_live` (unique index): one live entry per post + destination.
2. `foxon_claim_due_schedules` uses `FOR UPDATE SKIP LOCKED`, so overlapping cron runs never claim the same row.
3. Everything that can fail without posting (checks, token, image download, LinkedIn upload) runs first.
   Such failures are **safe**: transient ones retry automatically after 5, then 15 minutes (3 attempts),
   permanent ones (post no longer approved, account disconnected…) stop at once as **Not posted**.
4. Then one `studio_publish_deliveries` row is inserted (existing unique post + account gate), linked to the
   schedule, and only then is the single provider call made.
5. Any failure from that point is **unsafe**: the entry becomes **Check the platform** and is never retried.
   The admin checks Facebook/LinkedIn and clicks **It posted** or **It didn't post**. To try again after
   "It didn't post", duplicate the post. That is deliberate.
6. A row stuck in `sending` for 15 minutes is requeued only if no delivery row exists; otherwise it needs
   reconciliation. Entries more than 6 hours late (scheduler was off) are not sent; pick a new time.

## Deploy steps (each needs Pete's OK)
All against the **FOXON** project `mpmcxxfowxohghhxrmgm` only, never the Vuba project.

1. **Merge the PR** (GitHub Pages then serves the new UI; with no migration it shows "Scheduling isn't
   switched on" and Publish now keeps working).
2. **Apply the migration:** Supabase Dashboard → SQL Editor → paste
   `foxon-studio/supabase/migrations/20261126120000_foxon_scheduled_publishing.sql` → Run.
   It only adds `studio_publish_schedules` and `foxon_claim_due_schedules`; it changes no existing table.
3. **Deploy the functions** (Supabase CLI logged in as Pete, from `foxon-studio/`):
   ```
   supabase functions deploy foxon-social-publish --project-ref mpmcxxfowxohghhxrmgm
   supabase functions deploy foxon-social-scheduler --project-ref mpmcxxfowxohghhxrmgm --no-verify-jwt
   ```
   `foxon-social-publish` replaces the deployed publisher (now in `supabase/functions/`; the older copy in
   `backend/` is kept only for reference). `--no-verify-jwt` is only for the scheduler, which checks its own secret.
4. **Secrets** (Pete types them in the dashboard; never in chat or git):
   - Edge Functions → Secrets: `FOXON_SCHEDULER_SECRET` = a new random value (e.g. `openssl rand -base64 32`
     on the Mac). Leave `FOXON_SCHEDULER_ENABLED` unset for now.
   - Integrations → Vault: `foxon_scheduler_secret` = the same value; `foxon_project_url` =
     `https://mpmcxxfowxohghhxrmgm.supabase.co`.
5. **Create the cron job:** SQL Editor → paste `foxon-studio/supabase/cron/foxon-scheduler-cron.sql` → Run.
   With `FOXON_SCHEDULER_ENABLED` unset, every run answers `scheduler_disabled` and sends nothing, which
   proves the wiring (`select * from cron.job_run_details order by start_time desc limit 5;`).
6. **Switch it on:** set `FOXON_SCHEDULER_ENABLED=true`. From now on due entries are sent.
7. **First real test:** schedule one approved text post and one LinkedIn image post to the FOXON pages
   ~10 minutes ahead, watch them go to Published, and check both on the platforms.

**Off switches:** unset `FOXON_SCHEDULER_ENABLED` (instant), or `select cron.unschedule('foxon-social-scheduler');`.

## Provider prerequisites (unchanged)
Facebook needs `pages_manage_posts` (App Review for non-testers). LinkedIn needs Community Management API
access with `w_organization_social`; image upload uses the same scope. Accounts must be connected in Studio first.

## Tests
- `node foxon-studio/tests/smoke.mjs` and `node foxon-studio/tests/schedule-time.test.mjs`
- `deno test --allow-env foxon-studio/tests/publish-core.test.ts` (fake fetch + fake database, no network)
- `foxon-studio/tests/sql/run.sh` (throwaway local PostgreSQL: unique gate, claim, stuck-row recovery, RLS)
