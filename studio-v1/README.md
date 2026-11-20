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


## V2 team workflow (20 November 2026)

The Studio now has three new tabs above the existing seasonal suggestions and calendar:

* **Campaigns** — admins and approvers can create/edit goals, audiences, messages, date ranges, owners and success metrics. Staff can view campaigns, and each calendar post can be linked to a campaign.
* **Creative library** — signed-in staff can upload genuine JPEG/PNG/WebP photographs (up to 10 MB) with documented usage permissions. All files are kept in a private Supabase Storage bucket, with signed one-hour preview URLs. Admins/approvers approve photo use. Only approved images can be attached to approved posts.
* **Review queue** — draft posts can be submitted for review; approvers/admins can request changes with notes or approve. Database triggers record status transitions in `studio_review_events`. The full review history can be viewed in the editor.

**Platform preview:** Both the main post editor and suggested-post previews can display Instagram, Facebook and LinkedIn feed approximations before saving. Layouts are approximations, not official API rendering or publishing. Suggested-post preview supports writing or pasting a manual caption while API credits are unavailable. Captions and media are never published automatically.

Schema delta is recorded in `supabase/workspace.sql`, applied to this project's live Supabase database. Existing `studio-v1/supabase/schema.sql` is a historical base schema; apply `workspace.sql` after it for a fresh environment. Do not rerun the delta against an already upgraded database because it adds named constraints/policies.

**Security:** media is private, membership and role permissions are enforced by RLS, and a database trigger guards approval transitions and prevents approved posts from linking to unapproved images. The app uses a public publishable Supabase key; never put a service-role key or `OPENAI_API_KEY` in the GitHub Pages files.

**Still not implemented:** native publishing to social networks, analytics integrations, image editing, asset tagging/search, performance dashboards, automatic media licence verification, and browser-to-browser collaboration presence. Human review remains essential. The AI drafting endpoint needs paid OpenAI API credits; ordinary non-AI workflows are independent of that budget.

**QA performed:** JavaScript parse checks, verified RLS for new tables, verified the private Storage bucket, and successfully tested an authenticated administrator creating a campaign and a review post with automatic audit event inside rolled-back SQL transactions. Browser-based end-to-end testing of real uploads, staff approval and signed image display remains outstanding.

## Shared Vuba Brain (20 November 2026)

The new **Vuba Brain** section displays vetted-source knowledge with category/search filters and visible status badges. It uses the private, RLS-protected `studio_brain_entries` table. Schema: `supabase/brain.sql`.

### Sources imported

Eight curated entries, all initially `needs_review`, sourced from the **private** `four2d/Vuba-Wiltshire` repository:
- `docs/GPT-NOTES.md`
- `docs/BRAND.md`
- `docs/TEAM.md`

The source-date and review note are stored per entry. The historical teaser plan and older web handoff remain references, **not confirmed current operations**. Source snapshots from the GitHub repository are not the complete on-Mac `MEMORY.md` or `outbox/FROM-GROK.md` files.

### Review and editorial integration

All signed-in team members can read or search the Brain and submit new entries for review. Admins and approvers can edit entries and mark them `approved` or `superseded`. Only **approved** `Marketing`, `Product`, `Audience` and `Operations` Brain entries can contribute topic candidates to the suggestions engine; other records remain reference/context and do not automatically enter promotional copy.

**No automatic sync:** this release does not read private GitHub from the browser and has no Mac-folder watcher. Ask ChatGPT to refresh the Brain from the private repo through connected tools, or add/edit entries in the UI. A GitHub-side bridge protocol is at `four2d/Vuba-Wiltshire/docs/VUBA-BRAIN-BRIDGE.md`. Browser's **Copy as Grok handoff** only copies text; it cannot write the Mac files.

Security: do not embed private repo tokens or service-role keys in public GitHub Pages files. Approval is a human editorial status; technical/stock claims still require current source verification.


## Image-first content workflow (20 November 2026)

The post editor now includes **Choose photo from library** and **Prepare image brief**.

* The photo chooser searches and ranks **approved** private media by filenames, descriptions and the current post topic/caption. Relevance is a simple keyword match; it does **not** run a paid AI image-recognition service and staff must inspect the image.
* The editor can attach a chosen photo to a draft; it is saved as `studio_posts.media_id` on the normal post save. Platform preview displays the selected signed image.
* **Prepare image brief** creates a detailed, copyable prompt for generating new imagery through ChatGPT. The Studio itself does not call an image generation API. Upload the resulting image into Creative library for approval and then attach it to a post.
* **Creative library > Import a photo folder** uses the browser's folder picker to import image files from a directory on the staff member's Mac, including the `OneDrive_1_19-11-2026` desktop folder when the user selects it. This app cannot read a desktop folder invisibly or remotely. Import never deletes or changes original files.
* Upload is via the logged-in staff account to the private `vuba-approved-media` bucket with RLS. Supported formats: JPEG, PNG, WebP; max 10 MB each. Imports run in groups of 40 files, with a Next batch button. Other files and larger images are skipped. Each import requires a usage-rights statement.
* All uploaded photos are `approved=false` until an admin or approver verifies the image and rights. No user-generated or AI-generated artwork should be depicted as a documented customer project without verification.
* Do not use imagery from unrelated Cherry/FOXON libraries for Vuba Wiltshire. Confirm photographic rights, faces and trademarks before approval.

The app code does not contain OpenAI API keys or a new paid image-generation integration. ChatGPT generation here in the conversation is a separate activity; the resulting images still require upload and approval.
