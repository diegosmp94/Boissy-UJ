-- Boissy-UJ | Admin-approved cumulative player/coach/admin roles.
-- Role requests require an authenticated owner; approvals and revocations
-- require a DIFFERENT admin with MFA AAL2. No user, role or request is seeded.
begin;

create table if not exists public.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_role text not null check (requested_role in ('player','coach','admin')),
  team_id uuid references public.club_teams(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decision_reason text check (decision_reason is null or char_length(decision_reason) <= 300),
  constraint coach_needs_team check (
    (requested_role='coach' and team_id is not null)
    or (requested_role<>'coach' and team_id is null)
  ),
  constraint decision_is_final check (
    (status in ('pending','cancelled') and reviewed_by is null and reviewed_at is null)
    or (status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint never_self_review check (reviewed_by is null or reviewed_by<>user_id)
);

-- One pending request per role+team, but coach may request several teams.
create unique index if not exists role_requests_pending_unique_idx
  on public.role_requests(user_id,requested_role,
    coalesce(team_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where status='pending';
create index if not exists role_requests_status_idx
  on public.role_requests(status,requested_at desc);

alter table public.role_requests enable row level security;
revoke all on public.role_requests from public,anon,authenticated;
grant select on public.role_requests to authenticated;
create policy role_requests_read_self_or_mfa_admin on public.role_requests
  for select to authenticated
  using (user_id=(select auth.uid()) or (select app_private.is_admin()));

-- Immutable private event log for decisions, requests and revocations.
create table if not exists app_private.role_change_audit (
  id bigint generated always as identity primary key,
  request_id uuid references public.role_requests(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  role text not null check(role in ('player','coach','admin')),
  team_id uuid references public.club_teams(id) on delete set null,
  action text not null check(action in
    ('request','approve','reject','revoke_role','revoke_team')),
  created_at timestamptz not null default now()
);
create index if not exists role_change_audit_subject_idx
  on app_private.role_change_audit(subject_user_id,created_at desc);
create index if not exists role_change_audit_actor_idx
  on app_private.role_change_audit(actor_user_id,created_at desc);
create index if not exists role_change_audit_request_idx
  on app_private.role_change_audit(request_id);
alter table app_private.role_change_audit enable row level security;
revoke all on app_private.role_change_audit from public,anon,authenticated;

create or replace function public.member_request_role(
  p_role text,p_team_id uuid default null
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
  v_user uuid := (select auth.uid());
  v_request uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_role is null or p_role not in ('player','coach','admin')
    or (p_role='coach' and p_team_id is null)
    or (p_role<>'coach' and p_team_id is not null)
  then
    raise exception 'Invalid role or team' using errcode='22023';
  end if;
  if p_team_id is not null and not exists
    (select 1 from public.club_teams where id=p_team_id)
  then
    raise exception 'Unknown club team' using errcode='22023';
  end if;
  if p_role<>'coach' and exists
    (select 1 from public.user_roles
      where user_id=v_user and role=p_role)
  then
    raise exception 'Role already granted' using errcode='22023';
  end if;
  if p_role='coach' and exists
    (select 1 from public.staff_team_assignments
      where coach_user_id=v_user and team_id=p_team_id and active=true)
    and exists
    (select 1 from public.user_roles
      where user_id=v_user and role='coach')
  then
    raise exception 'Coach team permission already granted' using errcode='22023';
  end if;
  insert into public.role_requests(user_id,requested_role,team_id)
    values(v_user,p_role,p_team_id) returning id into v_request;
  insert into app_private.role_change_audit
    (request_id,subject_user_id,actor_user_id,role,team_id,action)
    values(v_request,v_user,v_user,p_role,p_team_id,'request');
  return v_request;
end;
$fn$;

create or replace function public.admin_decide_role_request(
  p_request_id uuid,p_approve boolean,p_reason text default null
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
  v_admin uuid := (select auth.uid());
  v_request public.role_requests%rowtype;
begin
  if v_admin is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if not coalesce((select app_private.is_admin()),false) then
    raise exception 'Admin MFA AAL2 required' using errcode='42501';
  end if;
  if p_request_id is null or p_approve is null or
    (p_reason is not null and char_length(p_reason)>300) then
    raise exception 'Invalid decision' using errcode='22023';
  end if;
  select * into v_request from public.role_requests
    where id=p_request_id for update;
  if not found or v_request.status<>'pending' then
    raise exception 'Request not pending' using errcode='22023';
  end if;
  if v_request.user_id=v_admin then
    raise exception 'Self-approval is prohibited' using errcode='42501';
  end if;

  if p_approve then
    insert into public.user_roles(user_id,role,granted_by)
      values(v_request.user_id,v_request.requested_role,v_admin)
      on conflict(user_id,role) do nothing;
    if v_request.requested_role='coach' then
      insert into public.staff_team_assignments
        (coach_user_id,team_id,active,granted_by,granted_at)
        values(v_request.user_id,v_request.team_id,true,v_admin,now())
        on conflict(coach_user_id,team_id)
        do update set active=true,granted_by=excluded.granted_by,granted_at=now();
    end if;
  end if;

  update public.role_requests set
    status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_by=v_admin,
    reviewed_at=now(),
    decision_reason=nullif(btrim(p_reason),'')
    where id=v_request.id;

  insert into app_private.role_change_audit
    (request_id,subject_user_id,actor_user_id,role,team_id,action)
    values(v_request.id,v_request.user_id,v_admin,
      v_request.requested_role,v_request.team_id,
      case when p_approve then 'approve' else 'reject' end);
  return true;
end;
$fn$;

create or replace function public.admin_revoke_member_role(
  p_user_id uuid,p_role text,p_team_id uuid default null
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_exists boolean;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if not coalesce((select app_private.is_admin()),false) then
    raise exception 'Admin MFA AAL2 required' using errcode='42501';
  end if;
  if p_user_id is null or p_user_id=v_actor then
    raise exception 'Cannot revoke your own role' using errcode='42501';
  end if;
  if p_role is null or p_role not in ('player','coach','admin')
    or (p_team_id is not null and p_role<>'coach') then
    raise exception 'Invalid role or team' using errcode='22023';
  end if;

  if p_role='coach' and p_team_id is not null then
    update public.staff_team_assignments set active=false
      where coach_user_id=p_user_id and team_id=p_team_id and active=true;
    if not found then
      raise exception 'Active team assignment not found' using errcode='22023';
    end if;
  else
    if p_role='admin' then
      -- Serialized check prevents two admins revoking one another simultaneously.
      perform pg_catalog.pg_advisory_xact_lock(20261021,314);
      if (select count(*) from public.user_roles where role='admin')<=1 then
        raise exception 'Last administrator cannot be revoked' using errcode='42501';
      end if;
    end if;
    delete from public.user_roles where user_id=p_user_id and role=p_role;
    if not found then
      raise exception 'Active role not found' using errcode='22023';
    end if;
    if p_role='coach' then
      update public.staff_team_assignments set active=false
        where coach_user_id=p_user_id and active=true;
    elsif p_role='player' then
      update app_private.team_player_memberships set active=false
        where player_user_id=p_user_id and active=true;
      update app_private.match_callups set
        response='cancelled',responded_at=null,updated_at=now()
        where player_user_id=p_user_id and response<>'cancelled';
    end if;
  end if;

  insert into app_private.role_change_audit
    (subject_user_id,actor_user_id,role,team_id,action)
    values(p_user_id,v_actor,p_role,p_team_id,
      case when p_team_id is not null then 'revoke_team' else 'revoke_role' end);
  return true;
end;
$fn$;

-- Remove stale invitation visibility on revocation of the player role.
create or replace function public.player_my_callups()
returns table(match_id uuid,team_name text,opponent_name text,
  scheduled_at timestamptz,response text)
language sql stable security definer set search_path=''
as $fn$
  select c.match_id,t.name,m.opponent_name,m.scheduled_at,c.response
  from app_private.match_callups c
  join public.matches m on m.id=c.match_id
  join public.club_teams t on t.id=m.team_id
  join app_private.team_player_memberships tm on tm.team_id=m.team_id
    and tm.player_user_id=c.player_user_id and tm.active=true
  where c.player_user_id=(select auth.uid())
    and c.response<>'cancelled'
    and exists(select 1 from public.user_roles r
      where r.user_id=c.player_user_id and r.role='player')
  order by m.scheduled_at asc;
$fn$;

revoke all on function public.member_request_role(text,uuid)
  from public,anon,authenticated;
grant execute on function public.member_request_role(text,uuid)
  to authenticated;
revoke all on function public.admin_decide_role_request(uuid,boolean,text)
  from public,anon,authenticated;
grant execute on function public.admin_decide_role_request(uuid,boolean,text)
  to authenticated;
revoke all on function public.admin_revoke_member_role(uuid,text,uuid)
  from public,anon,authenticated;
grant execute on function public.admin_revoke_member_role(uuid,text,uuid)
  to authenticated;
revoke all on function public.player_my_callups()
  from public,anon,authenticated;
grant execute on function public.player_my_callups() to authenticated;

comment on table public.role_requests is
  'Requests only, not active permissions. Approval by a different MFA admin required.';
comment on function public.admin_decide_role_request(uuid,boolean,text) is
  'MFA AAL2 admin-only decision; self-approval forbidden; grant and audit atomic.';

commit;
