# Shared Vuba staff login — secure SSO implementation

Status: **planned, not yet deployed** (2026-11-20).

## Verified systems

- Vuba Order: https://www.vubawiltshire.co.uk/order/staff/login uses the FastAPI service in private `four2d/Vuba-Order`, a signed Starlette staff session cookie and a `staff_users` database. Its cookie name is `wordpress_vuba_order`.
- Vuba Social Studio: currently GitHub Pages at `https://four2d.github.io/vuba-wiltshire-studio/studio-v1/` and independent Supabase Auth (`iwituhhojivokiueekdb`). Frontend ESM modules each create a Supabase client and listen to Supabase Auth sessions.
- These are separate identity systems. **Don't expose or share staff cookies or passwords in browser JS.**

## Chosen design
Use **Vuba Order as the authoritative staff identity** and put the Studio on a first-party path like `https://www.vubawiltshire.co.uk/studio/`. The Order backend validates its existing session and issues short-lived asymmetric JWTs from a registered OIDC issuer after mapping the staff ID to an allowed Studio UUID/role. Supabase's custom Third-Party Auth integration validates the token against the issuer's public JWKS; all existing RLS policies remain the permission source. Studio uses an `accessToken` callback and a single shared auth adapter across modules. Issuing tokens must check active staff status and explicit Studio access. Role mapping is NOT implicit.

For full backend requirements and acceptance tests, see private Order repo `docs/SOCIAL-STUDIO-SSO-INTEGRATION.md`.

**Deployment prerequisites**: controlled first-party Studio hosting, trusted JWT issuer/JWKS with server-only signing key, staff identity crosswalk, Supabase third-party issuer registration, and staged signed-in browser tests. None are in place yet; the existing Studio login must remain in force.

Security constraints: no new public login credential, no sharing cookies across GitHub Pages, no service-role key in frontend, fail closed on expired tokens and staff deactivation.
