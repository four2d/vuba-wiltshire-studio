# Vuba Social Studio — automation and navigation plan

Updated: 2026-11-20

## Interface

Public GitHub Pages hosts a client-side web application. The signed-in Studio has a minimal **Overview** landing screen and focused hash-routed views:

- **Overview**: what needs attention (upcoming posts, approvals, missing images, empty editorial slots) and a one-click Fill calendar gaps action.
- **Calendar**: date/channel filters, existing editorial dashboard and direct post editing.
- **Post builder**: create a suggested no-credit draft with image matching or write a post manually.
- **Post ideas**: campaign/seasonal suggestions with preview and approved-image matching.
- **Approvals**: review queue with approval audit.
- **More → Marketing plan**: organisation-wide strategy.
- **More → Campaigns**: campaigns, audiences, objectives and performance targets.
- **More → Media library**: approved assets, private photo upload, local-folder import, image briefs.
- **More → Vuba Brain**: internal knowledge and verification status.

All pages share the original Supabase authentication and RLS controls; navigation does not create extra API permissions. No iframe, server-side rendering or secret token is required.

## Automation shipped now (does not use paid OpenAI API)

The Overview **Fill calendar gaps** button uses a four-week rolling plan and creates a post only when the same date/channel has no existing entry:

- Instagram on Monday and Friday;
- LinkedIn on Tuesday;
- Facebook on Wednesday.

These are proposed editorial dates, not auto-publishing appointments. Existing entries remain unchanged. Drafts are generated from an expanded bank of manually authored, general-purpose British-English templates, with a goal of varying content pillars. Titles from existing posts are considered when choosing unused templates. AI claims, event dates, technical specs, stock/price/coverage claims are not invented.

Each new draft is assigned `status=draft`, source/verification notes and a library photo **only if there is a relevant approved match**. The editor handles photos in the usual review process. The UI reports how many drafts were inserted. Repeat clicks should not create duplicate date/channel slots.

## Not yet automated — future work

1. **Background planning**: scheduled server-side job that fills gaps periodically without a button, with opt-in settings, quotas and audit logging.
2. **Image generation**: secure generation provider and billing; the ChatGPT conversation cannot be called from the live site as an unbilled backend. Generated images must be labelled synthetic and reviewed before brand use.
3. **Image tagging and duplicates**: use machine vision (licensed API or local job), review tags for product and copyright accuracy.
4. **Vuba Brain sync**: trusted server-side GitHub integration and reconciliation, rather than exposing private repository credentials on GitHub Pages.
5. **Approval notifications**: authorised inbox/email notifications, with staff identities and explicit notification preferences.
6. **Publishing**: connect Meta and LinkedIn via official tokens/permissions and maintain per-channel published state, retries and audit; no current integration.
7. **Reporting/learning loop**: ingestion of actual post analytics and measured outcomes, permission and privacy controls.

## Guardrails

- Only authenticated team members can insert/edit drafts via existing Supabase RLS.
- Only admins/approvers may approve (enforced by database trigger).
- Never auto-publish an unreviewed post, technical claim, stock claim or synthetic image.
- A draft's proposed date does not mean published.
- No OpenAI API call is made in no-credit mode.

## Tests

Static JavaScript parse checks plus verification of deployed GitHub files and Supabase auth/RLS. Browser-based signed-in workflows, cross-device responsive checks, media import and publishing integrations need further end-to-end validation.
