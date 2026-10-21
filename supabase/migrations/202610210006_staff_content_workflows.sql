-- Boissy-UJ — staff editorial workflow (PREPARED, NOT APPLIED)
-- Requires 202610210001 auth, 202610210002 MFA,
-- 202610210003 teams and 202610210004 news.
-- Do not deploy without separate Supabase approval and dynamic RLS tests.
begin;

create table if not exists public.staff_team_assignments (
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.club_teams(id) on delete cascade,
  active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (coach_user_id,team_id)
);

create table if not exists public.staff_news_audit (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.news_posts(id) on delete restrict,
  team_id uuid not null references public.club_teams(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('create_draft','create_publish','edit_draft','edit_publish','unpublish')),
  previous_state jsonb,
  new_state jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.news_posts
  add column if not exists author_user_id uuid references auth.users(id) on delete set null;

create index if not exists staff_team_lookup_idx
  on public.staff_team_assignments (team_id,coach_user_id) where active;
create index if not exists staff_news_audit_post_idx
  on public.staff_news_audit (post_id,created_at desc);

alter table public.staff_team_assignments enable row level security;
alter table public.staff_news_audit enable row level security;

revoke all on public.staff_team_assignments, public.staff_news_audit from anon,authenticated;
grant select on public.staff_team_assignments to authenticated;
create policy staff_assignments_read_own_or_admin on public.staff_team_assignments
for select to authenticated
using (coach_user_id = (select auth.uid()) or (select app_private.is_admin()));

-- No client INSERT/UPDATE/DELETE policies for assignments or audits.
-- Server privileged administration must validate grantor and write audit.

create or replace function public.staff_save_news_article(
  p_post_id uuid,
  p_team_id uuid,
  p_title text,
  p_excerpt text,
  p_body text,
  p_publish boolean,
  p_rights_confirmed boolean
) returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_is_admin boolean := false;
  v_coach_this_team boolean := false;
  v_post_id uuid;
  v_old public.news_posts%rowtype;
  v_new public.news_posts%rowtype;
  v_action text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  v_is_admin := (select app_private.is_admin());
  v_coach_this_team := exists (
    select 1 from public.user_roles r
    join public.staff_team_assignments a on a.coach_user_id=r.user_id
    where r.user_id=v_actor and r.role='coach'
      and a.team_id=p_team_id and a.active=true
  );

  if not (v_is_admin or v_coach_this_team) then
    raise exception 'Team publishing permission denied' using errcode='42501';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 4 and 180
    or p_excerpt is null or char_length(p_excerpt)>400
    or p_body is null or char_length(btrim(p_body)) not between 1 and 20000
    or p_publish is null or p_rights_confirmed is null
  then
    raise exception 'Invalid article fields' using errcode='22023';
  end if;
  if p_publish and not p_rights_confirmed then
    raise exception 'Publication requires rights review attestation'
      using errcode='22023';
  end if;

  if p_post_id is null then
    v_post_id := gen_random_uuid();
    insert into public.news_posts(
      id,team_id,slug,title,excerpt,body,content_kind,visibility,
      status,consent_reviewed,published_at,author_user_id
    )
    values(
      v_post_id,p_team_id,'actu-'||replace(v_post_id::text,'-',''),
      btrim(p_title),btrim(p_excerpt),btrim(p_body),'article','public',
      case when p_publish then 'published' else 'draft' end,
      p_rights_confirmed,
      case when p_publish then now() else null end,
      v_actor
    )
    returning * into v_new;
    v_action := case when p_publish then 'create_publish' else 'create_draft' end;
  else
    select * into v_old from public.news_posts
      where id=p_post_id for update;
    if not found then
      raise exception 'Article not found' using errcode='22023';
    end if;
    if v_old.content_kind <> 'article' or v_old.visibility <> 'public' then
      raise exception 'Only public text articles are editable by this operation'
        using errcode='42501';
    end if;
    -- A coach cannot move an article to/from any other team;
    -- an admin with MFA may moderate the club's articles.
    if not v_is_admin and v_old.team_id is distinct from p_team_id then
      raise exception 'Cross-team article changes are prohibited'
        using errcode='42501';
    end if;

    update public.news_posts
      set team_id=p_team_id,
          title=btrim(p_title),
          excerpt=btrim(p_excerpt),
          body=btrim(p_body),
          status=case when p_publish then 'published' else 'draft' end,
          consent_reviewed=p_rights_confirmed,
          published_at=case when p_publish
            then coalesce(v_old.published_at,now())
            else null end,
          updated_at=now()
      where id=p_post_id
      returning * into v_new;
    v_post_id:=p_post_id;
    v_action:=case when not p_publish and v_old.status='published'
      then 'unpublish'
      when p_publish then 'edit_publish' else 'edit_draft' end;
  end if;

  insert into public.staff_news_audit(
    post_id,team_id,actor_user_id,action,previous_state,new_state
  ) values (
    v_post_id,p_team_id,v_actor,v_action,
    case when p_post_id is null then null else to_jsonb(v_old) end,
    to_jsonb(v_new)
  );
  return v_post_id;
end;
$function$;

revoke all on function public.staff_save_news_article(
  uuid,uuid,text,text,text,boolean,boolean
) from public,anon,authenticated;
grant execute on function public.staff_save_news_article(
  uuid,uuid,text,text,text,boolean,boolean
) to authenticated;

comment on function public.staff_save_news_article(
  uuid,uuid,text,text,text,boolean,boolean
) is
  'Secured article draft/publication. Coach requires active team scope + role; admin requires role and MFA AAL2. Changes audited.';

commit;
