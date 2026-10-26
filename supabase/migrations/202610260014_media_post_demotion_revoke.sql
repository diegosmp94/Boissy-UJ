-- Boissy UJ | Step 78 | media rights revocation + narrow Storage signing.
-- The private bucket, metadata RLS, MFA admin RPCs and MIME/size checks
-- already exist in production: do not reapply their initial migration.
-- Does not upload, publish, remove or fabricate any image/video.
begin;

-- Private, append-only log. No direct client SELECT or write grants.
create table if not exists app_private.news_media_revocation_audit (
 id bigint generated always as identity primary key,
 asset_id uuid not null,
 post_id uuid not null,
 actor_user_id uuid references auth.users(id) on delete set null,
 reason text not null check(reason in ('post_no_longer_public')),
 changed_at timestamptz not null default now()
);
alter table app_private.news_media_revocation_audit enable row level security;
revoke all on app_private.news_media_revocation_audit
 from public,anon,authenticated;

-- Once published content is withdrawn, remove visible/rights approval.
-- Future republication cannot silently resurrect previously approved media.
-- Article first, media second: preserves existing admin_save_news_media lock order.
create or replace function app_private.revoke_news_media_on_post_demotion()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
begin
 if old.status='published' and old.visibility='public'
   and old.consent_reviewed=true and old.published_at<=now()
   and (
     new.status is distinct from 'published'
     or new.visibility is distinct from 'public'
     or new.consent_reviewed is distinct from true
     or new.published_at is null or new.published_at>now()
   )
 then
  with revoked as (
    update public.news_media_assets a
       set visible=false,rights_reviewed=false,updated_at=clock_timestamp()
     where a.post_id=new.id and (a.visible or a.rights_reviewed)
    returning a.id,a.post_id
  )
  insert into app_private.news_media_revocation_audit(
    asset_id,post_id,actor_user_id,reason
  )
  select r.id,r.post_id,(select auth.uid()),'post_no_longer_public'
    from revoked r;
 end if;
 return new;
end;
$fn$;

drop trigger if exists news_media_post_demotion_guard on public.news_posts;
create trigger news_media_post_demotion_guard
 after update of status,visibility,consent_reviewed,published_at
 on public.news_posts for each row
 execute function app_private.revoke_news_media_on_post_demotion();

revoke all on function app_private.revoke_news_media_on_post_demotion()
 from public,anon,authenticated;

-- Supabase Storage shares SELECT privilege for object listing, signing
-- and downloads. Allow only the operations actually used by the public
-- gallery: signing one or many approved objects. In particular, exclude
-- object.list / list_v2 and unauthenticated full bucket enumeration.
-- This uses the operation-aware helper documented by Supabase Storage.
drop policy if exists boissy_approved_media_sign_read on storage.objects;
create policy boissy_approved_media_sign_read
on storage.objects for select to anon,authenticated
using (
 bucket_id='boissy-uj-approved'
 and storage.allow_any_operation(array['object.sign','object.sign_many'])
 and exists (
   select 1
   from public.news_media_assets a
   join public.news_posts p on p.id=a.post_id
   where a.storage_path=name and a.visible=true
     and a.rights_reviewed=true
     and p.visibility='public'
     and p.status='published'
     and p.consent_reviewed=true
     and p.published_at<=now()
 )
);

comment on function app_private.revoke_news_media_on_post_demotion() is
 'Fail closed on withdrawing public article: invalidate approved media and write private audit. Existing issued signed URLs expire on their original TTL.';
commit;
