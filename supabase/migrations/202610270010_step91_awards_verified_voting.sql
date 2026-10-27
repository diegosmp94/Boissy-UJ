-- Boissy-UJ Étape 91 : Awards, candidatures, votes Premium privés et résultats vérifiés.
-- Migration SAFE pour projet principal : gate des votes OFF, aucun vote, nominé ou lauréat créé.
-- Le prototype historique 202610230003_premium_awards_ballots.sql ne doit pas être appliqué.
begin;

-- Optimistic edit checks for nominees across concurrent administrators.
alter table public.club_award_nominees
 add column if not exists updated_at timestamptz not null default now();

create table if not exists app_private.awards_voting_gate (
 id smallint primary key default 1 check (id=1),
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into app_private.awards_voting_gate (id,enabled) values(1,false)
 on conflict(id) do update set enabled=false,updated_at=clock_timestamp();
alter table app_private.awards_voting_gate enable row level security;
revoke all on app_private.awards_voting_gate from public,anon,authenticated;

create table if not exists app_private.award_ballots (
 award_id uuid not null references public.club_awards(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 nominee_id uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(award_id,user_id),
 constraint award_ballot_valid_nominee foreign key(award_id,nominee_id)
  references public.club_award_nominees(award_id,id) on delete restrict
);
create index if not exists award_ballots_by_nominee
 on app_private.award_ballots(award_id,nominee_id);
alter table app_private.award_ballots enable row level security;
revoke all on app_private.award_ballots from public,anon,authenticated;

create table if not exists app_private.admin_awards_audit (
 id bigint generated always as identity primary key,
 award_id uuid not null,
 actor_id uuid not null references auth.users(id) on delete restrict,
 action text not null
  check(action in ('award_create','award_edit','nominee_create',
   'nominee_edit','vote_open','vote_close','result_publish')),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default clock_timestamp()
);
alter table app_private.admin_awards_audit enable row level security;
revoke all on app_private.admin_awards_audit from public,anon,authenticated;

-- Administrators can inspect drafts; public RLS continues hiding unpublished data.
create or replace function public.admin_list_awards()
returns setof public.club_awards
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or
    not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 return query select * from public.club_awards
  order by season_label desc nulls last,created_at desc,id limit 200;
end;
$fn$;

create or replace function public.admin_list_award_nominees(p_award_id uuid)
returns setof public.club_award_nominees
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or
   not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 if p_award_id is null then raise exception 'Award required' using errcode='22023';end if;
 return query select * from public.club_award_nominees
  where award_id=p_award_id order by sort_order,id limit 100;
end;
$fn$;

-- Draft edits require optimistic locking. Once voting has opened,
-- nobody can silently change a category, schedule, consent or nominees.
create or replace function public.admin_save_award(
 p_id uuid,p_slug text,p_title text,p_description text,
 p_team_code text,p_season_label text,p_opens_at timestamptz,
 p_closes_at timestamptz,p_published boolean,
 p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=(select auth.uid());
 previous public.club_awards%rowtype;
 saved public.club_awards%rowtype;
begin
 if actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  or length(p_slug)>100 or p_title is null
  or length(btrim(p_title)) not between 4 and 120
  or p_description is null or length(p_description)>1600
  or p_team_code is null or p_team_code not in ('a','b','c')
  or (p_season_label is not null
   and p_season_label !~ '^[0-9]{4}/[0-9]{4}$')
  or (p_opens_at is null)<>(p_closes_at is null)
  or (p_opens_at is not null and p_closes_at<=p_opens_at)
  or p_published is null then
  raise exception 'Invalid Awards draft' using errcode='22023';
 end if;
 if p_id is null then
  if p_expected_updated_at is not null
  then raise exception 'Unexpected version' using errcode='22023';end if;
  insert into public.club_awards(
   slug,title,description,team_code,season_label,opens_at,closes_at,published)
  values(p_slug,btrim(p_title),p_description,p_team_code,p_season_label,
   p_opens_at,p_closes_at,p_published)
  returning * into saved;
 else
  select * into previous from public.club_awards
   where id=p_id for update;
  if previous.id is null then raise exception 'Award not found' using errcode='22023';end if;
  if previous.voting_status<>'coming' or previous.results_published
   or exists(select 1 from app_private.award_ballots b where b.award_id=p_id)
  then raise exception 'Award already voted: editing frozen' using errcode='42501';end if;
  if p_expected_updated_at is null
    or previous.updated_at is distinct from p_expected_updated_at
  then raise exception 'Award changed: reload' using errcode='40001';end if;
  update public.club_awards set slug=p_slug,title=btrim(p_title),
   description=p_description,team_code=p_team_code,
   season_label=p_season_label,opens_at=p_opens_at,closes_at=p_closes_at,
   published=p_published,
   updated_at=greatest(clock_timestamp(),previous.updated_at+interval '1 microsecond')
  where id=p_id returning * into saved;
 end if;
 insert into app_private.admin_awards_audit(award_id,actor_id,action,details)
 values(saved.id,actor,
  case when p_id is null then 'award_create' else 'award_edit' end,
  jsonb_build_object('published',saved.published,'status',saved.voting_status));
 return saved.id;
end;
$fn$;

create or replace function public.admin_save_award_nominee(
 p_id uuid,p_award_id uuid,p_display_label text,
 p_consent_reviewed boolean,p_published boolean,p_sort_order integer,
 p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=(select auth.uid());
 edition public.club_awards%rowtype;
 item public.club_award_nominees%rowtype;
begin
 if actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 if p_award_id is null or p_display_label is null
  or length(btrim(p_display_label)) not between 2 and 100
  or p_consent_reviewed is null or p_published is null
  or (p_published and not p_consent_reviewed)
  or p_sort_order is null or p_sort_order not between 0 and 10000
 then raise exception 'Nomination and consent invalid' using errcode='22023';end if;
 select * into edition from public.club_awards
  where id=p_award_id for update;
 if edition.id is null or edition.voting_status<>'coming'
  or edition.results_published
  or exists(select 1 from app_private.award_ballots b where b.award_id=p_award_id)
 then raise exception 'Nominees frozen after vote opening' using errcode='42501';end if;
 if p_id is null then
  if p_expected_updated_at is not null then
   raise exception 'Unexpected nominee version' using errcode='22023';end if;
  insert into public.club_award_nominees(
   award_id,display_label,consent_reviewed,published,sort_order)
  values(p_award_id,btrim(p_display_label),p_consent_reviewed,
   p_published,p_sort_order) returning * into item;
 else
  update public.club_award_nominees set
   display_label=btrim(p_display_label),
   consent_reviewed=p_consent_reviewed,published=p_published,
   sort_order=p_sort_order,
   updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond')
  where id=p_id and award_id=p_award_id
   and updated_at=p_expected_updated_at returning * into item;
  if item.id is null then
    raise exception 'Nominee not in award' using errcode='42501';end if;
 end if;
 insert into app_private.admin_awards_audit(award_id,actor_id,action,details)
 values(p_award_id,actor,case when p_id is null then 'nominee_create' else 'nominee_edit' end,
  jsonb_build_object('nominee_id',item.id,'published',item.published,
   'consent_reviewed',item.consent_reviewed));
 return item.id;
end;
$fn$;

-- The only switch-free administrative transition. Publication requires
-- exactly one leader based on actual stored ballots (no guessed result).
create or replace function public.admin_transition_award(
 p_award_id uuid,p_action text
) returns text language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=(select auth.uid());
 edition public.club_awards%rowtype;
 count_nominees integer;
 lead_nominee uuid;
 max_votes bigint;
 ties bigint;
 now_utc timestamptz:=clock_timestamp();
begin
 if actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 select * into edition from public.club_awards where id=p_award_id for update;
 if edition.id is null then raise exception 'Award unavailable' using errcode='22023';end if;
 if p_action='open' then
  if not coalesce((select enabled from app_private.awards_voting_gate where id=1),false)
  then raise exception 'Votes locked until isolated staging certification'
   using errcode='42501';end if;
  select count(*) into count_nominees
   from public.club_award_nominees n
   where n.award_id=p_award_id and n.published and n.consent_reviewed;
  if edition.voting_status<>'coming' or not edition.published
   or edition.opens_at is null or edition.closes_at is null
   or now_utc<edition.opens_at or now_utc>=edition.closes_at
   or count_nominees<2 then
    raise exception 'Voting conditions not met' using errcode='42501';end if;
  update public.club_awards set voting_status='open',
   updated_at=clock_timestamp() where id=p_award_id;
 elsif p_action='close' then
  if edition.voting_status<>'open' or edition.results_published then
   raise exception 'Vote not open' using errcode='42501';end if;
  update public.club_awards set voting_status='closed',
   updated_at=clock_timestamp() where id=p_award_id;
 elsif p_action='publish_results' then
  if edition.voting_status<>'closed' or not edition.published
   or edition.results_published or edition.closes_at>now_utc
  then raise exception 'Close and finish voting period first'
   using errcode='42501';end if;
  -- Compute all counts under the award lock held also by casts/withdrawals.
  select max(votes) into max_votes from (
   select count(*) as votes from app_private.award_ballots b
    where b.award_id=p_award_id group by b.nominee_id
  ) tally;
  if max_votes is null or max_votes<1 then
    raise exception 'No cast ballots: do not invent winner' using errcode='42501';end if;
  select count(*),min(nominee_id) into ties,lead_nominee from (
   select nominee_id,count(*) as votes
    from app_private.award_ballots b where b.award_id=p_award_id
    group by nominee_id
  ) tally where votes=max_votes;
  if ties<>1 or lead_nominee is null then
   raise exception 'Equal first place: manual rules required'
    using errcode='42501';end if;
  if not exists(select 1 from public.club_award_nominees n
   where n.id=lead_nominee and n.award_id=p_award_id
    and n.published and n.consent_reviewed)
  then raise exception 'Winner nomination not approved'
   using errcode='42501';end if;
  insert into public.club_award_results(award_id,nominee_id)
   values(p_award_id,lead_nominee);
  update public.club_awards set voting_status='finished',
   results_published=true,updated_at=clock_timestamp()
  where id=p_award_id;
 else
  raise exception 'Unknown Awards transition' using errcode='22023';
 end if;
 insert into app_private.admin_awards_audit(award_id,actor_id,action,details)
 values(p_award_id,actor,case p_action when 'open' then 'vote_open'
  when 'close' then 'vote_close' else 'result_publish' end,
  jsonb_build_object('status',p_action,
   'winner_id',case when p_action='publish_results' then lead_nominee else null end));
 return p_action;
end;
$fn$;

-- Refuse direct edits of award/nominee/results through future accidental GRANTs.
-- Existing RLS already restricts public to approved information.
-- Votes: exactly one ACTIVE ballot per (award,user); changing the selected
-- nominee updates that row, never inserts another ballot.
create or replace function public.member_cast_award_vote(
 p_award_id uuid,p_nominee_id uuid
) returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=(select auth.uid());
 edition public.club_awards%rowtype;
 v_time timestamptz:=clock_timestamp();
begin
 if actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
  or not exists(select 1 from auth.users u where u.id=actor
   and u.email_confirmed_at is not null) then
  raise exception 'Verified member account required' using errcode='42501';end if;
 if not coalesce((select enabled from app_private.awards_voting_gate where id=1),false)
 then raise exception 'Award voting is not activated' using errcode='42501';end if;
 if not coalesce((select app_private.member_has_active_premium()),false)
 then raise exception 'Server-verified Premium required' using errcode='42501';end if;
 select * into edition from public.club_awards where id=p_award_id for update;
 if edition.id is null or not edition.published
  or edition.voting_status<>'open' or edition.results_published
  or edition.opens_at is null or edition.closes_at is null
  or not (edition.opens_at<=v_time and v_time<edition.closes_at)
 then raise exception 'Voting is closed' using errcode='42501';end if;
 if not exists(select 1 from public.club_award_nominees n
  where n.id=p_nominee_id and n.award_id=p_award_id
   and n.published and n.consent_reviewed) then
  raise exception 'Approved nominee required' using errcode='42501';end if;
 insert into app_private.award_ballots(award_id,user_id,nominee_id)
 values(p_award_id,actor,p_nominee_id)
 on conflict(award_id,user_id) do update
 set nominee_id=excluded.nominee_id,updated_at=clock_timestamp();
 return true;
end;
$fn$;

-- Reading own ballot needs only Auth; never reveals counts or another voter.
create or replace function public.member_my_award_vote(p_award_id uuid)
returns uuid language plpgsql stable security definer set search_path=''
as $fn$
declare actor uuid:=(select auth.uid());
 selected uuid;
begin
 if actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
 then raise exception 'Sign-in required' using errcode='42501';end if;
 select b.nominee_id into selected from app_private.award_ballots b
 where b.award_id=p_award_id and b.user_id=actor;
 return selected;
end;
$fn$;

-- Withdrawal changes the tally, so it is intentionally allowed ONLY
-- during voting. GDPR erasure after closure is a separate audited workflow.
create or replace function public.member_withdraw_award_vote(p_award_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=(select auth.uid());
 edition public.club_awards%rowtype;
 v_now timestamptz:=clock_timestamp();
begin
 if actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
 then raise exception 'Sign-in required' using errcode='42501';end if;
 select * into edition from public.club_awards where id=p_award_id for update;
 if edition.id is null or edition.voting_status<>'open'
  or not(edition.opens_at<=v_now and v_now<edition.closes_at) then
  raise exception 'Cannot change a closed election tally' using errcode='42501';end if;
 delete from app_private.award_ballots b
  where b.award_id=p_award_id and b.user_id=actor;
 return found;
end;
$fn$;

create or replace function public.member_awards_voting_capability()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare actor uuid:=(select auth.uid());
begin
 if actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
 then raise exception 'Sign-in required' using errcode='42501';end if;
 return jsonb_build_object(
  'enabled',coalesce((select enabled from app_private.awards_voting_gate where id=1),false),
  'premium_active',coalesce((select app_private.member_has_active_premium()),false));
end;
$fn$;

-- All writes to private/award data are mediated by checked RPCs only.
revoke all on function public.admin_list_awards() from public,anon,authenticated;
revoke all on function public.admin_list_award_nominees(uuid) from public,anon,authenticated;
revoke all on function public.admin_save_award(
 uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)
 from public,anon,authenticated;
revoke all on function public.admin_save_award_nominee(
 uuid,uuid,text,boolean,boolean,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.admin_transition_award(uuid,text) from public,anon,authenticated;
revoke all on function public.member_cast_award_vote(uuid,uuid) from public,anon,authenticated;
revoke all on function public.member_my_award_vote(uuid) from public,anon,authenticated;
revoke all on function public.member_withdraw_award_vote(uuid) from public,anon,authenticated;
revoke all on function public.member_awards_voting_capability() from public,anon,authenticated;
grant execute on function public.admin_list_awards() to authenticated;
grant execute on function public.admin_list_award_nominees(uuid) to authenticated;
grant execute on function public.admin_save_award(
 uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)
 to authenticated;
grant execute on function public.admin_save_award_nominee(
 uuid,uuid,text,boolean,boolean,integer,timestamptz) to authenticated;
grant execute on function public.admin_transition_award(uuid,text) to authenticated;
grant execute on function public.member_cast_award_vote(uuid,uuid) to authenticated;
grant execute on function public.member_my_award_vote(uuid) to authenticated;
grant execute on function public.member_withdraw_award_vote(uuid) to authenticated;
grant execute on function public.member_awards_voting_capability() to authenticated;

comment on table app_private.awards_voting_gate is 'OFF in primary database. No browser/admin RPC can enable Premium voting.';
comment on table app_private.award_ballots is 'Private single-vote-per-member-and-award ledger, editable/withdrawable only while polls are open.';
commit;
