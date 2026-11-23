# Shared Studio social connections — pilot
This module is a **pilot for FOXON and Vuba**, not a production-ready universal connector for arbitrary third parties.

## Intended customer journey
1. Sign in to your company's Studio edition using its own Supabase Auth account.
2. Open Connections > Shared account connections (Preview).
3. Click Add Facebook / Instagram / LinkedIn.
4. Sign in directly at the provider and consent.
5. Tick exactly the eligible Pages you want, then Connect selected Pages.
6. Remove a connection from Studio when no longer wanted.

All actions are confined to the authenticated user's tenant. Nothing publishes automatically.

## Backend
Initially hosted in Vuba Supabase project **iwituhhojivokiueekdb** under endpoint:
`https://iwituhhojivokiueekdb.supabase.co/functions/v1/studio-connect`
OAuth callback URI is exactly the same endpoint. It does not use the FOXON provider app or import existing FOXON tokens.

The backend validates each user's JWT with the relevant **original** Auth project, checks their existing Studio membership, and stores tenant- and user-scoped connections using encrypted tokens. A signed and expiring one-use OAuth state binds the provider callback to the workspace. Candidate Pages are encrypted and expire after 15 minutes, then only explicitly selected Pages become connections. All tables have RLS and no anon/authenticated Data API access. Disconnect removes the selected local record but does not revoke the user's provider-level grant; the provider's own app settings can revoke that grant.

Provider app credentials are server-only secrets:
`STUDIO_META_APP_ID`, `STUDIO_META_APP_SECRET`,
`STUDIO_LINKEDIN_CLIENT_ID`, `STUDIO_LINKEDIN_CLIENT_SECRET`,
`STUDIO_SOCIAL_TOKEN_KEY_B64` (32 cryptographically random bytes as base64).

## Production blockers
- A *single Studio-owned* Meta app must be granted appropriate advanced permissions / App Review for external customers; a FOXON-only app or development-tier permissions may not suffice.
- A *single Studio-owned* LinkedIn app needs Community Management API permission and possible Standard-tier approval.
- Generate and store the encryption key through Supabase dashboard, **not** in GitHub or chat.
- Run real OAuth tests with staff/admin test accounts and then an unrelated customer tenant; audit scopes, selected Pages, revocation, expiry and renewal.
- Current tenant registry is intentionally limited to FOXON and Vuba. Before onboarding arbitrary customers, create a trusted administrative tenant registry, registration/invitation, tenant-specific ownership roles, data retention/deletion, rate limiting, audit logs, provider webhook support and isolated deployment. Do not accept caller-supplied auth URLs or reuse provider tokens across tenants.
- Deployment in the Vuba backend is a technical pilot. A production-scale service belongs in its own dedicated infrastructure/project, not in an individual customer's workspace.
- Legacy FOXON connection remains active and untouched. New shared connections have no publishing integration yet.

## Safety
No user passwords, Meta secrets, LinkedIn secrets, access tokens or service role keys in browser JavaScript. No publishing endpoint here.
