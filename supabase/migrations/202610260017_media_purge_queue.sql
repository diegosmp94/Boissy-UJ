-- Boissy UJ | Etape 80 : retrait irrevocable et purge Storage.
-- Le retrait de visibilite est commis AVANT l'appel Storage API.
-- Une purge interrompue reste invisible et peut etre reprise. Aucun fichier
-- n'est efface directement en SQL : Storage API supprime les octets.
begin;

create table if not exists app_private.news_media_purge_jobs(
 asset_id uuid primary key,
 storage_path text not null unique,
 requested_by uuid not null references auth.users(id) on delete restrict,
 requested_at timestamptz not null default now(),
 completed_at timestamptz,
 constraint news_media_purge_state check(completed_at is null or completed_at>=requested_at)
);
alter table app_private.news_media_purge_jobs enable row level security;
revoke all on app_private.news_media_purge_jobs from public,anon,authenticated;

-- Prevent republishing, altering a queued media or reusing a purged path,
-- even if the caller bypasses the editor RPC.
create or replace function app_private.guard_news_media_purge()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if tg_op='DELETE' then
  if exists (select 1 from storage.objects o
    where o.bucket_id='boissy-uj-approved' and o.name=old.storage_path)
  then raise exception 'Remove the Storage object before deleting media metadata'
    using errcode='23503'; end if;
  return old;
 end if;
 if exists (select 1 from app_private.news_media_purge_jobs j
    where j.asset_id=new.id or j.storage_path=new.storage_path)
 then raise exception 'Media path is queued for permanent removal' using errcode='23514';
 end if;
 return new;
end;
$fn$;
revoke all on function app_private.guard_news_media_purge() from public,anon,authenticated;
drop trigger if exists news_media_guard_purge on public.news_media_assets;
create trigger news_media_guard_purge
 before insert or update or delete on public.news_media_assets
 for each row execute function app_private.guard_news_media_purge();

-- The helper is private (non-exposed schema), callable by Storage RLS only.
-- Permission checks do not rely on client-supplied role metadata.
create or replace function app_private.media_purge_authorized(p_path text)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select (select auth.uid()) is not null
   and coalesce((select app_private.is_admin()),false)
   and exists(select 1 from app_private.news_media_purge_jobs j
     where j.storage_path=p_path and j.completed_at is null);
$fn$;
revoke all on function app_private.media_purge_authorized(text) from public,anon,authenticated;
grant execute on function app_private.media_purge_authorized(text) to authenticated;

-- A delayed step-79 upload must not revive an already withdrawn file.
-- Preserve its create-only INSERT policy, additionally reject queued paths.
create or replace function app_private.media_path_upload_allowed(p_path text)
returns boolean language sql stable security definer set search_path=''
as $fn$
 select not exists(select 1 from app_private.news_media_purge_jobs j
   where j.storage_path=p_path);
$fn$;
revoke all on function app_private.media_path_upload_allowed(text) from public,anon,authenticated;
grant execute on function app_private.media_path_upload_allowed(text) to authenticated;
drop policy if exists boissy_admin_staged_media_upload on storage.objects;
create policy boissy_admin_staged_media_upload
 on storage.objects for insert to authenticated
 with check (
  bucket_id='boissy-uj-approved'
  and coalesce((select app_private.is_admin()),false)
  and name ~ '^incoming/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp|avif|mp4|webm)$'
  and char_length(name)<=180
  and app_private.media_path_upload_allowed(name)
  and exists (select 1 from public.news_media_assets a
   where a.storage_path=name and a.visible=false and a.rights_reviewed=false)
 );

-- DELETE on one queued object only; no listing, public DELETE, UPDATE or
-- public link access is introduced. Signed URLs still require approved media.
drop policy if exists boissy_admin_queued_media_delete on storage.objects;
create policy boissy_admin_queued_media_delete
 on storage.objects for delete to authenticated
 using (
  bucket_id='boissy-uj-approved'
  and storage.allow_only_operation('object.delete')
  and app_private.media_purge_authorized(name)
 );

-- First phase: synchronously withdraw rights/visibility, create a durable
-- private tombstone and audit it. Idempotent when a request is retried.
create or replace function public.admin_begin_news_media_purge(p_asset_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_post uuid;
 v_old public.news_media_assets%rowtype;
 v_new public.news_media_assets%rowtype;
 v_job app_private.news_media_purge_jobs%rowtype;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA AAL2 required' using errcode='42501'; end if;
 if p_asset_id is null then raise exception 'Media id required' using errcode='22023'; end if;
 -- Same lock order as admin_save_news_media (parent, then media row).
 select post_id into v_post from public.news_media_assets where id=p_asset_id;
 if v_post is not null then
  perform 1 from public.news_posts where id=v_post for update;
  select * into v_old from public.news_media_assets where id=p_asset_id for update;
 end if;
 select * into v_job from app_private.news_media_purge_jobs
   where asset_id=p_asset_id for update;
 if found then
  return jsonb_build_object('status',
    case when v_job.completed_at is null then 'pending' else 'completed' end,
    'path',case when v_job.completed_at is null then v_job.storage_path else null end);
 end if;
 if v_old.id is null then
  raise exception 'Unknown media asset' using errcode='22023';
 end if;
 update public.news_media_assets set visible=false,rights_reviewed=false,
   updated_at=clock_timestamp()
 where id=p_asset_id returning * into v_new;
 insert into app_private.news_media_change_audit(
  asset_id,actor_user_id,before_snapshot,after_snapshot)
 values(p_asset_id,v_actor,to_jsonb(v_old),to_jsonb(v_new));
 insert into app_private.news_media_purge_jobs(asset_id,storage_path,requested_by)
 values(p_asset_id,v_old.storage_path,v_actor);
 return jsonb_build_object('status','pending','path',v_old.storage_path);
end;
$fn$;

-- Finalize ONLY after Storage API actually removed the object. Nothing in
-- this function can erase Storage metadata without deleting file bytes.
create or replace function public.admin_finish_news_media_purge(p_asset_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_job app_private.news_media_purge_jobs%rowtype;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA AAL2 required' using errcode='42501'; end if;
 if p_asset_id is null then raise exception 'Media id required' using errcode='22023'; end if;
 select * into v_job from app_private.news_media_purge_jobs
   where asset_id=p_asset_id for update;
 if not found then raise exception 'Purge was not requested' using errcode='22023'; end if;
 if v_job.completed_at is not null then return true; end if;
 if exists(select 1 from storage.objects o
   where o.bucket_id='boissy-uj-approved' and o.name=v_job.storage_path)
 then raise exception 'Storage file still exists; retry deletion'
   using errcode='55000'; end if;
 -- DELETE trigger double-checks Storage absence. The audit and purge
 -- tombstone survive metadata removal for internal accountability.
 delete from public.news_media_assets where id=p_asset_id
   and storage_path=v_job.storage_path;
 update app_private.news_media_purge_jobs
   set completed_at=clock_timestamp() where asset_id=p_asset_id;
 return true;
end;
$fn$;
revoke all on function public.admin_begin_news_media_purge(uuid) from public,anon,authenticated;
revoke all on function public.admin_finish_news_media_purge(uuid) from public,anon,authenticated;
grant execute on function public.admin_begin_news_media_purge(uuid) to authenticated;
grant execute on function public.admin_finish_news_media_purge(uuid) to authenticated;
comment on table app_private.news_media_purge_jobs is
 'Private irreversible media purge queue. Pending tombstones revoke visibility even on failed Storage removal.';
commit;
