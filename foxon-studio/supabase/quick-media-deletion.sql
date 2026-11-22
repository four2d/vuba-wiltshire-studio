alter table public.studio_media add column if not exists deletion_started_at timestamptz;
create function public.foxon_prepare_media_delete(asset_id uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare asset_path text;
begin
 select file_path into asset_path from public.studio_media where id=asset_id for update;
 if not found then return null; end if;
 if exists (select from public.studio_posts where media_id=asset_id) then
  raise sqlstate 'P7022' using message='media_in_use';
 end if;
 update public.studio_media set deletion_started_at=coalesce(deletion_started_at,now()),approved=false where id=asset_id;
 return asset_path;
end;
$$;
revoke all on function public.foxon_prepare_media_delete(uuid) from public, anon, authenticated;
grant execute on function public.foxon_prepare_media_delete(uuid) to service_role;

create function studio_private.prevent_linking_deleting_media()
returns trigger language plpgsql security definer set search_path='' as $$
declare deletion_started timestamptz;
begin
 if new.media_id is null then return new; end if;
 if tg_op='UPDATE' then
  if new.media_id is not distinct from old.media_id then return new; end if;
 end if;
 select deletion_started_at into deletion_started from public.studio_media where id=new.media_id for key share;
 if deletion_started is not null then raise exception 'This media is being deleted'; end if;
 return new;
end;
$$;
revoke all on function studio_private.prevent_linking_deleting_media() from public, anon, authenticated;
create trigger foxon_prevent_linking_deleting_media before insert or update of media_id on public.studio_posts
for each row execute function studio_private.prevent_linking_deleting_media();
