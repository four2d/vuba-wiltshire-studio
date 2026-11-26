# FOXON Studio — direct social accounts

## Status as of 22 November 2026
FOXON Studio now has:
- Private social account and delivery record tables with RLS.
- OAuth and encrypted-token backing tables with no `anon` or `authenticated` access.
- Deployed Edge Functions `foxon-social-oauth` and `foxon-social-publish`.
- Account cards and a publishing receipt log in Marketing HQ → Publishing Desk.
- Explicit `PUBLISH` confirmation for approved posts, using the deployed `foxon-social-publish` service.
- **Zero connected accounts at the time of implementation.**
- **No existing drafts/posts were sent to any provider.**

The OAuth app credentials and approvals are not supplied yet. The UI will not show a live Connect button until the backend confirms they are configured. This release is a direct-integration foundation, **not a claim that FOXON social networks are currently accessible or that scheduled publishing is live**.

## Requirements to connect the providers

### Meta: Facebook and Instagram
1. Create or use a FOXON business developer app at https://developers.facebook.com/apps/
2. Configure Facebook Login / Instagram API as applicable, with an approved official OAuth flow.
3. Ensure the FOXON Facebook Page is administered by the authorising person. For Instagram with Facebook Login, use a linked Professional Instagram account.
4. Request the necessary permissions, including `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic` and `instagram_content_publish`. Meta may require app review/business verification, especially for non-test accounts.
5. Add the exact OAuth redirect URI:
   `https://mpmcxxfowxohghhxrmgm.supabase.co/functions/v1/foxon-social-oauth`

### LinkedIn
1. Create or open a FOXON LinkedIn Developer app at https://www.linkedin.com/developers/apps
2. Associate it with the official FOXON LinkedIn Company Page and request Community Management API access.
3. Ensure the authorising member has permitted page roles (typically Administrator or content administrator).
4. Request approved scopes for company-page posting such as `w_organization_social`, `r_organization_social` and `r_organization_admin` for page discovery. These are not always immediately available.
5. Add the same exact OAuth redirect URI above.

### Server-side secrets (never paste them into chat or commit them to GitHub)
In the **FOXON Supabase project**, open Edge Functions → Secrets:
https://supabase.com/dashboard/project/mpmcxxfowxohghhxrmgm/functions/secrets

Set:
- `FOXON_META_APP_ID`
- `FOXON_META_APP_SECRET`
- `FOXON_LINKEDIN_CLIENT_ID`
- `FOXON_LINKEDIN_CLIENT_SECRET`
- `FOXON_SOCIAL_TOKEN_KEY_B64`: a **random 32-byte key encoded in base64**, generated on your own computer and added directly to Supabase; do not change it after accounts have connected without first planning a token re-encryption migration.

The Edge Function also uses Supabase-provided server-side credentials. No service-role key or access token belongs in `foxon-studio/config.js`.

### Connect from FOXON Studio
1. Sign in to https://four2d.github.io/vuba-wiltshire-studio/foxon-studio/
2. Go to Overview → Open Marketing HQ → Publishing Desk.
3. Refresh connections.
4. When the provider's required secrets and permissions are ready, select **Connect Facebook**, **Connect Instagram** or **Connect LinkedIn**.
5. Complete that provider's own sign-in and consent screen, without giving FOXON Studio your password.
6. Return to Publishing Desk and verify that the actual Page/account is listed. The status comes from Supabase, not a simulated connection.
7. Only approved posts with a recorded approval event and approved media can be published. A confirmation prompt requires typing `PUBLISH`.

## Supported initial direct publishing formats
- Facebook Page: text-only or one approved image.
- Instagram Professional (linked via Meta): one approved image; Meta must accept the private signed media URL and return a published post ID.
- LinkedIn organisation: text-only, or one approved JPEG/PNG/GIF via the LinkedIn Images API (26 Nov 2026).
- Scheduled delivery (UK time, Supabase Cron): built 26 Nov 2026, not deployed. See `SCHEDULED-PUBLISHING.md`. Instagram scheduling is off.
- Unsupported so far: native carousel publishing, Reels, videos, direct native Planner import and live analytics sync.

These restrictions are deliberately enforced server-side. Each publishing attempt creates one unique delivery record. An ambiguous provider response requires manual platform reconciliation; automatic retries are disabled to avoid duplicate posts.

## Security constraints
- All user actions are authenticated against FOXON Supabase Auth.
- Only Studio admins may connect accounts or publish.
- Browser cannot read access tokens or update delivery outcomes.
- OAuth states are random, hashed, short-lived and one-time.
- Tokens are encrypted server-side using AES-GCM.
- Client requests are restricted to the official FOXON Studio web origin.
- Connections and provider capabilities must be tested in an actual signed-in browser after credentials are configured.
- Never claim that a Studio calendar date equals Facebook Planner, LinkedIn or Instagram scheduling.

## Next development milestones
1. Configure official provider applications and confirm the three OAuth flows.
2. Validate a single consent-approved test account and a test post on each provider.
3. Add scheduled delivery using Supabase Cron + Edge Functions + Vault after explicit approval, including precise date/time and time zone, failure handling and reconciliation.
4. Add native platform media formats, post retrieval, insights and analytics.
5. Reconcile previously scheduled Meta Business Suite/LinkedIn posts through authorised read APIs.

**Backup:** the original `b.1` branch and prior FOXON content are untouched.
