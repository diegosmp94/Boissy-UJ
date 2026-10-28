-- Boissy-UJ — narrow one-account exception for self approval of SPORT roles only.
-- No user is whitelisted by the source migration; the club must provision
-- the sole authorized account privately in Supabase with an explicit review.
-- Existing MFA AAL2 / role checks, the never_self_review CHECK, and the
-- other-admin approval path remain in force.
begin;

create table if not exists app_private.role_self_approval_allowlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  enabled_at timestamptz not null default now()
);
alter table app_private.role_self_approval_allowlist enable row level security;
revoke all on table app_private.role_self_approval_allowlist
  from public,anon,authenticated;

-- Do not weaken the original never_self_review constraint. Instead record the
-- exceptional reviewer in a separate source field and in role_change_audit.
alter table public.role_requests
  add column if not exists self_approved_by uuid references auth.users(id) on delete set null;
alter table public.role_requests
  add constraint role_requests_self_approved_only_sport check (
    self_approved_by is null or (
      self_approved_by=user_id and
      reviewed_by is null and
      requested_role in ('player','coach') and
      status='approved' and
      reviewed_at is not null
    )
  );

-- AAL2 and admin-role verification runs within app_private.is_admin() and
-- the RPC. This function exposes only a boolean for the currently logged-in
-- subject. All other accounts get false, with no directory disclosure.
create or replace function public.admin_can_self_approve_role_requests()
returns boolean
language sql stable security definer set search_path=''
as $fn$
  select coalesce((select app_private.is_admin()),false)
    and exists(
      select 1 from app_private.role_self_approval_allowlist s
      where s.user_id=(select auth.uid()) and s.enabled=true
    );
$fn$;
revoke all on function public.admin_can_self_approve_role_requests()
  from public,anon,authenticated;
grant execute on function public.admin_can_self_approve_role_requests()
  to authenticated;

-- Atomically grant the same role/team rights as the prior approval function.
-- User identity comes exclusively from auth.uid(), not from caller-supplied ID.
create or replace function public.admin_decide_role_request(
  p_request_id uuid,p_approve boolean,p_reason text default null
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
  v_admin uuid := (select auth.uid());
  v_request public.role_requests%rowtype;
  v_self boolean := false;
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
  v_self := (v_request.user_id=v_admin);
  if v_self and (
    not p_approve
    or v_request.requested_role not in ('player','coach')
    or not exists (
      select 1 from app_private.role_self_approval_allowlist a
      where a.user_id=v_admin and a.enabled=true
    )
  ) then
    raise exception 'Self-approval is prohibited for this account or role'
      using errcode='42501';
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
    reviewed_by=case when v_self then null else v_admin end,
    self_approved_by=case when v_self then v_admin else null end,
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



-- An exceptional reviewer loses eligibility automatically when the technical
-- admin role is revoked. Re-granting admin cannot silently restore this right.
create or replace function app_private.clear_self_approval_on_admin_revocation()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
begin
 if old.role='admin' then
   delete from app_private.role_self_approval_allowlist
     where user_id=old.user_id;
 end if;
 return old;
end;
$fn$;
revoke all on function app_private.clear_self_approval_on_admin_revocation()
  from public,anon,authenticated,service_role;
drop trigger if exists clear_self_approval_on_admin_revocation
  on public.user_roles;
create trigger clear_self_approval_on_admin_revocation
  after delete on public.user_roles
  for each row execute function app_private.clear_self_approval_on_admin_revocation();

comment on table app_private.role_self_approval_allowlist is
  'Private one-account exception configured by club administrator. No public/direct browser grants.';
comment on function public.admin_decide_role_request(uuid,boolean,text) is
  'Admin AAL2 approval; sports-only self approvals restricted by private allowlist; self reviewer audited separately; admin self approval forbidden.';
comment on column public.role_requests.self_approved_by is
  'Explicit original applicant for an allowlisted AAL2 sports-role self approval; distinct from normal reviewed_by.';

commit;
