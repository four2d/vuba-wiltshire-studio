# Vuba Wiltshire Studio — provider connections

## What is already configured
Vuba's own Supabase project is `iwituhhojivokiueekdb`, separate from FOXON.
The `vuba-social-oauth` Edge Function is deployed and uses authenticated Studio administrator checks. Connected accounts and encrypted tokens are private; no provider secrets are committed to GitHub.
No social accounts are connected and automated publishing is not enabled.

## One exact OAuth redirect URI for both developers' apps
`https://iwituhhojivokiueekdb.supabase.co/functions/v1/vuba-social-oauth`

## Meta — Facebook + Instagram
1. A business administrator opens https://developers.facebook.com/apps/ and creates/selects a **Vuba Wiltshire** business app.
2. Set its company-owned website, privacy policy and developer contact details.
3. Configure the appropriate Facebook Login for Business permissions and Instagram API permissions. For Facebook Page discovery/posting the initial scopes are `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`; for a linked Instagram Professional account add `instagram_basic` and `instagram_content_publish`.
4. Add the redirect URI above to the provider app's valid OAuth redirects.
5. The Meta administrator must approve the requested permissions and complete Meta App Review/business verification if required to connect a non-test account.
6. Store the resulting App ID and App Secret **directly in Vuba's Supabase Edge Functions secrets**, using names `VUBA_META_APP_ID` and `VUBA_META_APP_SECRET`. Never use FOXON's app or secrets.

## LinkedIn
1. A company Page super-admin opens https://www.linkedin.com/developers/apps and creates/selects a Vuba-owned developer app associated with Vuba Wiltshire.
2. Request Community Management API access. LinkedIn reviews the commercial organisation, verified business email, website, privacy policy, Page ownership and proposed use case; additional review/upgrade may be required before production posting.
3. Add the same exact OAuth redirect URI. Request approved permissions such as `w_organization_social`, `r_organization_social` and `rw_organization_admin` as applicable to the app's granted product tier.
4. Enter the Client ID and Client Secret **directly into Vuba's Supabase Edge Functions secrets** named `VUBA_LINKEDIN_CLIENT_ID` and `VUBA_LINKEDIN_CLIENT_SECRET`.

## Vuba-specific encryption secret
Generate a cryptographically secure random 32-byte key, encode it in standard base64, and save it **only** in Supabase Edge Functions secrets under `VUBA_SOCIAL_TOKEN_KEY_B64`. Never paste this into ChatGPT, email, JavaScript, GitHub or screenshots.
If provider secrets are not configured, the function reports that the connection is not ready. It does not simulate success.

Supabase dashboard: https://supabase.com/dashboard/project/iwituhhojivokiueekdb/functions/secrets
Studio: https://four2d.github.io/vuba-wiltshire-studio/studio-v1/#connections

## Verification before calling a platform connected
- Test login and Page authorisation with a Vuba company administrator
- Confirm the real Page is returned and shown as connected; test account renewal and logout where applicable
- Review the linked account's permission scope and token expiry
- No posting is performed or scheduled by completing provider setup alone
- Keep client secrets and tokens server-side and encrypted

## Why the app may still show 'Not connected'
Provider account creation and approvals must be performed by an authorised human in Meta / LinkedIn. The current work supplies Vuba's technical integration but does not grant those third-party privileges.
