-- Boissy-UJ - Step 81: explicit consent for individual player/educator profiles.
-- A roster entry's consent is NOT automatic authorization for a dedicated page.
-- All names remain in the existing separate public sports catalogue, never auth.users.
begin;
alter table public.team_public_people
 add column if not exists profile_visible boolean not null default false,
 add column if not exists profile_consent_confirmed boolean not null default false;

alter table public.team_public_people
 drop constraint if exists team_person_profile_separate_consent;
alter table public.team_public_people
 add constraint team_person_profile_separate_consent
 check (not profile_visible or
   (profile_consent_confirmed and published and consent_confirmed));

-- The flags are publishability metadata only. Existing column-level
-- grants remain unchanged; no private account data is ever granted.
grant select(profile_visible,profile_consent_confirmed)
 on public.team_public_people to anon,authenticated;

-- Any name/team/role/biography/roster consent edit invalidates the
-- previously reviewed individual fiche until it is explicitly reapproved.
create or replace function app_private.reset_public_person_profile_review()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if new.team_id is distinct from old.team_id
   or new.display_name is distinct from old.display_name
   or new.person_kind is distinct from old.person_kind
   or new.role_label is distinct from old.role_label
   or new.shirt_number is distinct from old.shirt_number
   or new.biography is distinct from old.biography
   or new.published is distinct from old.published
   or new.consent_confirmed is distinct from old.consent_confirmed
 then
   new.profile_visible:=false;
   new.profile_consent_confirmed:=false;
 end if;
 return new;
end;
$fn$;
revoke all on function app_private.reset_public_person_profile_review() from public,anon,authenticated;
drop trigger if exists team_person_revoke_profile_on_edit on public.team_public_people;
create trigger team_person_revoke_profile_on_edit
 before update on public.team_public_people for each row
 execute function app_private.reset_public_person_profile_review();

-- Independent, version-locked, audited, AAL2-only action; no profile
-- creation from login accounts, no "consent" derived from a checkbox alone.
create or replace function public.admin_set_public_person_profile(
 p_person_id uuid,
 p_enable boolean,
 p_consent_reviewed boolean,
 p_expected_updated_at timestamptz
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_old public.team_public_people%rowtype;
 v_new public.team_public_people%rowtype;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_person_id is null or p_enable is null or p_consent_reviewed is null
   or p_expected_updated_at is null or (p_enable and not p_consent_reviewed)
 then raise exception 'Explicit individual-profile review required' using errcode='22023';
 end if;
 select * into v_old from public.team_public_people where id=p_person_id for update;
 if not found then raise exception 'Person not found' using errcode='22023'; end if;
 if v_old.updated_at is distinct from p_expected_updated_at then
  raise exception 'Profile changed: reload before saving' using errcode='40001';
 end if;
 if p_enable and (not v_old.published or not v_old.consent_confirmed
   or v_old.person_kind not in ('player','coach','staff')) then
  raise exception 'Person is not approved for public roster' using errcode='42501';
 end if;
 update public.team_public_people
 set profile_visible=p_enable,
  profile_consent_confirmed=(p_enable and p_consent_reviewed),
  updated_at=greatest(clock_timestamp(),v_old.updated_at+interval '1 microsecond')
 where id=p_person_id returning * into v_new;
 insert into app_private.team_public_people_audit(
   person_id,actor_user_id,action,before_snapshot,after_snapshot)
 values (p_person_id,v_actor,
  case when p_enable then 'approve_individual_profile' else 'withdraw_individual_profile' end,
  to_jsonb(v_old),to_jsonb(v_new));
 return true;
end;
$fn$;
revoke all on function public.admin_set_public_person_profile(uuid,boolean,boolean,timestamptz)
 from public,anon,authenticated;
grant execute on function public.admin_set_public_person_profile(uuid,boolean,boolean,timestamptz)
 to authenticated;
comment on column public.team_public_people.profile_visible is
 'Independent opt-in for a dedicated individual sports profile, not a private account.';
commit;
