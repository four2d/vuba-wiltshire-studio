# FOXON Software edition — implementation contract

Status: **prepared; independent database not provisioned yet** (20 November 2026).

## Scope
Build a second working edition of the existing Vuba Social Studio for FOXON Software Ltd. Preserve the **current successful UI and UX**: premium side navigation, image-led overview, dedicated task pages, media manager, Brain/document library, approvals, content planning, post builder, campaign manager. No visual redesign to the Vuba reference product.

## Identity and separation
FOXON and Vuba are unrelated businesses. FOXON must have:
- A **separate Supabase project**, Auth user directory, RLS, private Storage buckets and functions. Never substitute the Vuba project URL, public publishable key, or reuse Vuba data.
- Its own admin account and approved FOXON staff. FOXON does **not** inherit Vuba staff login, staff session bridge, SSO, staff permissions, source files, campaign history or approval records.
- FOXON-specific product, audience, brand and claims. Do not seed resin-bound content, the Vuba Brain, Vuba imagery, Vuba marketing plans, Vuba offline editorial templates, or any Vuba-origin staff details.

## Business context (verified from four2d/foxon-website)
Business name FOXON Software. Main website https://foxonsoftware.com/ . Product family: FOXON Invoice, FOXON CIS, FOXON Miles, FOXON Gas. Audience: UK trades. Public brand expression 'Tools That Graft.' Product availability and release status must be verified at posting time, not copied from old marketing material.

## Future improvements and exceptions
The **source-of-truth code is the existing Vuba Social Studio implementation** at `four2d/vuba-wiltshire-studio/studio-v1/`, initially. Shared engine components (layout, routing, calendar, review, private library, extraction, permissions, fixes) are to be reused by both editions. Future changes to shared components apply to FOXON **by default**, except changes explicitly tagged `vuba-only` or `skip-foxon` in the change log.

Keep all business-specific components/configuration outside shared engine: FOXON content templates, branding, site metadata, product terms, Supabase endpoint, social channel integrations and secrets. Changes tagged `foxon-only` do not flow back to Vuba. Do not rely on an unverified automation or promise unsupervised merges without a tested CI/CD workflow.

**Important:** Current studio-v1 JavaScript is not yet fully brand-neutral: modules embed Vuba copy (even in marketing content and the image prompt), refer to `window.VUBA_CONFIG`, and independently create Supabase clients. Before FOXON is live, extract a reusable core engine with injected brand config and per-edition content providers; ensure no Vuba-specific code runs against the FOXON tenant.

## Proposed deployment
- Separate FOXON entry point or dedicated host, e.g. `studio.foxonsoftware.com` (requires DNS/hosting approval).
- The same visual component bundle, with FOXON brand assets and editorial data.
- Separate `foxon-studio` folder or repository for tenant config and content. A build can consume shared Studio core with pinned version and continuous release/merge updates.
- Each release runs tests for both brands. When a feature is intentionally excluded, keep an explicit `featureFlags` record in the FOXON config. Do not silently skip fixes.

## Completion checklist
1. Confirm the Supabase organisation authorised to own FOXON's project (the only connected project is Vuba).
2. Create separate project after cost confirmation, migrate secured schema/policies/functions, create fresh storage buckets.
3. Configure FOXON-only admin Auth invite; test roles and RLS including cross-tenant isolation.
4. Refactor hard-coded Vuba-specific strings into tenant-specific templates and theme config.
5. Deploy FOXON front end with independent hostname and credentials; never expose service-role keys.
6. Implement and test auto-update shared core on source changes, with explicit `skip-foxon` exception handling and regression tests.
7. Test both sites in desktop Safari/mobile browsers. Verify no Vuba reference data is present and that enhancements propagate to FOXON by default.

**No FOXON database, live URL or deployed second copy is claimed at this stage.**
