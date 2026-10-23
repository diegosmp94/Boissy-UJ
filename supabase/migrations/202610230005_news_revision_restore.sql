-- Boissy-UJ | Étape 56 : consultation/retour arrière des actualités, MFA AAL2.
-- Préparer en staging, aucune modification de la production depuis ce commit.
-- Les snapshots précédents sont déjà stockés dans staff_news_audit.
begin;

alter table public.staff_news_audit
  drop constraint if exists staff_news_audit_action_check;
alter table public.staff_news_audit
  add constraint staff_news_audit_action_check
  check (action in (
    'create_draft','create_publish','edit_draft','edit_publish',
    'unpublish','restore_draft'
  ));

-- Historique autorisé UNIQUEMENT aux administrateurs MFA AAL2.
-- Ne jamais retourner le JSON brut de l'audit (qui contient des IDs internes).
create or replace function public.admin_list_news_revisions(p_post_id uuid)
returns table (
 revision_id bigint,
 recorded_at timestamptz,
 action text,
 title text,
 excerpt text,
 body text,
 was_published boolean
)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null
   or (select auth.jwt()->>'aal') is distinct from 'aal2'
   or not coalesce((select app_private.is_admin()),false) then
   raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_post_id is null or not exists(
   select 1 from public.news_posts p
   where p.id=p_post_id and p.content_kind='article' and p.visibility='public'
 ) then
   raise exception 'Article not found' using errcode='22023';
 end if;
 return query
  select a.id,a.created_at,a.action,
    left(a.new_state->>'title',180),
    left(a.new_state->>'excerpt',400),
    left(a.new_state->>'body',20000),
    (a.new_state->>'status'='published')
  from public.staff_news_audit a
  where a.post_id=p_post_id
    and a.new_state->>'content_kind'='article'
    and a.new_state->>'visibility'='public'
  order by a.id desc
  limit 40;
end;
$fn$;

-- Restitution uniquement au statut DRAFT, avec droits à l'image à revoir.
-- Optimistic lock: deny if another editor has saved since the user's preview.
create or replace function public.admin_restore_news_revision(
 p_post_id uuid,p_revision_id bigint,p_expected_updated_at timestamptz
)
returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_old public.news_posts%rowtype;
 v_new public.news_posts%rowtype;
 v_snapshot jsonb;
 v_title text;
 v_excerpt text;
 v_body text;
begin
 if v_actor is null
   or (select auth.jwt()->>'aal') is distinct from 'aal2'
   or not coalesce((select app_private.is_admin()),false) then
   raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_post_id is null or p_revision_id is null or p_revision_id<1
   or p_expected_updated_at is null then
   raise exception 'Invalid revision selection' using errcode='22023';
 end if;

 select * into v_old
 from public.news_posts p where p.id=p_post_id for update;
 if not found or v_old.content_kind<>'article' or v_old.visibility<>'public'
   or v_old.team_id is null then
   raise exception 'Only existing public text articles may be restored'
     using errcode='42501';
 end if;
 if v_old.updated_at is distinct from p_expected_updated_at then
   raise exception 'Article was modified; refresh before restoring'
     using errcode='40001';
 end if;
 select a.new_state into v_snapshot
   from public.staff_news_audit a
   where a.id=p_revision_id and a.post_id=p_post_id;
 if not found or v_snapshot is null or
   v_snapshot->>'id' is distinct from p_post_id::text or
   v_snapshot->>'team_id' is distinct from v_old.team_id::text or
   v_snapshot->>'content_kind' is distinct from 'article' or
   v_snapshot->>'visibility' is distinct from 'public' then
   raise exception 'Revision does not belong to this article and team'
     using errcode='42501';
 end if;

 v_title:=btrim(v_snapshot->>'title');
 v_excerpt:=btrim(v_snapshot->>'excerpt');
 v_body:=btrim(v_snapshot->>'body');
 if v_title is null or char_length(v_title) not between 4 and 180
   or v_excerpt is null or char_length(v_excerpt)>400
   or v_body is null or char_length(v_body) not between 1 and 20000 then
   raise exception 'Saved revision content is invalid' using errcode='22023';
 end if;

 update public.news_posts
 set title=v_title,excerpt=v_excerpt,body=v_body,
     status='draft',consent_reviewed=false,published_at=null,
     updated_at=clock_timestamp()
 where id=p_post_id returning * into v_new;

 insert into public.staff_news_audit(
    post_id,team_id,actor_user_id,action,previous_state,new_state
 ) values (
    p_post_id,v_old.team_id,v_actor,'restore_draft',
    to_jsonb(v_old),to_jsonb(v_new)
 );
 return true;
end;
$fn$;

-- Read-only capability probe; avoids showing a half-installed editor on main.
create or replace function public.admin_news_revisions_ready()
returns boolean
language sql stable security definer set search_path=''
as $fn$
 select coalesce((select app_private.is_admin()),false)
   and coalesce((select auth.jwt()->>'aal')='aal2',false);
$fn$;
revoke all on function public.admin_news_revisions_ready()
 from public,anon,authenticated;
grant execute on function public.admin_news_revisions_ready()
 to authenticated;

revoke all on function public.admin_list_news_revisions(uuid)
 from public,anon,authenticated;
revoke all on function public.admin_restore_news_revision(uuid,bigint,timestamptz)
 from public,anon,authenticated;
grant execute on function public.admin_list_news_revisions(uuid)
 to authenticated;
grant execute on function public.admin_restore_news_revision(uuid,bigint,timestamptz)
 to authenticated;
comment on function public.admin_restore_news_revision(uuid,bigint,timestamptz)
 is 'MFA AAL2 administrator only, same-article revision, optimistic lock; restore to unpublished draft and reset consent.';
commit;
