-- Boissy UJ | Étape 67 : une convocation ne peut être répondue que
-- par un Joueur encore approuvé ET affilié activement à l'équipe du match.
-- Verrous dans l'ordre role -> affiliation -> convocation : coordonne
-- la révocation de rôle et d'affiliation, sans rendre une table publique.
begin;

create or replace function public.player_respond_callup(
  p_match_id uuid,p_response text
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
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
$fn$;

revoke all on function public.player_respond_callup(uuid,text)
  from public,anon,authenticated;
grant execute on function public.player_respond_callup(uuid,text)
  to authenticated;
comment on function public.player_respond_callup(uuid,text) is
 'Authenticated approved player only; active team affiliation and invitation locked before response; own invitation; append-only audit.';

commit;
