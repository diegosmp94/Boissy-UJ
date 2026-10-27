-- Boissy-UJ step 92: own-user privacy rights and non-destructive GDPR operations.
-- Nothing below deletes accounts, media, votes, billing evidence or club records.
-- Response deadlines are workflow indicators, NOT a compliance guarantee.
begin;

create table if not exists app_private.privacy_rights_requests(
 id uuid primary key default gen_random_uuid(),
 subject_user_id uuid, -- deliberately no FK: request survives Auth deletion
 request_kind text not null check(request_kind in (
  'access','rectification','erasure','restriction','portability','objection',
  'consent_withdrawal')),
 description text not null default '' check(char_length(description)<=600),
 status text not null default 'submitted' check(status in (
  'submitted','in_review','awaiting_action','completed','rejected')),
 received_at timestamptz not null default clock_timestamp(),
 due_at timestamptz not null default (clock_timestamp()+interval '1 month'),
 extended_at timestamptz,
 extension_reason text check(extension_reason is null or
  char_length(btrim(extension_reason)) between 25 and 600),
 resolution_note text check(resolution_note is null or
  char_length(btrim(resolution_note)) between 25 and 1000),
 decided_at timestamptz,
 updated_at timestamptz not null default clock_timestamp(),
 check((extended_at is null and extension_reason is null) or
   (extended_at is not null and extension_reason is not null)),
 check((status in ('completed','rejected'))=(decided_at is not null)),
 check(status not in ('completed','rejected') or resolution_note is not null)
);
create unique index if not exists privacy_one_open_request_per_kind
 on app_private.privacy_rights_requests(subject_user_id,request_kind)
 where subject_user_id is not null and status in ('submitted','in_review','awaiting_action');
create index if not exists privacy_requests_due
 on app_private.privacy_rights_requests(due_at) where decided_at is null;
create index if not exists privacy_requests_member
 on app_private.privacy_rights_requests(subject_user_id,received_at desc);
alter table app_private.privacy_rights_requests enable row level security;
revoke all on app_private.privacy_rights_requests from public,anon,authenticated;

-- Checklist is a record of administrator-verified work, not an automatic
-- right to delete other users' data or a promise that removal succeeded.
create table if not exists app_private.privacy_request_steps(
 request_id uuid not null references app_private.privacy_rights_requests(id) on delete restrict,
 scope text not null check(scope in (
  'auth_account','member_profile','club_roles','public_person_profiles',
  'private_media','awards_ballots','payments_and_invoices','external_processors')),
 state text not null default 'pending'
  check(state in ('pending','verified','not_applicable')),
 evidence_ref text check(evidence_ref is null or
  (char_length(evidence_ref) between 6 and 120 and evidence_ref ~ '^[A-Za-z0-9._:/-]+$')),
 checked_at timestamptz,
 checked_by uuid, -- audit actor may survive Auth removal until approved retention purge
 primary key(request_id,scope),
 check((state='pending')=(checked_at is null)),
 check((state='pending')=(evidence_ref is null)),
 check((state='pending')=(checked_by is null))
);
alter table app_private.privacy_request_steps enable row level security;
revoke all on app_private.privacy_request_steps from public,anon,authenticated;

create table if not exists app_private.privacy_requests_audit(
 id bigint generated always as identity primary key,
 request_id uuid not null references app_private.privacy_rights_requests(id) on delete restrict,
 actor_id uuid, -- may be pseudonymised after legal retention review
 action text not null check(action in (
  'submit','status_change','extension','scope_verified')),
 created_at timestamptz not null default clock_timestamp(),
 details jsonb not null default '{}'::jsonb
);
create index if not exists privacy_audit_request_time
 on app_private.privacy_requests_audit(request_id,created_at desc);
alter table app_private.privacy_requests_audit enable row level security;
revoke all on app_private.privacy_requests_audit from public,anon,authenticated;

-- Intentionally no fabricated retention periods: controller must specify
-- purpose, legal basis and retention rules before any automated purge.
create table if not exists app_private.privacy_retention_register(
 dataset text primary key check(dataset in (
  'auth_accounts','member_profiles','sports_licenses','public_sports_profiles',
  'private_media','awards_ballots','premium_payments','private_audit')),
 retention_rule text check(retention_rule is null or char_length(retention_rule) between 25 and 1200),
 legal_basis text check(legal_basis is null or char_length(legal_basis) between 10 and 500),
 approved_at timestamptz,
 approved_by uuid references auth.users(id) on delete set null,
 check((approved_at is null)=(approved_by is null)),
 check(approved_at is null or
  (retention_rule is not null and legal_basis is not null))
);
insert into app_private.privacy_retention_register(dataset)
 values('auth_accounts'),('member_profiles'),('sports_licenses'),
 ('public_sports_profiles'),('private_media'),('awards_ballots'),
 ('premium_payments'),('private_audit')
 on conflict(dataset) do nothing;
alter table app_private.privacy_retention_register enable row level security;
revoke all on app_private.privacy_retention_register from public,anon,authenticated;

create table if not exists app_private.privacy_retention_audit(
 id bigint generated always as identity primary key,
 dataset text not null,
 actor_id uuid,
 change_kind text not null check(change_kind='approve_rule'),
 changed_at timestamptz not null default clock_timestamp()
);
alter table app_private.privacy_retention_audit enable row level security;
revoke all on app_private.privacy_retention_audit from public,anon,authenticated;

create or replace function public.member_submit_privacy_request(
 p_kind text,p_description text default ''
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=(select auth.uid());
 request_id uuid;
 active_count bigint;
begin
 if actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
  or not exists(select 1 from auth.users u where u.id=actor
    and u.email_confirmed_at is not null)
 then raise exception 'Verified account required' using errcode='42501';end if;
 if p_kind is null or p_kind not in (
   'access','rectification','erasure','restriction','portability',
   'objection','consent_withdrawal')
  or p_description is null or char_length(p_description)>600
  or p_description ~ '[[:cntrl:]]'
 then raise exception 'Invalid rights request' using errcode='22023';end if;
 select count(*) into active_count
  from app_private.privacy_rights_requests
  where subject_user_id=actor and status in ('submitted','in_review','awaiting_action');
 if active_count>=5 then
  raise exception 'Active request limit, contact the club' using errcode='23514';end if;
 insert into app_private.privacy_rights_requests(
  subject_user_id,request_kind,description)
 values(actor,p_kind,btrim(p_description)) returning id into request_id;
 if p_kind='erasure' then
  insert into app_private.privacy_request_steps(request_id,scope)
   select request_id,item.scope from unnest(array[
    'auth_account','member_profile','club_roles','public_person_profiles',
    'private_media','awards_ballots','payments_and_invoices','external_processors'
   ]) as item(scope);
 end if;
 insert into app_private.privacy_requests_audit(request_id,actor_id,action)
 values(request_id,actor,'submit');
 return request_id;
end;
$fn$;

create or replace function public.member_my_privacy_requests()
returns table(
 id uuid,request_kind text,description text,status text,
 received_at timestamptz,due_at timestamptz,extended_at timestamptz,
 decided_at timestamptz,resolution_note text
) language plpgsql stable security definer set search_path=''
as $fn$
declare actor uuid:=(select auth.uid());
begin
 if actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
 then raise exception 'Sign-in required' using errcode='42501';end if;
 return query select r.id,r.request_kind,r.description,r.status,
  r.received_at,r.due_at,r.extended_at,r.decided_at,r.resolution_note
 from app_private.privacy_rights_requests r
 where r.subject_user_id=actor
 order by r.received_at desc limit 100;
end;
$fn$;

-- No public Data API access to another person's case or to case steps.
create or replace function public.admin_list_privacy_requests()
returns table(
 id uuid,subject_user_id uuid,request_kind text,description text,
 status text,received_at timestamptz,due_at timestamptz,
 extended_at timestamptz,updated_at timestamptz,resolution_note text
) language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or
  not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 return query select r.id,r.subject_user_id,r.request_kind,r.description,
  r.status,r.received_at,r.due_at,r.extended_at,
  r.updated_at,r.resolution_note
 from app_private.privacy_rights_requests r
 order by (r.decided_at is null) desc,r.due_at asc,r.received_at desc limit 200;
end;
$fn$;

create or replace function public.admin_list_privacy_request_steps(p_request_id uuid)
returns table(scope text,state text,evidence_ref text,checked_at timestamptz)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or
  not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 return query select s.scope,s.state,s.evidence_ref,s.checked_at
 from app_private.privacy_request_steps s
 where s.request_id=p_request_id order by s.scope limit 12;
end;
$fn$;

-- Checklist evidence must reference a restricted internal incident/action
-- receipt. Never accept passwords, documents, file contents or personal data.
create or replace function public.admin_update_privacy_step(
 p_request_id uuid,p_scope text,p_state text,p_evidence_ref text
) returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=(select auth.uid());
 request_row app_private.privacy_rights_requests%rowtype;
begin
 if actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 if p_state not in ('verified','not_applicable') or p_scope is null
  or p_evidence_ref is null or
  p_evidence_ref !~ '^[A-Za-z0-9._:/-]{6,120}$'
 then raise exception 'Internal evidence reference required' using errcode='22023';end if;
 select * into request_row from app_private.privacy_rights_requests
  where id=p_request_id for update;
 if request_row.id is null or request_row.request_kind<>'erasure'
  or request_row.status in ('completed','rejected') then
  raise exception 'Erasure case not open' using errcode='42501';end if;
 if p_scope='auth_account' and p_state='not_applicable' then
  raise exception 'Auth removal must be verified, never bypassed'
   using errcode='42501';end if;
 if p_scope='auth_account' and exists(
  select 1 from auth.users u where u.id=request_row.subject_user_id)
 then raise exception 'Auth user still exists' using errcode='42501';end if;
 update app_private.privacy_request_steps
 set state=p_state,evidence_ref=p_evidence_ref,checked_at=clock_timestamp(),
  checked_by=actor
 where request_id=p_request_id and scope=p_scope;
 if not found then raise exception 'Unknown checklist entry' using errcode='22023';end if;
 insert into app_private.privacy_requests_audit(request_id,actor_id,action,details)
 values(p_request_id,actor,'scope_verified',
  jsonb_build_object('scope',p_scope,'state',p_state));
 return true;
end;
$fn$;

-- Deadline extension is exceptional and requires an auditable explanation.
create or replace function public.admin_extend_privacy_request(
 p_request_id uuid,p_reason text,p_expected_updated_at timestamptz
) returns boolean language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=(select auth.uid());
 old app_private.privacy_rights_requests%rowtype;
begin
 if actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 25 and 600
 then raise exception 'Extension justification required' using errcode='22023';end if;
 select * into old from app_private.privacy_rights_requests
  where id=p_request_id for update;
 if old.id is null or old.status in ('completed','rejected')
  or clock_timestamp()>old.due_at
  or old.extended_at is not null or p_expected_updated_at is null
  or old.updated_at is distinct from p_expected_updated_at then
  raise exception 'Request changed or already extended' using errcode='40001';end if;
 update app_private.privacy_rights_requests
 set due_at=old.received_at+interval '3 months',
  extended_at=clock_timestamp(),extension_reason=btrim(p_reason),
  updated_at=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond')
 where id=p_request_id;
 insert into app_private.privacy_requests_audit(request_id,actor_id,action)
 values(p_request_id,actor,'extension');
 return true;
end;
$fn$;

-- Admin workflow cannot claim complete erasure before Auth deletion and
-- documented reconciliation across media, identity, roles and billing.
create or replace function public.admin_transition_privacy_request(
 p_request_id uuid,p_status text,p_resolution_note text,
 p_expected_updated_at timestamptz
) returns boolean language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=(select auth.uid());
 old app_private.privacy_rights_requests%rowtype;
 pending_steps bigint;
begin
 if actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 if p_status is null or p_status not in (
  'in_review','awaiting_action','completed','rejected')
  or p_resolution_note is null or
  (p_status in ('completed','rejected') and
    char_length(btrim(p_resolution_note)) not between 25 and 1000)
  or (p_status not in ('completed','rejected') and
    p_resolution_note<>'')
 then raise exception 'Invalid privacy decision' using errcode='22023';end if;
 select * into old from app_private.privacy_rights_requests
  where id=p_request_id for update;
 if old.id is null or old.status in ('completed','rejected')
  or p_expected_updated_at is null
  or old.updated_at is distinct from p_expected_updated_at then
  raise exception 'Request changed or already decided' using errcode='40001';end if;
 if p_status='completed' and old.request_kind='erasure' then
  if exists(select 1 from auth.users u where u.id=old.subject_user_id)
  then raise exception 'Auth account still exists' using errcode='42501';end if;
  select count(*) into pending_steps from app_private.privacy_request_steps s
   where s.request_id=p_request_id and s.state='pending';
  if pending_steps<>0 or
    (select count(*) from app_private.privacy_request_steps s
      where s.request_id=p_request_id)<>8
  then raise exception 'Erasure checklist still incomplete'
    using errcode='42501';end if;
 end if;
 update app_private.privacy_rights_requests
 set status=p_status,
  subject_user_id=case when p_status='completed' and old.request_kind='erasure'
   then null else old.subject_user_id end,
  description=case when p_status='completed' and old.request_kind='erasure'
   then '' else old.description end,
  decided_at=case when p_status in ('completed','rejected')
   then clock_timestamp() else null end,
  resolution_note=case when p_status in ('completed','rejected')
   then btrim(p_resolution_note) else null end,
  updated_at=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond')
 where id=p_request_id;
 insert into app_private.privacy_requests_audit(request_id,actor_id,action,details)
 values(p_request_id,actor,'status_change',
  jsonb_build_object('from',old.status,'to',p_status));
 return true;
end;
$fn$;

create or replace function public.admin_privacy_retention_and_consent()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
 datasets jsonb;
 sport_pending bigint;
 profile_pending bigint;
 purge_pending bigint;
begin
 if (select auth.uid()) is null or
  not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('dataset',r.dataset,
  'approved',r.approved_at is not null,'approved_at',r.approved_at,
  'rule',r.retention_rule,'basis',r.legal_basis,
  'has_rule',r.retention_rule is not null,
  'has_legal_basis',r.legal_basis is not null) order by r.dataset),'[]'::jsonb)
  into datasets from app_private.privacy_retention_register r;
 select count(*) into sport_pending from public.team_public_people p
  where p.published and not p.consent_confirmed;
 select count(*) into profile_pending from public.team_public_people p
  where p.profile_visible and not p.profile_consent_confirmed;
 select count(*) into purge_pending from app_private.news_media_purge_jobs j
  where j.completed_at is null;
 return jsonb_build_object('retention',datasets,
  'roster_consent_review_pending',sport_pending,
  'individual_profile_review_pending',profile_pending,
  'media_purges_pending',purge_pending);
end;
$fn$;

-- Club controller enters actual approved legal terms; no auto-purge policy.
create or replace function public.admin_approve_privacy_retention_rule(
 p_dataset text,p_rule text,p_basis text,p_expected_approved_at timestamptz
) returns boolean language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=(select auth.uid());
 old app_private.privacy_retention_register%rowtype;
begin
 if actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501';end if;
 if p_rule is null or char_length(btrim(p_rule)) not between 25 and 1200
  or p_basis is null or char_length(btrim(p_basis)) not between 10 and 500
  or p_rule ~ '[[:cntrl:]]' or p_basis ~ '[[:cntrl:]]'
 then raise exception 'Legal retention terms missing' using errcode='22023';end if;
 select * into old from app_private.privacy_retention_register
  where dataset=p_dataset for update;
 if old.dataset is null or old.approved_at is distinct from p_expected_approved_at
 then raise exception 'Retention register conflict, reload' using errcode='40001';end if;
 update app_private.privacy_retention_register
 set retention_rule=btrim(p_rule),legal_basis=btrim(p_basis),
  approved_by=actor,approved_at=clock_timestamp()
 where dataset=p_dataset;
 insert into app_private.privacy_retention_audit(dataset,actor_id,change_kind)
 values(p_dataset,actor,'approve_rule');
 return true;
end;
$fn$;

revoke all on function public.member_submit_privacy_request(text,text)
 from public,anon,authenticated;
revoke all on function public.member_my_privacy_requests()
 from public,anon,authenticated;
revoke all on function public.admin_list_privacy_requests()
 from public,anon,authenticated;
revoke all on function public.admin_list_privacy_request_steps(uuid)
 from public,anon,authenticated;
revoke all on function public.admin_update_privacy_step(uuid,text,text,text)
 from public,anon,authenticated;
revoke all on function public.admin_extend_privacy_request(uuid,text,timestamptz)
 from public,anon,authenticated;
revoke all on function public.admin_transition_privacy_request(uuid,text,text,timestamptz)
 from public,anon,authenticated;
revoke all on function public.admin_approve_privacy_retention_rule(text,text,text,timestamptz)
 from public,anon,authenticated;
revoke all on function public.admin_privacy_retention_and_consent()
 from public,anon,authenticated;

grant execute on function public.member_submit_privacy_request(text,text) to authenticated;
grant execute on function public.member_my_privacy_requests() to authenticated;
grant execute on function public.admin_list_privacy_requests() to authenticated;
grant execute on function public.admin_list_privacy_request_steps(uuid) to authenticated;
grant execute on function public.admin_update_privacy_step(uuid,text,text,text) to authenticated;
grant execute on function public.admin_extend_privacy_request(uuid,text,timestamptz) to authenticated;
grant execute on function public.admin_transition_privacy_request(uuid,text,text,timestamptz) to authenticated;
grant execute on function public.admin_privacy_retention_and_consent() to authenticated;
grant execute on function public.admin_approve_privacy_retention_rule(text,text,text,timestamptz) to authenticated;

comment on table app_private.privacy_rights_requests is
 'Private owner-only rights request registry. Completion NEVER deletes data; verified external workflows required.';
comment on table app_private.privacy_retention_register is
 'Unapproved retention scopes. Legal retention periods, bases and schedules must be decided and documented by club.';
commit;
