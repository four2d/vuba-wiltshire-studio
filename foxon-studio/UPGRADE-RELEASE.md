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
