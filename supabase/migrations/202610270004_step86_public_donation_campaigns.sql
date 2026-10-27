-- Boissy-UJ stage 86A: public fundraiser campaign CATALOG ONLY.
-- Safe to deploy to main: no payment providers, donations or entitlements.
begin;

create table if not exists public.donation_campaigns (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(btrim(title)) between 4 and 120),
 description text not null default '' check(char_length(description)<=2400),
 fund_type text not null check(fund_type in ('general','project')),
 goal_cents bigint check(goal_cents is null or goal_cents between 100 and 1000000000),
 status text not null default 'draft' check(status in ('draft','open','closed')),
 starts_at timestamptz,
 ends_at timestamptz,
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(starts_at is null or ends_at is null or ends_at>starts_at),
 check(status='draft' or published=false or starts_at is not null),
 check(status<>'open' or ends_at is null or ends_at>starts_at)
);
create index if not exists donation_campaigns_public_list_idx
 on public.donation_campaigns(status,starts_at,id) where published=true;
alter table public.donation_campaigns enable row level security;
revoke all on public.donation_campaigns from public,anon,authenticated;
grant select on public.donation_campaigns to anon,authenticated;

drop policy if exists donation_campaigns_published_read on public.donation_campaigns;
create policy donation_campaigns_published_read on public.donation_campaigns
 for select to anon,authenticated
 using (published=true and status in ('open','closed'));
-- Public readers cannot write any campaign directly, even with a valid JWT.

create table if not exists app_private.donation_campaign_audit (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null,
 actor_id uuid not null,
 action text not null check(action in ('created','updated','opened','closed','hidden')),
 before_snapshot jsonb,
 after_snapshot jsonb not null,
 recorded_at timestamptz not null default now()
);
alter table app_private.donation_campaign_audit enable row level security;
revoke all on app_private.donation_campaign_audit from public,anon,authenticated;

create or replace function public.admin_list_donation_campaigns()
returns setof public.donation_campaigns
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null
    or not coalesce((select app_private.is_admin()),false) then
  raise exception 'Verified admin MFA required' using errcode='42501';
 end if;
 return query select * from public.donation_campaigns
  order by created_at desc,id desc limit 200;
end;
$fn$;

create or replace function public.admin_save_donation_campaign(
 p_id uuid,p_title text,p_description text,p_fund_type text,
 p_goal_cents bigint,p_status text,p_starts_at timestamptz,
 p_ends_at timestamptz,p_published boolean,
 p_expected_updated_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_old public.donation_campaigns%rowtype;
 v_new public.donation_campaigns%rowtype;
 v_action text;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false) then
  raise exception 'Verified admin MFA required' using errcode='42501';
 end if;
 if p_title is null or char_length(btrim(p_title)) not between 4 and 120
  or p_description is null or char_length(p_description)>2400
  or p_fund_type is null or p_fund_type not in ('general','project')
  or p_status is null or p_status not in ('draft','open','closed')
  or p_published is null
  or (p_goal_cents is not null and (p_goal_cents<100 or p_goal_cents>1000000000))
  or (p_starts_at is not null and p_ends_at is not null and p_ends_at<=p_starts_at)
  or (p_published and (p_status='draft' or p_starts_at is null))
 then raise exception 'Invalid donation campaign definition' using errcode='22023'; end if;

 if p_id is null then
  if p_expected_updated_at is not null then
   raise exception 'Unexpected campaign version' using errcode='22023';
  end if;
  insert into public.donation_campaigns
   (title,description,fund_type,goal_cents,status,starts_at,ends_at,published)
  values(btrim(p_title),p_description,p_fund_type,p_goal_cents,p_status,
    p_starts_at,p_ends_at,p_published)
  returning * into v_new;
  v_action:='created';
 else
  select * into v_old from public.donation_campaigns
    where id=p_id for update;
  if not found then raise exception 'Campaign not found' using errcode='22023'; end if;
  if p_expected_updated_at is null or
   p_expected_updated_at is distinct from v_old.updated_at then
   raise exception 'Campaign changed; refresh required' using errcode='40001';
  end if;
  update public.donation_campaigns set
   title=btrim(p_title),description=p_description,fund_type=p_fund_type,
   goal_cents=p_goal_cents,status=p_status,starts_at=p_starts_at,
   ends_at=p_ends_at,published=p_published,
   updated_at=greatest(clock_timestamp(),v_old.updated_at+interval '1 microsecond')
  where id=p_id returning * into v_new;
  v_action:=case when v_old.published and not p_published then 'hidden'
     when p_status='closed' and v_old.status<>'closed' then 'closed'
     when p_status='open' and v_old.status<>'open' then 'opened'
     else 'updated' end;
 end if;
 insert into app_private.donation_campaign_audit
  (campaign_id,actor_id,action,before_snapshot,after_snapshot)
 values(v_new.id,v_actor,v_action,
  case when p_id is null then null else to_jsonb(v_old) end,to_jsonb(v_new));
 return v_new.id;
end;
$fn$;

revoke all on function public.admin_list_donation_campaigns()
 from public,anon,authenticated,service_role;
revoke all on function public.admin_save_donation_campaign(
 uuid,text,text,text,bigint,text,timestamptz,timestamptz,boolean,timestamptz)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_list_donation_campaigns() to authenticated;
grant execute on function public.admin_save_donation_campaign(
 uuid,text,text,text,bigint,text,timestamptz,timestamptz,boolean,timestamptz)
 to authenticated;
comment on table public.donation_campaigns is
 'Published campaign descriptions only. Financial totals, donor data and payments must never be inferred from goal_cents.';
commit;
