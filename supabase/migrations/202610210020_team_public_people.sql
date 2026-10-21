-- Étape 21 : trombinoscope public distinct des comptes/membres privés.
-- Aucune donnée personnelle créée ; tout contenu reste en brouillon par défaut.
begin;

create table if not exists public.team_public_people (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.club_teams(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  person_kind text not null check (person_kind in ('player','coach','staff')),
  role_label text not null check (char_length(btrim(role_label)) between 2 and 80),
  shirt_number smallint check (shirt_number between 1 and 99),
  biography text not null default '' check (char_length(biography) <= 280),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  published boolean not null default false,
  consent_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_people_publish_requires_consent check (not published or consent_confirmed),
  constraint team_people_shirt_only_player check (shirt_number is null or person_kind='player')
);
create index if not exists team_people_public_directory_idx
  on public.team_public_people(team_id,person_kind,sort_order)
  where published=true and consent_confirmed=true;

alter table public.team_public_people enable row level security;
revoke all on table public.team_public_people from public, anon, authenticated;
grant select on table public.team_public_people to anon, authenticated;
drop policy if exists team_people_published_with_consent on public.team_public_people;
create policy team_people_published_with_consent
  on public.team_public_people for select to anon, authenticated
  using (published=true and consent_confirmed=true);
comment on table public.team_public_people is
  'Vitrine sportive facultative, distincte des comptes privés. Pas de donnée importée. Publication autorisée après vérification explicite des droits et, si nécessaire, autorisation du responsable légal.';

create table if not exists app_private.team_public_people_audit (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  actor_user_id uuid not null,
  action text not null check(action in ('create_draft','create_publish','edit_draft','edit_publish','unpublish')),
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table app_private.team_public_people_audit enable row level security;
revoke all on table app_private.team_public_people_audit from public, anon, authenticated;

create or replace function public.admin_list_team_public_people()
returns setof public.team_public_people
language plpgsql stable security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if not coalesce((select app_private.is_admin()),false) then
    raise exception 'Administrator MFA required' using errcode='42501';
  end if;
  return query select p.* from public.team_public_people p
    order by p.team_id,p.person_kind,p.sort_order,p.id;
end;
$function$;

create or replace function public.admin_save_team_public_person(
  p_id uuid,
  p_team_id uuid,
  p_display_name text,
  p_person_kind text,
  p_role_label text,
  p_shirt_number integer,
  p_biography text,
  p_sort_order integer,
  p_publish boolean,
  p_consent_confirmed boolean,
  p_expected_updated_at timestamptz default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_old public.team_public_people%rowtype;
  v_new public.team_public_people%rowtype;
  v_action text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if not coalesce((select app_private.is_admin()),false) then
    raise exception 'Administrator MFA required' using errcode='42501';
  end if;
  if p_team_id is null or not exists(select 1 from public.club_teams t where t.id=p_team_id)
    or p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 100
    or p_person_kind is null or p_person_kind not in ('player','coach','staff')
    or p_role_label is null or char_length(btrim(p_role_label)) not between 2 and 80
    or p_shirt_number is not null and (p_shirt_number not between 1 and 99 or p_person_kind<>'player')
    or p_biography is null or char_length(p_biography)>280
    or p_sort_order is null or p_sort_order not between 0 and 10000
    or p_publish is null or p_consent_confirmed is null
    or (p_publish and not p_consent_confirmed)
  then
    raise exception 'Invalid or unauthorized public profile' using errcode='22023';
  end if;
  if p_id is null then
    if p_expected_updated_at is not null then
      raise exception 'Unexpected version' using errcode='22023';
    end if;
    insert into public.team_public_people(
      team_id,display_name,person_kind,role_label,shirt_number,biography,
      sort_order,published,consent_confirmed
    ) values (
      p_team_id,btrim(p_display_name),p_person_kind,btrim(p_role_label),
      p_shirt_number,p_biography,p_sort_order,p_publish,p_consent_confirmed
    ) returning * into v_new;
    v_action:=case when p_publish then 'create_publish' else 'create_draft' end;
  else
    select * into v_old from public.team_public_people where id=p_id for update;
    if not found then
      raise exception 'Person not found' using errcode='22023';
    end if;
    if p_expected_updated_at is null or p_expected_updated_at is distinct from v_old.updated_at then
      raise exception 'Profile changed: reload before saving' using errcode='40001';
    end if;
    update public.team_public_people set
      team_id=p_team_id,display_name=btrim(p_display_name),person_kind=p_person_kind,
      role_label=btrim(p_role_label),shirt_number=p_shirt_number,biography=p_biography,
      sort_order=p_sort_order,published=p_publish,consent_confirmed=p_consent_confirmed,
      updated_at=greatest(clock_timestamp(),v_old.updated_at+interval '1 microsecond')
    where id=p_id returning * into v_new;
    v_action:=case when v_old.published and not p_publish then 'unpublish'
      when p_publish then 'edit_publish' else 'edit_draft' end;
  end if;
  insert into app_private.team_public_people_audit
    (person_id,actor_user_id,action,before_snapshot,after_snapshot)
  values(v_new.id,v_actor,v_action,
    case when p_id is null then null else to_jsonb(v_old) end,to_jsonb(v_new));
  return v_new.id;
end;
$function$;

revoke all on function public.admin_list_team_public_people() from public, anon;
grant execute on function public.admin_list_team_public_people() to authenticated;
revoke all on function public.admin_save_team_public_person(
  uuid,uuid,text,text,text,integer,text,integer,boolean,boolean,timestamptz
) from public, anon;
grant execute on function public.admin_save_team_public_person(
  uuid,uuid,text,text,text,integer,text,integer,boolean,boolean,timestamptz
) to authenticated;
comment on function public.admin_save_team_public_person(
  uuid,uuid,text,text,text,integer,text,integer,boolean,boolean,timestamptz
) is 'SECURITY DEFINER nécessaire pour l’édition, refus total aux anonymes, admin + AAL2 via app_private.is_admin, vérification des droits, audit et version optimiste.';

commit;
