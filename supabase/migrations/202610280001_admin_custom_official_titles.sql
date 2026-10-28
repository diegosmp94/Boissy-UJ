-- Boissy-UJ: custom, nominative club offices for existing approved administrators.
-- Office titles are DISPLAY METADATA: never grants admin/coach/player permissions.
-- No president, officer, user or assignment is seeded by this migration.
begin;

create table if not exists app_private.club_office_titles (
 id uuid primary key default gen_random_uuid(),
 title_label text not null check (char_length(btrim(title_label)) between 3 and 80
   and title_label=btrim(title_label)),
 single_holder boolean not null default false,
 active boolean not null default true,
 sort_order integer not null default 100 check (sort_order between 0 and 9999),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists club_office_titles_unique_label_idx
 on app_private.club_office_titles (lower(title_label));
alter table app_private.club_office_titles enable row level security;
revoke all on app_private.club_office_titles from public, anon, authenticated;

create table if not exists app_private.club_office_assignments (
 title_id uuid not null references app_private.club_office_titles(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 assigned_by uuid references auth.users(id) on delete set null,
 assigned_at timestamptz not null default now(),
 primary key (title_id,user_id)
);
create index if not exists club_office_assignments_user_idx
 on app_private.club_office_assignments(user_id,title_id);
alter table app_private.club_office_assignments enable row level security;
revoke all on app_private.club_office_assignments from public,anon,authenticated;

create table if not exists app_private.club_office_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 subject_id uuid references auth.users(id) on delete set null,
 title_id uuid not null,
 event text not null check(event in
   ('create_title','edit_title','disable_title','assign','remove')),
 before_state jsonb,
 after_state jsonb,
 happened_at timestamptz not null default now()
);
create index if not exists club_office_audit_title_idx
 on app_private.club_office_audit(title_id,happened_at desc);
alter table app_private.club_office_audit enable row level security;
revoke all on app_private.club_office_audit from public,anon,authenticated;

create or replace function public.admin_office_list_titles()
returns table(id uuid,title_label text,single_holder boolean,active boolean,
 sort_order integer,holder_count bigint,updated_at timestamptz)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501'; end if;
 return query
 select t.id,t.title_label,t.single_holder,t.active,t.sort_order,
   (select count(*) from app_private.club_office_assignments a
     join public.user_roles r on r.user_id=a.user_id and r.role='admin'
     where a.title_id=t.id),t.updated_at
 from app_private.club_office_titles t
 order by t.sort_order,t.title_label,t.id limit 200;
end;
$fn$;

create or replace function public.admin_office_list_administrators()
returns table(user_id uuid,display_name text)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501'; end if;
 return query
 select r.user_id,coalesce(nullif(btrim(p.display_name),''),'Administrateur')
 from public.user_roles r
 left join public.profiles p on p.id=r.user_id
 where r.role='admin'
 order by 2,r.user_id limit 200;
end;
$fn$;

create or replace function public.admin_office_list_assignments()
returns table(title_id uuid,user_id uuid,display_name text,assigned_at timestamptz)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501'; end if;
 return query
 select a.title_id,a.user_id,
  coalesce(nullif(btrim(p.display_name),''),'Administrateur'),
  a.assigned_at
 from app_private.club_office_assignments a
 join public.user_roles r on r.user_id=a.user_id and r.role='admin'
 left join public.profiles p on p.id=a.user_id
 order by a.assigned_at desc,a.title_id,a.user_id limit 1000;
end;
$fn$;

create or replace function public.admin_office_save_title(
 p_id uuid,p_label text,p_single_holder boolean,p_active boolean,
 p_sort_order integer,p_expected_updated_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_old app_private.club_office_titles%rowtype;
 v_new app_private.club_office_titles%rowtype;
 v_label text;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501'; end if;
 v_label:=btrim(p_label);
 if p_label is null or char_length(v_label) not between 3 and 80
   or v_label ~ '[[:cntrl:]]'
   or p_single_holder is null or p_active is null
   or p_sort_order is null or p_sort_order not between 0 and 9999
 then raise exception 'Invalid club office' using errcode='22023'; end if;
 if p_id is null then
  if p_expected_updated_at is not null then
   raise exception 'Unexpected office version' using errcode='22023'; end if;
  insert into app_private.club_office_titles
    (title_label,single_holder,active,sort_order,created_by)
   values (v_label,p_single_holder,p_active,p_sort_order,v_actor)
   returning * into v_new;
  insert into app_private.club_office_audit(actor_id,title_id,event,after_state)
   values (v_actor,v_new.id,'create_title',to_jsonb(v_new));
 else
  select * into v_old from app_private.club_office_titles where id=p_id for update;
  if not found then raise exception 'Office not found' using errcode='22023'; end if;
  if p_expected_updated_at is null or
    p_expected_updated_at is distinct from v_old.updated_at then
   raise exception 'Office changed; refresh first' using errcode='40001'; end if;
  if p_single_holder and (select count(*) from app_private.club_office_assignments
      where title_id=p_id)>1 then
   raise exception 'Remove extra holders first' using errcode='22023'; end if;
  if not p_active and exists(
    select 1 from app_private.club_office_assignments where title_id=p_id
  ) then raise exception 'Remove holders before disabling this office'
    using errcode='22023'; end if;
  update app_private.club_office_titles set title_label=v_label,
    single_holder=p_single_holder,active=p_active,sort_order=p_sort_order,
    updated_at=greatest(clock_timestamp(),v_old.updated_at+interval '1 microsecond')
   where id=p_id returning * into v_new;
  insert into app_private.club_office_audit
    (actor_id,title_id,event,before_state,after_state)
   values (v_actor,v_new.id,
    case when v_old.active and not v_new.active then 'disable_title' else 'edit_title' end,
    to_jsonb(v_old),to_jsonb(v_new));
 end if;
 return v_new.id;
end;
$fn$;

create or replace function public.admin_office_set_assignment(
 p_title_id uuid,p_user_id uuid,p_assign boolean
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_title app_private.club_office_titles%rowtype;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501'; end if;
 if p_title_id is null or p_user_id is null or p_assign is null
 then raise exception 'Invalid office assignment' using errcode='22023'; end if;
 -- Serialize assignments on the title row, including the one-holder constraint.
 select * into v_title from app_private.club_office_titles
   where id=p_title_id for update;
 if not found or not v_title.active then
  raise exception 'Office inactive or unknown' using errcode='22023'; end if;
 if not exists(select 1 from public.user_roles r
    where r.user_id=p_user_id and r.role='admin') then
  raise exception 'Target must have an approved admin role'
   using errcode='42501'; end if;
 if p_assign then
  if exists(select 1 from app_private.club_office_assignments
    where title_id=p_title_id and user_id=p_user_id) then
   raise exception 'Assignment already exists' using errcode='22023'; end if;
  if v_title.single_holder and exists(select 1
    from app_private.club_office_assignments where title_id=p_title_id) then
   raise exception 'This title already has a holder' using errcode='22023'; end if;
  insert into app_private.club_office_assignments
   (title_id,user_id,assigned_by) values(p_title_id,p_user_id,v_actor);
 else
  delete from app_private.club_office_assignments
    where title_id=p_title_id and user_id=p_user_id;
  if not found then raise exception 'Assignment not found' using errcode='22023'; end if;
 end if;
 insert into app_private.club_office_audit
  (actor_id,subject_id,title_id,event,after_state)
 values(v_actor,p_user_id,p_title_id,
   case when p_assign then 'assign' else 'remove' end,
   jsonb_build_object('title_label',v_title.title_label,'assigned',p_assign));
 return true;
end;
$fn$;

-- When the underlying technical admin role is revoked, remove its independent
-- nominative titles. Old appointments may never silently return on re-approval.
create or replace function app_private.club_office_remove_revoked_admin()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
declare v_title uuid;
begin
 if old.role='admin' then
  for v_title in
    delete from app_private.club_office_assignments
    where user_id=old.user_id returning title_id
  loop
    insert into app_private.club_office_audit
      (actor_id,subject_id,title_id,event,after_state)
    values ((select auth.uid()),old.user_id,v_title,'remove',
       jsonb_build_object('reason','technical_admin_role_revoked'));
  end loop;
 end if;
 return old;
end;
$fn$;
drop trigger if exists club_office_remove_revoked_admin_trigger on public.user_roles;
create trigger club_office_remove_revoked_admin_trigger
 after delete on public.user_roles for each row
 execute function app_private.club_office_remove_revoked_admin();
revoke all on function app_private.club_office_remove_revoked_admin()
 from public,anon,authenticated,service_role;

-- A person may see their own non-sensitive labels without an admin directory.
create or replace function public.member_my_official_titles()
returns table(title_label text)
language plpgsql stable security definer set search_path=''
as $fn$
declare v_user uuid:=(select auth.uid());
begin
 if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not exists(select 1 from public.user_roles where user_id=v_user and role='admin')
 then return; end if;
 return query
 select t.title_label from app_private.club_office_assignments a
 join app_private.club_office_titles t on t.id=a.title_id
 where a.user_id=v_user and t.active
 order by t.sort_order,t.title_label limit 25;
end;
$fn$;

revoke all on function public.admin_office_list_titles() from public,anon,authenticated,service_role;
revoke all on function public.admin_office_list_administrators() from public,anon,authenticated,service_role;
revoke all on function public.admin_office_list_assignments() from public,anon,authenticated,service_role;
revoke all on function public.admin_office_save_title(uuid,text,boolean,boolean,integer,timestamptz)
 from public,anon,authenticated,service_role;
revoke all on function public.admin_office_set_assignment(uuid,uuid,boolean)
 from public,anon,authenticated,service_role;
revoke all on function public.member_my_official_titles()
 from public,anon,authenticated,service_role;
grant execute on function public.admin_office_list_titles() to authenticated;
grant execute on function public.admin_office_list_administrators() to authenticated;
grant execute on function public.admin_office_list_assignments() to authenticated;
grant execute on function public.admin_office_save_title(uuid,text,boolean,boolean,integer,timestamptz)
 to authenticated;
grant execute on function public.admin_office_set_assignment(uuid,uuid,boolean) to authenticated;
grant execute on function public.member_my_official_titles() to authenticated;

comment on table app_private.club_office_titles is
 'Custom nominative club titles. No privilege or role granted by titles.';
comment on function public.admin_office_set_assignment(uuid,uuid,boolean) is
 'Admin MFA AAL2 only; assigns display title, not security privileges.';
commit;
