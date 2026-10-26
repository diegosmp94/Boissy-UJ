-- Step 73: AAL2-only multi-team affiliations and audited history.
-- No membership or player records are inserted by this migration.
begin;
create or replace function public.admin_player_team_overview(p_player_user_id uuid)
returns table(team_id uuid,team_name text,active boolean,position_group text,shirt_number smallint,assigned_at timestamptz)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_player_user_id is null or not exists(select 1 from public.profiles where id=p_player_user_id) then
  raise exception 'Unknown member' using errcode='22023';
 end if;
 return query select m.team_id,t.name,m.active,
   case when m.active then s.position_group else null end,
   case when m.active then s.shirt_number else null end,
   m.created_at
 from app_private.team_player_memberships m
 join public.club_teams t on t.id=m.team_id
 left join app_private.team_player_positions s
  on s.team_id=m.team_id and s.player_user_id=m.player_user_id
 where m.player_user_id=p_player_user_id
 order by m.active desc,t.sort_order,t.name limit 50;
end;
$fn$;
create or replace function public.admin_player_assignment_history(p_player_user_id uuid)
returns table(changed_at timestamptz,team_name text,event_kind text,detail text)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_player_user_id is null or not exists(select 1 from public.profiles where id=p_player_user_id) then
  raise exception 'Unknown member' using errcode='22023';
 end if;
 return query select h.changed_at,t.name,h.event_kind,h.detail
 from (
  select a.team_id,a.changed_at,'affiliation'::text event_kind,
   (case when a.next_active then 'Affiliation activée' else 'Affiliation retirée' end)::text detail
  from app_private.team_membership_admin_audit a where a.player_user_id=p_player_user_id
  union all
  select a.team_id,a.changed_at,'poste'::text,
   ('Poste : '||coalesce(a.before_position,'—')||' → '||a.after_position||
    ' · N° '||coalesce(a.before_number::text,'—')||' → '||a.after_number::text)::text
  from app_private.team_player_position_audit a where a.player_user_id=p_player_user_id
  union all
  select a.team_id,a.released_at,'libération'::text,
   ('Maillot n° '||a.previous_shirt_number::text||' libéré après désaffiliation')::text
  from app_private.team_player_position_release_audit a where a.player_user_id=p_player_user_id
 ) h join public.club_teams t on t.id=h.team_id
 order by h.changed_at desc,h.event_kind limit 50;
end;
$fn$;
revoke all on function public.admin_player_team_overview(uuid) from public,anon,authenticated;
grant execute on function public.admin_player_team_overview(uuid) to authenticated;
revoke all on function public.admin_player_assignment_history(uuid) from public,anon,authenticated;
grant execute on function public.admin_player_assignment_history(uuid) to authenticated;
commit;