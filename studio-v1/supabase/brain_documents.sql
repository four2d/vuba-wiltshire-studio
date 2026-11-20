-- Deployed 2026-11-20: Vuba Brain private source documents.
-- Run after brain.sql; contains additive schema and policies.
alter table public.studio_brain_entries add column if not exists archived_at timestamptz;
alter table public.studio_brain_entries add column if not exists archived_by uuid references auth.users(id);
create table if not exists public.studio_brain_documents(
 id uuid primary key default gen_random_uuid(),
 filename text not null check(length(filename) between 1 and 255),
 storage_path text not null unique,
 mime_type text not null,
 file_size integer not null check(file_size between 1 and 15728640),
 title text not null check(length(trim(title)) between 1 and 250),
 description text not null default '',
 extracted_text text not null default '',
 extraction_status text not null default 'pending' check(extraction_status in ('extracted','partial','unavailable','pending')),
 verification text not null default 'needs_review' check(verification in ('needs_review','approved','superseded')),
 archived_at timestamptz,
 uploaded_by uuid not null references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists studio_brain_documents_active_idx on public.studio_brain_documents(archived_at,created_at desc);
alter table public.studio_brain_documents enable row level security;
revoke all on public.studio_brain_documents from anon;
grant select,insert,update on public.studio_brain_documents to authenticated;
create policy "Studio team reads Brain documents" on public.studio_brain_documents for select to authenticated
 using(studio_private.studio_role() is not null);
create policy "Studio team uploads Brain documents" on public.studio_brain_documents for insert to authenticated
 with check(studio_private.studio_role() in ('admin','approver','editor') and uploaded_by=(select auth.uid()) and verification='needs_review' and archived_at is null);
create policy "Brain leads update documents" on public.studio_brain_documents for update to authenticated
 using(studio_private.studio_role() in ('admin','approver'))
 with check(studio_private.studio_role() in ('admin','approver') and updated_by=(select auth.uid()));
create trigger studio_brain_doc_updated before update on public.studio_brain_documents for each row
 execute function public.studio_brain_set_updated_at();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('vuba-brain-documents','vuba-brain-documents',false,15728640,
 array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=excluded.allowed_mime_types;
create policy "Studio team reads private Brain files" on storage.objects for select to authenticated
 using(bucket_id='vuba-brain-documents' and studio_private.studio_role() is not null);
create policy "Studio team adds own Brain files" on storage.objects for insert to authenticated
 with check(bucket_id='vuba-brain-documents' and studio_private.studio_role() in ('admin','approver','editor')
 and (storage.foldername(name))[1]=(select auth.uid())::text);
create or replace function studio_private.brain_reset_approval_on_edit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (new.title,new.body,new.category,new.source_label,new.source_path,new.source_date)
 is distinct from (old.title,old.body,old.category,old.source_label,old.source_path,old.source_date)
 and old.verification='approved' then new.verification='needs_review'; end if;
 return new;
end;$$;
create trigger brain_reset_approval before update on public.studio_brain_entries
 for each row execute function studio_private.brain_reset_approval_on_edit();
create or replace function studio_private.brain_doc_reset_approval_on_edit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if (new.title,new.description,new.extracted_text) is distinct from
 (old.title,old.description,old.extracted_text) and old.verification='approved' then
 new.verification='needs_review';end if;
 return new;
end;$$;
create trigger brain_doc_reset_approval before update on public.studio_brain_documents
 for each row execute function studio_private.brain_doc_reset_approval_on_edit();
