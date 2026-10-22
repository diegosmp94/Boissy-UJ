-- Étape 35 / P2 — corrections de nom d'affichage, autorisées et tracées.
-- Aucun accès admin.auth, changement de rôle, création ou suppression de compte.
begin;
create table if not exists app_private.member_profile_change_audit (
 id bigint generated always as identity primary key,
 actor_user_id uuid not null,
 subject_user_id uuid not null,
 old_display_name text not null,
 new_display_name text not null,
 changed_at timestamptz not null default now(),
 constraint member_profile_audit_no_self check(actor_user_id<>subject_user_id)
);
alter table app_private.member_profile_change_audit enable row level security;
revoke all on app_private.member_profile_change_audit from public,anon,authenticated;

create or replace function public.admin_update_member_display_name(
 p_member_id uuid,p_display_name text
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_name text;
 v_old text;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_member_id is null or p_member_id=v_actor then
  raise exception 'Self modification is not allowed' using errcode='42501';
 end if;
 v_name:=pg_catalog.btrim(p_display_name);
 if v_name is null or char_length(v_name)<2 or char_length(v_name)>80
  or v_name ~ '[[:cntrl:]]' then
  raise exception 'Invalid display name' using errcode='22023';
 end if;
 select p.display_name into v_old from public.profiles p
  where p.id=p_member_id for update;
 if not found then
  raise exception 'Profile not found' using errcode='22023';
 end if;
 if v_old=v_name then
  raise exception 'Display name is unchanged' using errcode='22023';
 end if;
 update public.profiles set display_name=v_name,updated_at=now()
  where id=p_member_id;
 insert into app_private.member_profile_change_audit(
  actor_user_id,subject_user_id,old_display_name,new_display_name
 ) values (v_actor,p_member_id,v_old,v_name);
 return true;
end;
$fn$;
revoke all on function public.admin_update_member_display_name(uuid,text) from public,anon;
grant execute on function public.admin_update_member_display_name(uuid,text) to authenticated;
comment on function public.admin_update_member_display_name(uuid,text) is
 'MFA AAL2-only member display name correction with audit; forbids self-change.';
commit;
