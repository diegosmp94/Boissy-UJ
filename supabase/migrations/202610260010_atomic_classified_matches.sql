-- Boissy UJ step 71: all published matches must have an explicit competition
-- and the editor must write match + competition in one database transaction.
-- Read-only public pages continue to show *only* confirmed published rows.
-- Preflight 2026-10-26: zero matches in production; no existing rows mutated.
begin;

-- DEFERRABLE is important: creation saves the fixture with the existing
-- staff_save_match RPC before assigning its competition in the same transaction.
-- This trigger queries the final stored row, not an intermediate NEW image.
create or replace function app_private.require_published_match_competition()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
declare
 v_match public.matches%rowtype;
begin
 select * into v_match from public.matches where id=new.id;
 if found and v_match.published then
  if v_match.competition_kind not in ('league','cup','friendly') or
     (v_match.competition_kind in ('league','cup') and
       nullif(btrim(v_match.competition_label),'') is null) then
   raise exception 'Published match requires an approved competition'
     using errcode='23514';
  end if;
 end if;
 return null;
end;
$fn$;

drop trigger if exists published_match_competition_guard on public.matches;
create constraint trigger published_match_competition_guard
 after insert or update on public.matches
 deferrable initially deferred
 for each row execute function app_private.require_published_match_competition();

revoke all on function app_private.require_published_match_competition()
 from public,anon,authenticated;

create or replace function public.admin_save_classified_match(
 p_match_id uuid,
 p_team_id uuid,
 p_season_id uuid,
 p_opponent_name text,
 p_scheduled_at timestamptz,
 p_venue text,
 p_is_home boolean,
 p_match_status text,
 p_home_score smallint,
 p_away_score smallint,
 p_source_kind text,
 p_source_reference text,
 p_publish boolean,
 p_competition_kind text,
 p_competition_label text
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_label text := nullif(btrim(p_competition_label),'');
 v_id uuid;
 v_previous public.matches%rowtype;
 v_existing_kind text;
 v_existing_label text;
begin
 if v_actor is null then
  raise exception 'Authentication required' using errcode='28000';
 end if;
 if not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_competition_kind is null or
    p_competition_kind not in ('league','cup','friendly','unspecified') or
    (v_label is not null and
      (length(v_label) not between 3 and 100 or v_label ~ '[[:cntrl:]]')) or
    (p_competition_kind='unspecified' and v_label is not null) or
    (p_competition_kind in ('league','cup') and v_label is null) or
    (p_publish and p_competition_kind='unspecified') then
  raise exception 'Choose a valid championship, cup or friendly before publishing'
    using errcode='22023';
 end if;

 -- A single ACL-protected transaction spans match, category and both audits.
 -- The inner RPC has its own team and match row locking and score validation.
 v_id:=public.staff_save_match(
  p_match_id,p_team_id,p_season_id,p_opponent_name,p_scheduled_at,
  p_venue,p_is_home,p_match_status,p_home_score,p_away_score,
  p_source_kind,p_source_reference,p_publish
 );
 select * into v_previous from public.matches where id=v_id for update;
 if not found then
  raise exception 'Saved match not found' using errcode='22023';
 end if;
 v_existing_kind:=v_previous.competition_kind;
 v_existing_label:=v_previous.competition_label;
 update public.matches
    set competition_kind=p_competition_kind,
        competition_label=v_label,
        updated_at=now()
    where id=v_id;
 if v_existing_kind is distinct from p_competition_kind
     or v_existing_label is distinct from v_label then
  insert into app_private.match_competition_audit(
   match_id,actor_user_id,old_kind,old_label,new_kind,new_label
  ) values(
   v_id,v_actor,v_existing_kind,v_existing_label,p_competition_kind,v_label
  );
 end if;
 return v_id;
end;
$fn$;

revoke all on function public.admin_save_classified_match(
 uuid,uuid,uuid,text,timestamptz,text,boolean,text,smallint,smallint,text,text,boolean,text,text
) from public,anon,authenticated;
grant execute on function public.admin_save_classified_match(
 uuid,uuid,uuid,text,timestamptz,text,boolean,text,smallint,smallint,text,text,boolean,text,text
) to authenticated;

comment on function public.admin_save_classified_match(
 uuid,uuid,uuid,text,timestamptz,text,boolean,text,smallint,smallint,text,text,boolean,text,text
) is 'Administrator AAL2: atomic match, competition and both private audit trails. Never publish unclassified.';
commit;
