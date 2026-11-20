# Vuba Wiltshire Social Studio V1 (development)

**Development branch:** `feature/social-studio-v1`. The live GitHub Pages `main` application is unchanged.

## Features implemented
- Shared month calendar, filters, post editor and rolling editorial mix indicator
- Invite-only Supabase Auth and staff roles: admin, editor, approver
- Post states: idea, draft, review, approved, scheduled (scheduled means editorially scheduled, **not automatically published**)
- Server-enforced approval rules in Postgres; only approvers/admins can approve or alter approved posts
- Server-side AI caption drafting using confirmed user-provided source notes
- Vuba Wiltshire editorial pillars and 60/20/10/10 target

## Setup (required before use)
1. Create a Supabase project in an appropriate region, then run `supabase/schema.sql` in SQL Editor.
2. In Supabase Authentication settings, disable public signups, configure allowed URLs, invite your staff and insert their `auth.users.id` into `studio_members` with appropriate roles. Start with one `admin`.
3. Set `supabaseUrl` and **public anon/publishable** `supabaseAnonKey` in `config.js`. **Never add service-role or OpenAI keys to the repo.** For production use, prefer environment-injected configuration and avoid committing deployment-specific settings.
4. Deploy `supabase/functions/draft-post/index.ts` as a Supabase Edge Function named `draft-post`, with JWT verification enabled. Set `OPENAI_API_KEY` as a Supabase secret. The function also checks the logged-in user and workspace membership.
5. Serve the `studio-v1/` folder over HTTPS (e.g. a separate staging URL). Configure Supabase Auth allowed redirect URLs accordingly.
6. Test two invited users from separate devices and a non-member; verify only approvers can approve posts. Confirm RLS with direct API calls, not just UI testing.

## Known limitations / next work
- This is a first implementation scaffold and **has not been deployed or browser-tested**.
- Media upload/library, drag-and-drop calendar moves, audit log, automatic reminders, knowledge-base retrieval, AI source verification, and publishing integrations are not yet implemented.
- The starter pack's original TypeScript source is supplied separately and should be integrated as a typed editorial package in the next iteration.
- No public signups, public posting or automatic publishing should be enabled.
