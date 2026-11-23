-- Already applied to Vuba Wiltshire Supabase on 23 November 2026.
-- Social account identities are readable only by authenticated Vuba members.
-- OAuth state and encrypted token records are private to server-side service role.
create table if not exists public.studio_social_accounts(
 id uuid primary key default gen_random_uuid(),
 platform text not null check(platform in ('Facebook','Instagram','LinkedIn')),
 external_account_id text not null,
 display_name text not null,
 connection_status text not null default 'pending'
  check(connection_status in ('pending','connected','disconnected','error')),
 connected_at timestamptz,last_checked_at timestamptz,last_error text,
 created_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(platform,external_account_id)
);
alter table public.studio_social_accounts enable row level security;
revoke all on public.studio_social_accounts from anon;
grant select on public.studio_social_accounts to authenticated;
create table if not exists public._vuba_social_oauth_state(
 state_hash text primary key,
 requester uuid not null references auth.users(id),
 platform text not null check(platform in ('Facebook','Instagram','LinkedIn')),
 expires_at timestamptz not null,consumed_at timestamptz
);
alter table public._vuba_social_oauth_state enable row level security;
revoke all on public._vuba_social_oauth_state from PUBLIC,anon,authenticated;
create index if not exists vuba_oauth_expires_idx on public._vuba_social_oauth_state(expires_at);
create table if not exists public._vuba_social_tokens(
 social_account_id uuid primary key references public.studio_social_accounts(id) on delete cascade,
 token_ciphertext text not null,token_iv text not null,
 token_expires_at timestamptz,updated_at timestamptz not null default now()
);
alter table public._vuba_social_tokens enable row level security;
revoke all on public._vuba_social_tokens from PUBLIC,anon,authenticated;
-- Production database also has this policy:
-- create policy "Vuba members read verified social connections" on public.studio_social_accounts
-- for select to authenticated using
-- (exists (select 1 from public.studio_members m where m.user_id=(select auth.uid())));
