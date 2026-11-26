-- Minimal stand-ins for the existing FOXON Supabase objects, ONLY for local migration tests.
-- Never apply this file to a real project.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
create schema studio_private;
grant usage on schema studio_private to authenticated;
create table public.studio_members(user_id uuid primary key references auth.users(id), role text not null);
create function studio_private.studio_role() returns text language sql stable security definer set search_path='' as $$
  select role from public.studio_members where user_id=(select auth.uid()) $$;
grant execute on function studio_private.studio_role() to authenticated;
create table public.studio_posts(id uuid primary key default gen_random_uuid(), title text);
create table public.studio_social_accounts(id uuid primary key default gen_random_uuid(), platform text);
create table public.studio_publish_deliveries(id uuid primary key default gen_random_uuid(), post_id uuid, social_account_id uuid,
  status text, unique(post_id, social_account_id));
grant usage on schema public to authenticated, service_role, anon;
grant all on all tables in schema public to service_role;
