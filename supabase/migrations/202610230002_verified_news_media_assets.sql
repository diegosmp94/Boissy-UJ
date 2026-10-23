-- Etape 48: médias photo et vidéo liés aux articles publics Boissy-UJ.
-- Aucune vidéo automatique, URL tierce, ni identité publiquement exposée.
-- Migration additive à déployer seulement après recette et validation droits à l'image.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('boissy-uj-approved','boissy-uj-approved',true,50000000,
 array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
on conflict(id) do nothing;
-- Aucun droit INSERT/UPDATE/DELETE sur storage.objects n'est attribué au navigateur :
-- fichiers téléchargés par un responsable habilité via le Dashboard après revue des droits.

create table if not exists public.news_media_assets(
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.news_posts(id) on delete cascade,
 kind text not null check(kind in ('photo','video')),
 storage_path text not null check (
   char_length(storage_path) between 8 and 180
   and storage_path ~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|avif|mp4|webm)$'
   and position('..' in storage_path)=0
 ),
 alt_text text not null check(char_length(btrim(alt_text)) between 4 and 200),
 caption text not null default '' check(char_length(caption)<=400),
 sort_order integer not null default 0 check(sort_order between 0 and 11),
 rights_reviewed boolean not null default false,
 visible boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint news_media_rights_required check (not visible or rights_reviewed),
 constraint news_media_file_type check (
  (kind='photo' and storage_path ~* '\.(jpg|jpeg|png|webp|avif)$')
  or (kind='video' and storage_path ~* '\.(mp4|webm)$')
 )
);
-- Associate each approved public object with only one article at a time.
create unique index if not exists news_media_unique_storage_path_idx on public.news_media_assets(storage_path);
create index if not exists news_media_published_idx
  on public.news_media_assets(post_id,sort_order,id) where visible and rights_reviewed;
alter table public.news_media_assets enable row level security;
revoke all on public.news_media_assets from public,anon,authenticated;
grant select(id,post_id,kind,storage_path,alt_text,caption,sort_order,visible,rights_reviewed)
  on public.news_media_assets to anon,authenticated;

create policy news_media_visible_with_public_post
 on public.news_media_assets for select to anon,authenticated using (
 visible and rights_reviewed
 and exists (
  select 1 from public.news_posts n
  where n.id=post_id and n.visibility='public'
    and n.status='published' and n.consent_reviewed
    and n.published_at<=now()
 )
);

create table if not exists app_private.news_media_change_audit (
 id bigint generated always as identity primary key,
 asset_id uuid not null,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 before_snapshot jsonb,
 after_snapshot jsonb not null,
 created_at timestamptz not null default now()
);
alter table app_private.news_media_change_audit enable row level security;
revoke all on app_private.news_media_change_audit from public,anon,authenticated;

create or replace function public.admin_list_news_media()
returns setof public.news_media_assets
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator AAL2 required' using errcode='42501'; end if;
 return query select m.* from public.news_media_assets m
 order by m.created_at desc,m.id limit 500;
end;
$fn$;

-- Private server-only helper: presence, MIME and size of an approved object.
-- These metadata checks do not replace a legal or malware content review.
create or replace function app_private.media_file_ready(p_path text,p_kind text)
returns boolean
language sql stable security definer set search_path=''
as $fn$
 select exists (
  select 1 from storage.objects o
  join storage.buckets b on b.id=o.bucket_id
  where o.bucket_id='boissy-uj-approved' and b.public=true
    and o.name=p_path
    and (case when o.metadata->>'size' ~ '^[0-9]{1,9}$'
          then (o.metadata->>'size')::bigint else 0 end) between 1 and 50000000
    and (
      (p_kind='photo' and (
       (p_path ~* '\.jpe?g$' and o.metadata->>'mimetype'='image/jpeg')
       or (p_path ~* '\.png$' and o.metadata->>'mimetype'='image/png')
       or (p_path ~* '\.webp$' and o.metadata->>'mimetype'='image/webp')
       or (p_path ~* '\.avif$' and o.metadata->>'mimetype'='image/avif')
      ))
      or (p_kind='video' and (
       (p_path ~* '\.mp4$' and o.metadata->>'mimetype'='video/mp4')
       or (p_path ~* '\.webm$' and o.metadata->>'mimetype'='video/webm')
      ))
    )
 );
$fn$;
revoke all on function app_private.media_file_ready(text,text) from public,anon,authenticated;

-- AAL2-only read-only preflight. Missing, wrong-format and oversize files return false.
create or replace function public.admin_check_news_media_file(p_kind text,p_path text)
returns boolean
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_path is null or p_kind is null then return false; end if;
 return (select app_private.media_file_ready(p_path,p_kind));
end;
$fn$;
revoke all on function public.admin_check_news_media_file(text,text) from public,anon,authenticated;
grant execute on function public.admin_check_news_media_file(text,text) to authenticated;

create or replace function public.admin_save_news_media(
 p_id uuid,p_post_id uuid,p_kind text,p_path text,p_alt text,
 p_caption text,p_sort_order integer,p_visible boolean,p_rights_reviewed boolean
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_old public.news_media_assets%rowtype;
 v_new public.news_media_assets%rowtype;
 v_id uuid;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false) then
   raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_post_id is null or p_kind not in ('photo','video') or p_kind is null
    or p_path is null or length(p_path) not between 8 and 180
    or p_path !~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|avif|mp4|webm)$'
    or position('..' in p_path)>0
    or p_alt is null or length(btrim(p_alt)) not between 4 and 200
    or p_caption is null or length(p_caption)>400
    or p_sort_order is null or p_sort_order not between 0 and 11
    or p_visible is null or p_rights_reviewed is null
    or (p_visible and not p_rights_reviewed)
    or (p_kind='photo' and p_path !~* '\.(jpg|jpeg|png|webp|avif)$')
    or (p_kind='video' and p_path !~* '\.(mp4|webm)$')
 then raise exception 'Invalid media metadata' using errcode='22023'; end if;
 -- Fail closed at the database, even if a client bypasses the preflight button.
 if p_visible and not (select app_private.media_file_ready(p_path,p_kind)) then
   raise exception 'Approved Storage file absent or unsafe'
     using errcode='22023';
 end if;
 -- Lock parent to serialize insert limits and prevent races against publish changes.
 perform 1 from public.news_posts
  where id=p_post_id and visibility='public'
  for update;
 if not found then raise exception 'Public article unavailable' using errcode='42501'; end if;
 if p_id is null then
  if (select count(*) from public.news_media_assets where post_id=p_post_id)>=12
  then raise exception 'Maximum 12 assets per article' using errcode='22023'; end if;
  v_id:=gen_random_uuid();
  insert into public.news_media_assets
   (id,post_id,kind,storage_path,alt_text,caption,sort_order,visible,rights_reviewed)
  values(v_id,p_post_id,p_kind,p_path,btrim(p_alt),p_caption,p_sort_order,p_visible,p_rights_reviewed)
  returning * into v_new;
 else
  select * into v_old from public.news_media_assets where id=p_id for update;
  if not found or v_old.post_id<>p_post_id then
    raise exception 'Media asset unavailable for this article' using errcode='42501';
  end if;
  update public.news_media_assets set kind=p_kind,storage_path=p_path,
   alt_text=btrim(p_alt),caption=p_caption,sort_order=p_sort_order,
   visible=p_visible,rights_reviewed=p_rights_reviewed,
   updated_at=clock_timestamp() where id=p_id returning * into v_new;
  v_id:=p_id;
 end if;
 insert into app_private.news_media_change_audit(asset_id,actor_user_id,before_snapshot,after_snapshot)
 values(v_id,v_actor,case when p_id is null then null else to_jsonb(v_old) end,to_jsonb(v_new));
 return v_id;
end;
$fn$;
revoke all on function public.admin_list_news_media() from public,anon,authenticated;
revoke all on function public.admin_save_news_media(uuid,uuid,text,text,text,text,integer,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.admin_list_news_media() to authenticated;
grant execute on function public.admin_save_news_media(uuid,uuid,text,text,text,text,integer,boolean,boolean)
 to authenticated;
comment on function public.admin_check_news_media_file(text,text) is
 'Admin + MFA AAL2 only: check approved Storage object and metadata without exposing private files.';
comment on table public.news_media_assets is
  'Media Center Boissy UJ: verified photo/video metadata; public only after article publication and rights check.';
commit;
