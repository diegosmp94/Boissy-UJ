-- Étape 18 — CMS identité du club : rédaction et publication MFA uniquement.
-- Aucune donnée initiale et aucun droit direct de modification publique.
begin;

create table if not exists app_private.club_identity_change_log (
  id bigint generated always as identity primary key,
  section_id uuid not null references public.club_identity_sections(id),
  actor_user_id uuid not null references auth.users(id),
  action text not null check (action in ('create_draft','create_publish','edit_draft','edit_publish','unpublish')),
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists club_identity_change_log_section_idx
  on app_private.club_identity_change_log(section_id,created_at desc);
alter table app_private.club_identity_change_log enable row level security;
revoke all on app_private.club_identity_change_log from public,anon,authenticated;
revoke all on sequence app_private.club_identity_change_log_id_seq from public,anon,authenticated;

-- SECURITY DEFINER est intentionnel : aucune lecture de brouillon depuis REST.
-- La fonction s'exécute seulement si le rôle admin est présent en base ET MFA AAL2.
create or replace function public.admin_list_club_identity()
returns setof public.club_identity_sections
language plpgsql stable security definer
set search_path = ''
as $fn$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if not coalesce((select app_private.is_admin()),false) then
    raise exception 'Administrator MFA required' using errcode='42501';
  end if;
  return query select s.* from public.club_identity_sections s
    order by s.section,s.sort_order,s.id;
end;
$fn$;

-- Modification atomique, avec verrouillage de ligne et contrôle d'une version lue.
-- Un brouillon peut être sauvegardé sans attestation ; publier requiert une attestation.
create or replace function public.admin_save_club_identity(
  p_id uuid,
  p_section text,
  p_title text,
  p_body text,
  p_sort_order integer,
  p_publish boolean,
  p_rights_confirmed boolean,
  p_expected_updated_at timestamptz default null
)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_old public.club_identity_sections%rowtype;
  v_new public.club_identity_sections%rowtype;
  v_id uuid;
  v_action text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if not coalesce((select app_private.is_admin()),false) then
    raise exception 'Administrator MFA required' using errcode='42501';
  end if;
  if p_section is null or p_section not in ('history','values','governance','projects')
     or p_title is null or char_length(btrim(p_title)) not between 4 and 160
     or p_body is null or char_length(btrim(p_body)) not between 10 and 6000
     or p_sort_order is null or p_sort_order not between 0 and 10000
     or p_publish is null or p_rights_confirmed is null
  then
    raise exception 'Invalid club content' using errcode='22023';
  end if;
  if p_publish and not p_rights_confirmed then
    raise exception 'Publication requires consent and rights review' using errcode='22023';
  end if;

  if p_id is null then
    if p_expected_updated_at is not null then
      raise exception 'Version supplied for new content' using errcode='22023';
    end if;
    insert into public.club_identity_sections(section,title,body,sort_order,published)
      values(p_section,btrim(p_title),btrim(p_body),p_sort_order,p_publish)
      returning * into v_new;
    v_id:=v_new.id;
    v_action:=case when p_publish then 'create_publish' else 'create_draft' end;
  else
    select * into v_old from public.club_identity_sections where id=p_id for update;
    if not found then
      raise exception 'Content not found' using errcode='22023';
    end if;
    if p_expected_updated_at is null or p_expected_updated_at is distinct from v_old.updated_at then
      raise exception 'Content changed: reload before editing' using errcode='40001';
    end if;
    update public.club_identity_sections
       set section=p_section,title=btrim(p_title),body=btrim(p_body),
           sort_order=p_sort_order,published=p_publish,
           updated_at=greatest(clock_timestamp(),v_old.updated_at + interval '1 microsecond')
     where id=p_id returning * into v_new;
    v_id:=p_id;
    v_action:=case
      when v_old.published=true and p_publish=false then 'unpublish'
      when p_publish=true then 'edit_publish'
      else 'edit_draft'
    end;
  end if;

  insert into app_private.club_identity_change_log(
    section_id,actor_user_id,action,before_snapshot,after_snapshot
  ) values (
    v_id,v_actor,v_action,
    case when p_id is null then null else to_jsonb(v_old) end,
    to_jsonb(v_new)
  );
  return v_id;
end;
$fn$;

revoke all on function public.admin_list_club_identity() from public,anon,authenticated;
grant execute on function public.admin_list_club_identity() to authenticated;
revoke all on function public.admin_save_club_identity(
 uuid,text,text,text,integer,boolean,boolean,timestamptz
) from public,anon,authenticated;
grant execute on function public.admin_save_club_identity(
 uuid,text,text,text,integer,boolean,boolean,timestamptz
) to authenticated;

comment on function public.admin_list_club_identity() is
 'MFA AAL2 + approved admin only: includes draft club sections, never anon.';
comment on function public.admin_save_club_identity(uuid,text,text,text,integer,boolean,boolean,timestamptz) is
 'MFA admin content workflow; rights attestation for publishing; optimistic versioning and private audit.';
commit;
