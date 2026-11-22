create or replace function public.foxon_select_facebook_pages(requester uuid, selected_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(requester::text)::bigint);
  if exists (
    select 1 from unnest(selected_ids) as selected(id)
    where not exists (
      select 1 from public.studio_social_accounts a
      join public._foxon_social_tokens t on t.social_account_id = a.id
      where a.id = selected.id and a.platform = 'Facebook' and a.created_by = requester
        and a.connection_status in ('pending', 'connected', 'disconnected')
    )
  ) then raise exception 'facebook_page_not_available'; end if;

  update public.studio_social_accounts a
     set connection_status = case when a.id = any(selected_ids) then 'connected' else 'disconnected' end,
         last_error = null, updated_at = now()
   where a.platform = 'Facebook' and a.created_by = requester
     and a.connection_status in ('pending', 'connected', 'disconnected')
     and exists (select 1 from public._foxon_social_tokens t where t.social_account_id = a.id);
  return cardinality(selected_ids);
end;
$$;
revoke all on function public.foxon_select_facebook_pages(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.foxon_select_facebook_pages(uuid, uuid[]) to service_role;

update public.studio_social_accounts
set connection_status = 'pending', last_error = null
where platform = 'Facebook' and connection_status = 'error'
  and last_error = 'Page outside the FOXON test. Reconnect only the intended Page.'
  and exists (select 1 from public._foxon_social_tokens t where t.social_account_id = studio_social_accounts.id);
