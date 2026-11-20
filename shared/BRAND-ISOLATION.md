# Social Studio shared-engine boundary
Updated: 20 November 2026

## Operating principle
**One product concept; two independent companies.** Vuba Wiltshire Social Studio and FOXON Social Studio may share tested product features, editor UX, accessibility fixes, caption/link guidance and common workflow logic. They MUST NOT share company identity, branding, marketing text, calendars, imagery, customer/member records, analytics accounts or deployment secrets.

## Current environment
- Vuba application: `studio-v1/`; Vuba Supabase project: `iwituhhojivokiueekdb`.
- FOXON application: `foxon-studio/`; FOXON Supabase project: `mpmcxxfowxohghhxrmgm`.
- The public Pages repository currently hosts both **frontend build trees** as a temporary convenience. This is NOT a common database and does not authorise content sharing. Move FOXON to a dedicated repository/site when available.
- Shared brand-neutral UI module: `shared/caption-links.js`. Both frontends load **the identical module file** at runtime; only generic link guidance and opt-in caption URL cleanup live here.
- Independent FOXON source mirror: `four2d/foxon-handoff/social-studio/app/caption-links.js` (for later independent hosting). Keep mirror updated whenever the shared helper changes.

## Caption-link policy
- Instagram feed caption web links are not clickable; explain link-in-bio or approved link-sticker flows.
- Standard Facebook and LinkedIn post captions cannot display a hidden clickable hyperlink behind arbitrary 'click here' anchor text.
- Recommend benefit-led CTA text plus a clean, short, **company-owned** URL.
- UTM or attribution parameters belong in actual URLs/short redirects, not printed as campaign gibberish in copy. Use the explicit 'Make links readable' button to remove tracking parameters from a caption, never silently strip them on save.
- Do not invent a short branded redirect; build and verify its actual redirect separately before promoting it.

## Guardrails
- Never copy FOXON content into Vuba or Vuba content into FOXON.
- Never cross-use the other company's Supabase project URL, publishable key, login, user ID, images, or logo.
- Brand-specific copy, approved imagery, themes, staff memberships, approval rules and campaign data remain separate.
- Do not make a generic shared helper write to either company's database; UX-only helpers should be stateless.
- Test both interfaces and verify deployment status before claiming a new feature live. No published posts/paid spend from these helper changes.
