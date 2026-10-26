-- Boissy-UJ step 67: serialize grant checks with the existing writes.
-- Admin must use MFA AAL2. No grant to anon, no rows or features seeded.
-- Role first -> assignment/membership second -> content/callup rows.
begin;
-- Reviewed: admin_set_coach_team_assignment
CREATE OR REPLACE FUNCTION public.admin_set_coach_team_assignment(p_team_id uuid, p_coach_user_id uuid, p_active boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid := (select auth.uid());
 v_old_active boolean;
 v_found boolean;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false) then
   raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_team_id is null or p_coach_user_id is null or p_active is null then
   raise exception 'Invalid coach assignment' using errcode='22023';
 end if;
 if p_coach_user_id=v_actor then
   raise exception 'Self-assignment is forbidden' using errcode='42501';
 end if;
 if not exists(select 1 from public.club_teams where id=p_team_id) then
   raise exception 'Unknown club team' using errcode='22023';
 end if;
 -- Hold the target coach role stable through the assignment write.
 perform 1 from public.user_roles r
   where r.user_id=p_coach_user_id and r.role='coach'
   for share of r;
 if not found then
   raise exception 'Approved coach role is required' using errcode='42501';
 end if;

 -- Serialize simultaneous admin decisions for this specific member and team.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_team_id::text||':'||p_coach_user_id::text,0)
 );
 select a.active into v_old_active from public.staff_team_assignments a
  where a.coach_user_id=p_coach_user_id and a.team_id=p_team_id for update;
 v_found:=found;
 if v_found and v_old_active=p_active then
   raise exception 'Assignment already has this state' using errcode='22023';
 end if;
 if not v_found and not p_active then
   raise exception 'No active assignment to revoke' using errcode='22023';
 end if;
 if p_active then
   insert into public.staff_team_assignments(coach_user_id,team_id,active,granted_by,granted_at)
   values(p_coach_user_id,p_team_id,true,v_actor,now())
   on conflict (coach_user_id,team_id) do update
    set active=true,granted_by=excluded.granted_by,granted_at=excluded.granted_at;
 else
   update public.staff_team_assignments set active=false
    where coach_user_id=p_coach_user_id and team_id=p_team_id;
 end if;
 insert into app_private.coach_team_assignment_audit(
  actor_user_id,coach_user_id,team_id,prior_active,next_active
 ) values(v_actor,p_coach_user_id,p_team_id,v_old_active,p_active);
 return true;
end;
$function$;

-- Reviewed: admin_set_player_team_membership
CREATE OR REPLACE FUNCTION public.admin_set_player_team_membership(p_team_id uuid, p_player_user_id uuid, p_active boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_actor uuid := (SELECT auth.uid());
    v_old_active boolean;
BEGIN
    IF v_actor IS NULL
        OR NOT COALESCE((SELECT app_private.is_admin()), FALSE)
    THEN
        RAISE EXCEPTION 'Administrator MFA required'
            USING ERRCODE = '42501';
    END IF;

    IF p_team_id IS NULL
        OR p_player_user_id IS NULL
        OR p_active IS NULL
    THEN
        RAISE EXCEPTION 'Invalid assignment'
            USING ERRCODE = '22023';
    END IF;

    IF v_actor = p_player_user_id THEN
        RAISE EXCEPTION 'Self-assignment prohibited'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.club_teams t
        WHERE t.id = p_team_id
    ) THEN
        RAISE EXCEPTION 'Unknown team'
            USING ERRCODE = '22023';
    END IF;

    -- Pin the grant before the existing per-team advisory and membership locks.
    PERFORM 1 FROM public.user_roles r
    WHERE r.user_id=p_player_user_id AND r.role='player'
    FOR SHARE OF r;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'An approved player role is required'
            USING ERRCODE='42501';
    END IF;

    -- Même verrou transactionnel que la fonction
    -- d'affectation des numéros.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            p_team_id::text,
            17409
        )
    );

    SELECT tm.active
    INTO v_old_active
    FROM app_private.team_player_memberships tm
    WHERE tm.team_id = p_team_id
        AND tm.player_user_id = p_player_user_id
    FOR UPDATE;

    IF FOUND AND v_old_active = p_active THEN
        RAISE EXCEPTION 'Membership already has this state'
            USING ERRCODE = '22023';
    END IF;

    IF NOT FOUND AND NOT p_active THEN
        RAISE EXCEPTION 'No active membership to revoke'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO app_private.team_player_memberships (
        team_id,
        player_user_id,
        active
    )
    VALUES (
        p_team_id,
        p_player_user_id,
        p_active
    )
    ON CONFLICT (team_id, player_user_id)
    DO UPDATE SET
        active = EXCLUDED.active;

    INSERT INTO app_private.team_membership_admin_audit (
        actor_user_id,
        player_user_id,
        team_id,
        prior_active,
        next_active
    )
    VALUES (
        v_actor,
        p_player_user_id,
        p_team_id,
        v_old_active,
        p_active
    );

    RETURN TRUE;
END;
$function$;

-- Reviewed: staff_save_match
CREATE OR REPLACE FUNCTION public.staff_save_match(p_match_id uuid, p_team_id uuid, p_season_id uuid, p_opponent_name text, p_scheduled_at timestamp with time zone, p_venue text, p_is_home boolean, p_match_status text, p_home_score smallint, p_away_score smallint, p_source_kind text, p_source_reference text, p_publish boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_admin boolean := false;
  v_team_code text;
  v_can_edit boolean := false;
  v_match_id uuid;
  v_before public.matches%rowtype;
  v_after public.matches%rowtype;
  v_action text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_admin := (select app_private.is_admin());
  select code into v_team_code from public.club_teams
    where id = p_team_id;
  if not found then
    raise exception 'Team unavailable' using errcode = '22023';
  end if;
  v_can_edit := exists (
    select 1 from public.user_roles r
    inner join public.staff_team_assignments a
      on a.coach_user_id = r.user_id
    where r.user_id = v_actor
      and r.role = 'coach'
      and a.team_id = p_team_id
      and a.active = true
  );
  if not (v_admin or v_can_edit) then
    raise exception 'Team scope denied' using errcode = '42501';
  end if;

  -- Validate and lock the effective grant until the match update commits.
  if v_admin then
    perform 1 from public.user_roles r
      where r.user_id=v_actor and r.role='admin'
      for share of r;
  else
    perform 1 from public.user_roles r
      join public.staff_team_assignments a
        on a.coach_user_id=r.user_id
      where r.user_id=v_actor and r.role='coach'
        and a.team_id=p_team_id and a.active=true
      for share of r,a;
  end if;
  if not found then
    raise exception 'Team scope revoked before match write' using errcode='42501';
  end if;


  if p_opponent_name is null or length(btrim(p_opponent_name)) not between 2 and 120
    or p_scheduled_at is null
    or p_is_home is null or p_publish is null
    or p_match_status is null
    or p_match_status not in ('scheduled','played','postponed','cancelled')
    or p_source_kind is null or p_source_kind not in ('manual','fff')
    or (p_venue is not null and length(p_venue) > 160)
  then
    raise exception 'Invalid match fields' using errcode = '22023';
  end if;

  if (p_match_status = 'played' and
    (p_home_score is null or p_away_score is null
     or p_home_score not between 0 and 99
     or p_away_score not between 0 and 99))
    or (p_match_status <> 'played' and
      (p_home_score is not null or p_away_score is not null))
  then
    raise exception 'Score and status mismatch' using errcode = '22023';
  end if;

  if (p_source_kind = 'fff'
    and (v_team_code = 'c'
      or p_source_reference is null
      or length(btrim(p_source_reference)) not between 1 and 300))
    or (p_source_reference is not null and
      length(p_source_reference) > 300)
  then
    raise exception 'Invalid verified-source reference' using errcode = '22023';
  end if;

  if p_season_id is not null and not exists (
    select 1 from public.club_seasons where id = p_season_id
  ) then
    raise exception 'Season not found' using errcode = '22023';
  end if;

  if p_match_id is null then
    v_match_id := gen_random_uuid();
    insert into public.matches(
      id,team_id,season_id,opponent_name,scheduled_at,venue,is_home,
      home_score,away_score,match_status,source_kind,source_reference,published
    ) values (
      v_match_id,p_team_id,p_season_id,btrim(p_opponent_name),
      p_scheduled_at,nullif(btrim(p_venue),''),
      p_is_home,p_home_score,p_away_score,p_match_status,
      p_source_kind,nullif(btrim(p_source_reference),''),p_publish
    ) returning * into v_after;
    v_action := case when p_publish then 'create_publish' else 'create_draft' end;
  else
    select * into v_before
      from public.matches where id = p_match_id for update;
    if not found then
      raise exception 'Match unavailable' using errcode = '22023';
    end if;
    -- Coaches may not seize or move a fixture from another team.
    if not v_admin and v_before.team_id is distinct from p_team_id then
      raise exception 'Cannot transfer match between teams' using errcode = '42501';
    end if;
    update public.matches set
      team_id = p_team_id,
      season_id = p_season_id,
      opponent_name = btrim(p_opponent_name),
      scheduled_at = p_scheduled_at,
      venue = nullif(btrim(p_venue),''),
      is_home = p_is_home,
      home_score = p_home_score,
      away_score = p_away_score,
      match_status = p_match_status,
      source_kind = p_source_kind,
      source_reference = nullif(btrim(p_source_reference),''),
      published = p_publish,
      updated_at = now()
    where id = p_match_id returning * into v_after;
    v_match_id := p_match_id;
    v_action := case when not p_publish and v_before.published
      then 'unpublish'
      when p_publish then 'edit_publish' else 'edit_draft' end;
  end if;

  insert into app_private.match_change_log(
    match_id,actor_user_id,team_id,action,before_snapshot,after_snapshot
  ) values (
    v_match_id,v_actor,p_team_id,v_action,
    case when p_match_id is null then null else to_jsonb(v_before) end,
    to_jsonb(v_after)
  );
  return v_match_id;
end;
$function$;

-- Reviewed: staff_save_news_article
CREATE OR REPLACE FUNCTION public.staff_save_news_article(p_post_id uuid, p_team_id uuid, p_title text, p_excerpt text, p_body text, p_publish boolean, p_rights_confirmed boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- A removed coach grant must not authorize a later article write.
  if v_is_admin then
    perform 1 from public.user_roles r
      where r.user_id=v_actor and r.role='admin'
      for share of r;
  else
    perform 1 from public.user_roles r
      join public.staff_team_assignments a
        on a.coach_user_id=r.user_id
      where r.user_id=v_actor and r.role='coach'
        and a.team_id=p_team_id and a.active=true
      for share of r,a;
  end if;
  if not found then
    raise exception 'Publishing scope revoked before write' using errcode='42501';
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

-- Reviewed: staff_set_callup
CREATE OR REPLACE FUNCTION public.staff_set_callup(p_match_id uuid, p_player_user_id uuid, p_invite boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_team uuid;
  v_admin boolean;
  v_scope boolean;
  v_old_response text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_match_id is null or p_player_user_id is null or p_invite is null then
    raise exception 'Missing callup information' using errcode='22023';
  end if;

  select m.team_id into v_team from public.matches m
    where m.id=p_match_id
      and m.match_status not in ('played','cancelled');
  if not found then
    raise exception 'Match not found' using errcode='22023';
  end if;

  v_admin := coalesce((select app_private.is_admin()),false);
  v_scope := exists(
    select 1 from public.user_roles r
    join public.staff_team_assignments a on a.coach_user_id=r.user_id
    where r.user_id=v_actor and r.role='coach'
      and a.team_id=v_team and a.active=true
  );
  if not (v_admin or v_scope) then
    raise exception 'Team scope denied' using errcode='42501';
  end if;

  -- Lock the actor's verified grants BEFORE the match and callup rows.
  if v_admin then
    perform 1 from public.user_roles r
      where r.user_id=v_actor and r.role='admin'
      for share of r;
  else
    perform 1 from public.user_roles r
      join public.staff_team_assignments a
        on a.coach_user_id=r.user_id
      where r.user_id=v_actor and r.role='coach'
        and a.team_id=v_team and a.active=true
      for share of r,a;
  end if;
  if not found then
    raise exception 'Staff team scope revoked before callup write' using errcode='42501';
  end if;

  -- A player must retain the approved role and active team membership.
  perform 1 from public.user_roles r
    where r.user_id=p_player_user_id and r.role='player'
    for share of r;
  if not found then
    raise exception 'Approved player role required' using errcode='42501';
  end if;
  perform 1 from app_private.team_player_memberships tm
    where tm.player_user_id=p_player_user_id and tm.team_id=v_team
      and tm.active=true
    for share of tm;
  if not found then
    raise exception 'Active team affiliation required' using errcode='42501';
  end if;

  -- Prevent a match status/team change between the lookup and the invite.
  perform 1 from public.matches m
    where m.id=p_match_id and m.team_id=v_team
      and m.match_status not in ('played','cancelled')
    for share of m;
  if not found then
    raise exception 'Match unavailable before callup write' using errcode='42501';
  end if;


  if not exists(
    select 1 from app_private.team_player_memberships tm
    join public.user_roles r on r.user_id=tm.player_user_id
    where tm.player_user_id=p_player_user_id and tm.team_id=v_team
      and tm.active=true and r.role='player'
  ) then
    raise exception 'Player is not an active team member' using errcode='42501';
  end if;

  select response into v_old_response from app_private.match_callups
    where match_id=p_match_id and player_user_id=p_player_user_id for update;

  if p_invite then
    insert into app_private.match_callups(match_id,player_user_id,response,responded_at,updated_at)
      values (p_match_id,p_player_user_id,'invited',null,now())
      on conflict(match_id,player_user_id)
      do update set response='invited',responded_at=null,updated_at=now();
  else
    if v_old_response is null then
      raise exception 'Callup not found' using errcode='22023';
    end if;
    update app_private.match_callups
      set response='cancelled',responded_at=null,updated_at=now()
      where match_id=p_match_id and player_user_id=p_player_user_id;
  end if;

  insert into app_private.callup_action_audit
    (match_id,player_user_id,actor_user_id,action)
    values(p_match_id,p_player_user_id,v_actor,
      case when not p_invite then 'cancel'
           when v_old_response is null then 'invite'
           else 'reinvite' end);
  return true;
end;
$function$;

revoke all on function public.admin_set_coach_team_assignment(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_set_coach_team_assignment(uuid,uuid,boolean) to authenticated;
revoke all on function public.admin_set_player_team_membership(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_set_player_team_membership(uuid,uuid,boolean) to authenticated;
revoke all on function public.staff_save_match(uuid,uuid,uuid,text,timestamp with time zone,text,boolean,text,smallint,smallint,text,text,boolean) from public,anon,authenticated;
grant execute on function public.staff_save_match(uuid,uuid,uuid,text,timestamp with time zone,text,boolean,text,smallint,smallint,text,text,boolean) to authenticated;
revoke all on function public.staff_save_news_article(uuid,uuid,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.staff_save_news_article(uuid,uuid,text,text,text,boolean,boolean) to authenticated;
revoke all on function public.staff_set_callup(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.staff_set_callup(uuid,uuid,boolean) to authenticated;
commit;
