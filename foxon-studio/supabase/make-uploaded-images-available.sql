create or replace function studio_private.studio_make_uploaded_image_available()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.mime_type like 'image/%' then
    new.approved := true;
  end if;
  return new;
end;
$$;
revoke all on function studio_private.studio_make_uploaded_image_available() from public, anon, authenticated;
create trigger studio_media_make_image_available before insert on public.studio_media
for each row execute function studio_private.studio_make_uploaded_image_available();

alter policy "Staff can register uploads" on public.studio_media with check (
  studio_private.studio_role() is not null and uploaded_by = (select auth.uid())
  and file_path like ((select auth.uid())::text || '/%')
  and (approved = false or mime_type like 'image/%')
);

update public.studio_media set approved = true
 where mime_type like 'image/%' and archived_at is null and approved is distinct from true;
