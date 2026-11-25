# Shared Vuba staff login — Order ↔ Social Studio

Status: **implemented, pending Supabase OIDC registration + staff UUID links** (2026-11-25).

## Live URLs

| App | URL |
|---|---|
| Order staff login (hub) | https://www.vubawiltshire.co.uk/order/staff/login |
| Studio (first-party) | https://www.vubawiltshire.co.uk/studio/ |
| OIDC issuer | https://www.vubawiltshire.co.uk/order/staff/sso |
| Discovery | https://www.vubawiltshire.co.uk/order/staff/sso/.well-known/openid-configuration |
| JWKS | https://www.vubawiltshire.co.uk/order/staff/sso/jwks.json |
| Token (session cookie) | https://www.vubawiltshire.co.uk/order/staff/sso/studio/token |
| Link admin (managers) | https://www.vubawiltshire.co.uk/order/staff/settings/studio-sso |

## How it works

1. Vuba Order remains the only staff password login (`wordpress_vuba_order` session cookie).
2. Studio is hosted at `/studio/` on the same host so the Order cookie is same-site.
3. Studio’s `staff-auth.js` fetches a short-lived RS256 JWT from `/order/staff/sso/studio/token` (credentials included; token never appears in the URL).
4. The JWT `sub` is the **existing** Studio Supabase Auth user UUID from `studio_staff_links`, so posts and social connections stay attached.
5. Supabase Custom OIDC trusts the Order issuer JWKS. Studio creates the Supabase client with an `accessToken` callback.
6. Existing `studio_members` roles and RLS stay the permission source. Installer accounts are never issued tokens.
7. Sign-out from Studio POSTs `/order/staff/logout` and clears the cached token. Sign-out from Order clears the session cookie so Studio’s next token fetch returns 401.

## Pete checklist (Supabase)

1. Supabase project `iwituhhojivokiueekdb` → Authentication → Third-Party Auth → Add provider → **Custom OIDC**.
2. Issuer URL: `https://www.vubawiltshire.co.uk/order/staff/sso`
3. For each staff member who should use Studio, copy their **Authentication → Users** UUID and paste it on Order → Settings → Studio SSO against the matching Order staff row. Prefer exact email match. If a match is unclear, leave blank and confirm before linking.

## Rollback

- Order: redeploy previous git commit; optional `DROP TABLE studio_staff_links;` (does not affect desk login).
- Studio: restore previous `/studio/` files or remove `public_html/studio/` to fall back to GitHub Pages password login.
- Supabase: remove the Custom OIDC provider entry.

## Out of scope

FOXON Studio (`foxon-studio/`) keeps its own auth and is unchanged.
