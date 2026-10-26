-- Boissy-UJ: release numbers when an approved player leaves a team.
-- Additive backend integrity guard, no identities or memberships are seeded.
begin;

create table if not exists app_private.team_player_position_release_audit (
 id bigint generated always as identity primary key,
 team_id uuid not null,
 player_user_id uuid not null,
 previous_position_group text not null,
 previous_shirt_number smallint not null check(previous_shirt_number between 1 and 99),
 released_at timestamptz not null default pg_catalog.clock_timestamp(),
 reason text not null check(reason in ('membership_deactivated','membership_deleted')),
 actor_user_id uuid
);
alter table app_private.team_player_position_release_audit enable row level security;
revoke all on table app_private.team_player_position_release_audit from public,anon,authenticated;
revoke all on sequence app_private.team_player_position_release_audit_id_seq from public,anon,authenticated;
comment on table app_private.team_player_position_release_audit is
 'Private audit of released football shirt numbers; identifiers only, no public exposure.';

-- A BEFORE trigger ensures no inactive membership continues occupying a
-- team-unique jersey number. DELETE is also covered (before FK cascade).
create or replace function app_private.release_position_on_membership_exit()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
declare
 v_position app_private.team_player_positions%rowtype;
 v_reason text;
begin
 if TG_OP='UPDATE' then
  if OLD.active is distinct from true or NEW.active is distinct from false then
   return NEW;
  end if;
  v_reason:='membership_deactivated';
 else
  v_reason:='membership_deleted';
 end if;
 -- Serialize with staff_set_affiliated_player_position for the same team.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(OLD.team_id::text,17409)
 );
 select * into v_position
 from app_private.team_player_positions
 where team_id=OLD.team_id and player_user_id=OLD.player_user_id
 for update;
 if found then
  insert into app_private.team_player_position_release_audit (
   team_id,player_user_id,previous_position_group,
   previous_shirt_number,reason,actor_user_id
  ) values (
   OLD.team_id,OLD.player_user_id,v_position.position_group,
   v_position.shirt_number,v_reason,(select auth.uid())
  );
  delete from app_private.team_player_positions
   where team_id=OLD.team_id and player_user_id=OLD.player_user_id;
 end if;
 if TG_OP='UPDATE' then return NEW; end if;
 return OLD;
end;
$fn$;

revoke execute on function app_private.release_position_on_membership_exit()
 from public,anon,authenticated;

drop trigger if exists team_membership_release_jersey
 on app_private.team_player_memberships;
create trigger team_membership_release_jersey
before update of active or delete on app_private.team_player_memberships
for each row execute function app_private.release_position_on_membership_exit();

-- Inactive pre-existing memberships could otherwise occupy numbers forever.
-- Record any such removal; no-op in currently empty production roster.
with stale as (
 select p.team_id,p.player_user_id,p.position_group,p.shirt_number
 from app_private.team_player_positions p
 join app_private.team_player_memberships m
  on m.team_id=p.team_id and m.player_user_id=p.player_user_id
 where m.active=false
 for update of p
), history as (
 insert into app_private.team_player_position_release_audit(
  team_id,player_user_id,previous_position_group,previous_shirt_number,
  reason,actor_user_id
 )
 select team_id,player_user_id,position_group,shirt_number,
   'membership_deactivated',null from stale
 returning team_id,player_user_id
)
delete from app_private.team_player_positions p
using history h where p.team_id=h.team_id and p.player_user_id=h.player_user_id;

commit;
