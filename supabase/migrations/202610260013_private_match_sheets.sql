-- Boissy UJ · Step 74 — scoped private match sheets and live callup lifecycle.
-- Do not create fixtures, athletes or callups. No public player directory.
begin;
create or replace function public.staff_list_match_sheet(p_match_id uuid)
returns table(
 player_user_id uuid, display_name text,
 position_group text, shirt_number smallint,
 callup_response text, team_name text,
 opponent_name text, scheduled_at timestamptz
)
language plpgsql stable security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_team uuid;
begin
 if v_actor is null then
  raise exception 'Authentication required' using errcode='28000';
 end if;
 select m.team_id into v_team from public.matches m
 where m.id=p_match_id and m.match_status in ('scheduled','postponed');
 if not found then
  raise exception 'Match unavailable for private sheet' using errcode='22023';
 end if;
 if not (
  coalesce((select app_private.is_admin()),false)
  or exists(
   select 1 from public.user_roles r
   join public.staff_team_assignments a on a.coach_user_id=r.user_id
   where r.user_id=v_actor and r.role='coach'
    and a.team_id=v_team and a.active=true
  )
 ) then
  raise exception 'Team scope denied' using errcode='42501';
 end if;
 return query
 select c.player_user_id,p.display_name,
        s.position_group,s.shirt_number,
        c.response,t.name,m.opponent_name,m.scheduled_at
 from app_private.match_callups c
 join public.matches m on m.id=c.match_id
 join public.club_teams t on t.id=m.team_id
 join public.user_roles r on r.user_id=c.player_user_id
   and r.role='player'
 join app_private.team_player_memberships tm
   on tm.team_id=m.team_id and tm.player_user_id=c.player_user_id
    and tm.active=true
 join public.profiles p on p.id=c.player_user_id
 left join app_private.team_player_positions s
   on s.team_id=m.team_id and s.player_user_id=c.player_user_id
 where c.match_id=p_match_id
   and m.team_id=v_team
   and m.match_status in ('scheduled','postponed')
   and c.response in ('invited','confirmed','declined','unsure')
 order by s.shirt_number nulls last,p.display_name,c.player_user_id
 limit 150;
end;
$fn$;

-- Player list is strictly for fixtures still accepting replies.
CREATE OR REPLACE FUNCTION public.player_my_callups()
 RETURNS TABLE(match_id uuid, team_name text, opponent_name text, scheduled_at timestamp with time zone, response text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.match_id,t.name,m.opponent_name,m.scheduled_at,c.response
  from app_private.match_callups c
  join public.matches m on m.id=c.match_id
  join public.club_teams t on t.id=m.team_id
  join app_private.team_player_memberships tm on tm.team_id=m.team_id
    and tm.player_user_id=c.player_user_id and tm.active=true
  where c.player_user_id=(select auth.uid())
    and c.response<>'cancelled'
    and m.match_status in ('scheduled','postponed')
    and exists(select 1 from public.user_roles r
      where r.user_id=c.player_user_id and r.role='player')
  order by m.scheduled_at asc;
$function$;

-- Do not accept a reply after a fixture was finalized or cancelled while
-- the player was replying. Shared match lock blocks concurrent finalization.
CREATE OR REPLACE FUNCTION public.player_respond_callup(p_match_id uuid, p_response text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_team uuid;
  v_prior text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_match_id is null or p_response is null
     or p_response not in ('confirmed','declined','unsure') then
    raise exception 'Invalid response or match' using errcode='22023';
  end if;

  -- Verrou de lecture conservé jusqu'à la transaction : une révocation
  -- concurrente du rôle joueur doit attendre (ou est constatée ici).
  perform 1 from public.user_roles r
    where r.user_id=v_actor and r.role='player'
    for share of r;
  if not found then
    raise exception 'Approved player role required' using errcode='42501';
  end if;

  -- Toute affiliation retirée bloque immédiatement les réponses.
  -- Le verrou empêche le retrait en cours de transaction de passer
  -- entre la vérification du périmètre et l'écriture de la réponse.
  select tm.team_id into v_team
    from app_private.team_player_memberships tm
    join public.matches m on m.team_id=tm.team_id
    where m.id=p_match_id
      and m.match_status not in ('cancelled','played')
      and tm.player_user_id=v_actor and tm.active=true
    for share of tm;
  if not found then
    raise exception 'Active player team affiliation required' using errcode='42501';
  end if;

  -- Match row remains protected until the response commits. A concurrent
  -- cancellation or final score cannot sneak between the original lookup
  -- and the response update.
  perform 1 from public.matches m
    where m.id=p_match_id and m.team_id=v_team
      and m.match_status in ('scheduled','postponed')
    for share of m;
  if not found then
    raise exception 'Match no longer available for response'
      using errcode='42501';
  end if;

  -- Une invitation annulée ne peut pas être réactivée par le joueur.
  select c.response into v_prior
    from app_private.match_callups c
    where c.match_id=p_match_id and c.player_user_id=v_actor
    for update of c;
  if not found or v_prior='cancelled' then
    raise exception 'No active invitation' using errcode='42501';
  end if;

  update app_private.match_callups
    set response=p_response,responded_at=now(),updated_at=now()
    where match_id=p_match_id and player_user_id=v_actor;
  insert into app_private.callup_action_audit
    (match_id,player_user_id,actor_user_id,action)
    values(p_match_id,v_actor,v_actor,
      case p_response when 'confirmed' then 'confirm'
           when 'declined' then 'decline' else 'unsure' end);
  return true;
end;
$function$;

revoke all on function public.staff_list_match_sheet(uuid) from public,anon,authenticated;
grant execute on function public.staff_list_match_sheet(uuid) to authenticated;
revoke all on function public.player_my_callups() from public,anon,authenticated;
grant execute on function public.player_my_callups() to authenticated;
revoke all on function public.player_respond_callup(uuid,text) from public,anon,authenticated;
grant execute on function public.player_respond_callup(uuid,text) to authenticated;
comment on function public.staff_list_match_sheet(uuid) is
 'Private scoped roster: only already invited and actively affiliated players, no contact data and no public access.';
commit;