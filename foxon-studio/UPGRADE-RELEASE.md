# FOXON Social Studio — four-phase upgrade

Release date: 20 November 2026
Scope: `foxon-studio/` only; existing theme selection and Supabase data remain in place.
Recovery point: the GitHub branch `b.1` is unchanged.

## Phase 1 — interface and reliability
- Added scoped, responsive upgrade styles that do not replace the existing 14 themes.
- Keyboard-visible focus rings, reduced-motion support and clear light-theme contrast.
- Added syntax and static regression checks in `tests/smoke.mjs` and `.github/workflows/foxon-studio-smoke.yml`.
- Post editor has session-only recovery. The saved content is held in the current browser session only; no localStorage persistence or automatic publication.
- Successful post saves clear recovery content and refresh dashboard insights.

## Phase 2 — planning calendar and workflow
- Month / Agenda toggle.
- FOXON Invoice, CIS, Miles, Gas and General content filters.
- Colour-coded calendar markers for the four FOXON product families.
- Drag-and-drop changes **planned dates only**, after explicit confirmation. Only `idea` and `draft` posts are draggable. Updates require the signed-in user's normal RLS permissions and verify that a row was updated.
- Saved posts continue to use the existing roles, review flow and database schema.

## Phase 3 — Post Builder and FOXON Brain
- Caption length, image approval and source-note checks inside the existing editor.
- Copy caption action.
- Optional approved Brain reference picker adds the source citation to verification notes; it does not invent or insert unverified product claims.
- Existing platform preview, generated artwork support and media workflows remain in place.

## Phase 4 — hand-off and measurement
- Live **internal workflow** metrics: status mix, channels, pending reviews, missing approved media, overdue drafts and prepared posts.
- CSV export of approved and internally scheduled content with `readiness_issues`, not a publishing action.
- Session-only manual CSV import of platform metrics (date, channel, post_id, impressions, clicks, reactions, comments, shares). The importer validates columns and non-negative whole numbers and calculates impressions, clicks, engagements and CTR.
- No real social-account connection or external publishing is implied. Platform metrics are always identified as user-supplied, not verified live analytics.

## What is not yet connected
- Live LinkedIn, Facebook and Instagram authentication, automatic publishing and platform analytics require verified platform account integrations and appropriate team approval.
- No Supabase schema changes or secrets were introduced.
- This environment cannot visually inspect the deployed app in Safari or run an authenticated FOXON Supabase query. The GitHub smoke checks and in-browser QA must be confirmed before treating this as fully production-validated.

## Required human QA
1. Sign into FOXON Studio and confirm the action centre loads live posts.
2. Open Calendar, toggle Month / Agenda, filter Invoice and CIS.
3. Drag a **draft** to a new date; confirm the change, then reopen the post. Confirm approved posts cannot be dragged.
4. Open Post Builder, enter a caption, close and recover unsaved text in the same tab.
5. Add an approved FOXON Brain source to the source notes; check role restrictions and image status.
6. Export the publishing queue; verify the CSV contains `readiness_issues` and does **not** post externally.
7. Download the metrics template, import actual platform data and check displayed totals.
8. Spot-check Classic plus at least one light and one Special Edition theme on desktop and mobile.
9. Confirm the GitHub smoke workflow runs green.

## Files introduced or modified
- New: `studio-upgrades.js`, `studio-upgrades.css`, `tests/smoke.mjs`, `UPGRADE-RELEASE.md`.
- Modified: `app.js`, `bootstrap.js`, `index.html`.
- New workflow: `.github/workflows/foxon-studio-smoke.yml`.

The existing `b.1` branch was not modified.


---

# Marketing HQ release — 21 November 2026

Rollback checkpoint: `foxon-pre-marketing-hq-20261121` points to the prior working main commit `89efe398bf1002fd37139b9c5d5e0c735b35353d`. The separately saved original `b.1` branch is unchanged.

## What was added
1. **Marketing Director**: plans next week's FOXON Invoice, CIS, Miles and Gas editorial drafts for LinkedIn, Facebook and Instagram. Select an existing campaign; topics are drawn from approved FOXON Brain entries when available. Otherwise it proposes questions rather than asserting unsupported features. Captions and titles vary by platform and week. Existing slots and matching previous captions are skipped. Every caption can be edited, selected and explicitly saved as an internal draft. Nothing is automatically approved or posted.
2. **Creative Studio**: layouts for a real mobile screenshot, a photograph plus bold headline, or a simple FOXON-branded text graphic. Exports PNG at 1080 × 1350, 1080 × 1080, or 1200 × 675. Staff can select genuinely approved existing media or upload an actual screenshot/photo in-browser. Switching between FOXON products clears the previous image. Uploading composed artwork creates an unapproved media record, subject to normal review.
3. **Publishing Desk**: lists internally approved or scheduled posts, highlights missing captions, sources and approved media, supports copying ready captions, exporting the preparation CSV and opening the correct social network for **manual** publication. The app does not mark any post as externally published.
4. **Insights and QA**: separates internal prepared-post counts from voluntarily imported, user-supplied social performance CSV. Displays channel impression/click counts and a cautious test recommendation only when there are at least 100 imported impressions. Includes a read-only computed-colour inspection for icon troubleshooting.
5. **Design consistency**: scoped responsive `marketing-hq.css` with theme-aware colours, accessible focus styles and reduced-motion support. Accessible shortcut at the top of Overview. Existing fourteen themes are preserved.
6. **Regression coverage**: `foxon-studio/tests/smoke.mjs` and `.github/workflows/foxon-studio-smoke.yml` cover Marketing HQ's integration, approval safeguards, theme preservation and syntax.

## Implementation files
- New: `foxon-studio/marketing-hq.js`, `foxon-studio/marketing-hq.css`
- Updated: `foxon-studio/bootstrap.js`, `foxon-studio/index.html`, `foxon-studio/studio-upgrades.js`, `foxon-studio/tests/smoke.mjs`, `.github/workflows/foxon-studio-smoke.yml`.

## Integrations that remain incomplete
- **Metricool publishing:** the connected Metricool workspace currently reports no social-network accounts connected. Use https://app.metricool.com/brands/connections?blogId=8253976 to connect the FOXON accounts. Connecting accounts to Metricool does not automatically give this GitHub Pages app a secure publishing API; a supported server-side integration, account-level mapping, authorisation and verified delivery/failed-post handling would still be required.
- **Live generative AI:** the current FOXON client configuration has `aiEnabled: false`. The Marketing Director is an editorial rules-and-sources planning engine, not a claim that a live language model generated every caption. The pre-existing optional artwork generation endpoint remains untouched; this release adds deterministic local graphic composition from real screenshots and approved media.
- **Live social analytics:** the web app supports importing genuine CSV exports. It does not claim a live Metricool data integration or invent impressions, clicks, reactions or followers.
- **Supabase permissions and media uploads:** no new tables, database policies or public secrets were added. Authenticated upload and read/write behaviour still requires verification in the real FOXON workspace.

## Verified in this session
- New Marketing HQ and revised workflow modules passed JavaScript syntax compilation checks.
- Expanded static smoke checks passed against GitHub-fetched source files.
- The fourteen theme options and saved `b.1` branch were confirmed present.
- Baseline branch `foxon-pre-marketing-hq-20261121` created.

## Not yet verified
- A signed-in, visual end-to-end run in Safari, Chrome and mobile.
- Live document upload, media upload, draft insertion, image approval or rescheduling against FOXON Supabase.
- GitHub Actions CI job result (the workflow has been committed, but no successful job run was inspected).
- Live publishing or performance data from FOXON social channels.

## Manual acceptance checks
1. Sign in and select Overview → **OPEN MARKETING HQ**.
2. Plan next week for all three platforms. Verify different text for each network and missing verified product facts are not asserted.
3. Edit a proposal and save selected drafts. Verify database records use `draft` and no external post appears.
4. In Creative Studio, upload an actual screenshot, switch product and confirm the old screenshot is cleared. Export each aspect ratio.
5. Confirm rights and upload a graphic. It should appear in media as **unapproved**, requiring review.
6. With an approved post that has an approved image (or is intentionally text-led), copy its caption and open the corresponding network. Nothing publishes automatically.
7. Import authentic social metrics using the existing CSV importer. Check that Insights uses imported figures and does not invent results.
8. Check Classic, a light theme and a special theme in Safari desktop and mobile. Run contrast check in Insights.
9. Connect the desired FOXON social accounts in Metricool, then plan a separately authorised integration with posting credentials held **server-side**, never in GitHub Pages.

This release provides a useful operator-controlled foundation for all five improvement tracks, not proof of fully automated social publishing or live AI service.
