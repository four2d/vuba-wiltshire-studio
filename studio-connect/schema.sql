-- Shared Studio social connector pilot. This schema is applied to Vuba's Supabase
-- in a separate set of tables; FOXON's existing connections remain untouched.
-- All three tables have RLS and NO anonymous or user access. Server only.
create table if not exists public.studio_connect_accounts (
 id uuid primary key default gen_random_uuid(),
 tenant text not null check (tenant in ('foxon','vuba')),
 user_id uuid not null,
 platform text not null check (platform in ('Facebook','Instagram','LinkedIn')),
 provider_id text not null,
 display_name text not null,
 status text not null default 'connected' check (status in ('connected','revoked')),
 token_ciphertext text not null,
 token_iv text not null,
 token_expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (tenant,user_id,platform,provider_id)
);
alter table public.studio_connect_accounts enable row level security;
revoke all on public.studio_connect_accounts from public,anon,authenticated;
create index if not exists studio_connect_accounts_user_idx on public.studio_connect_accounts(tenant,user_id,platform);
create table if not exists public.studio_connect_states (
 state_hash text primary key,
 tenant text not null check (tenant in ('foxon','vuba')),
 user_id uuid not null,
 platform text not null check (platform in ('Facebook','Instagram','LinkedIn')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz
);
alter table public.studio_connect_states enable row level security;
revoke all on public.studio_connect_states from public,anon,authenticated;
create index if not exists studio_connect_states_expiry_idx on public.studio_connect_states(expires_at);
create table if not exists public.studio_connect_candidates (
 id uuid primary key default gen_random_uuid(),
 tenant text not null check (tenant in ('foxon','vuba')),
 user_id uuid not null,
 platform text not null check (platform in ('Facebook','Instagram','LinkedIn')),
 provider_id text not null,
 display_name text not null,
 token_ciphertext text not null,
 token_iv text not null,
 token_expires_at timestamptz,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 unique (tenant,user_id,platform,provider_id)
);
alter table public.studio_connect_candidates enable row level security;
revoke all on public.studio_connect_candidates from public,anon,authenticated;
create index if not exists studio_connect_candidates_user_idx on public.studio_connect_candidates(tenant,user_id);
