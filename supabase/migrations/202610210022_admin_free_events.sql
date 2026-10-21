-- Étape 29 : Événements gratuits / sans billetterie, admin MFA uniquement.
-- Fonctions SECURITY DEFINER sans fuite anonyme ; historique privé.
begin;
create table if not exists app_private.admin_free_events_audit (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  actor_user_id uuid not null,
  action text not null check(action in ('create_draft','create_publish','edit_draft','edit_publish','unpublish')),
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table app_private.admin_free_events_audit enable row level security;
revoke all on table app_private.admin_free_events_audit from public,anon,authenticated;

create or replace function public.admin_list_free_events()
returns setof public.club_events language plpgsql stable security definer set search_path=''
as $fn$
begin
  if (select auth.uid()) is null
     or not coalesce((select app_private.is_admin()),false)
  then raise exception 'Administrator MFA required' using errcode='42501'; end if;
  return query
    select e.* from public.club_events e
    where e.booking_kind='free' and e.access_kind='public'
    order by e.starts_at desc nulls last,e.id limit 250;
end;
$fn$;

create or replace function public.admin_save_free_event(
  p_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location_label text,
  p_capacity integer,
  p_publish boolean,
  p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_old public.club_events%rowtype;
  v_new public.club_events%rowtype;
  v_id uuid;
  v_action text;
begin
  if v_actor is null
    or not coalesce((select app_private.is_admin()),false)
  then raise exception 'Administrator MFA required' using errcode='42501'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 4 and 150
    or p_description is null or char_length(p_description)>4000
    or p_category is null or p_category not in ('club','sport','community','other')
    or p_location_label is null or char_length(p_location_label)>160
    or p_publish is null
    or (p_capacity is not null and (p_capacity<1 or p_capacity>100000))
    or ((p_starts_at is null) <> (p_ends_at is null))
    or (p_starts_at is not null and p_ends_at<=p_starts_at)
    or (p_publish and (p_starts_at is null or p_ends_at is null))
  then raise exception 'Invalid free event' using errcode='22023'; end if;
  if p_id is null then
    if p_expected_updated_at is not null then
      raise exception 'Unexpected version' using errcode='22023';
    end if;
    v_id:=gen_random_uuid();
    insert into public.club_events(
      id,slug,title,description,category,starts_at,ends_at,location_label,
      access_kind,booking_kind,price_cents,premium_price_cents,capacity,
      booking_status,priority_kind,published
    ) values (
      v_id,'evenement-'||replace(v_id::text,'-',''),btrim(p_title),p_description,p_category,
      p_starts_at,p_ends_at,nullif(btrim(p_location_label),''),
      'public','free',0,null,p_capacity,'not_open','none',p_publish
    ) returning * into v_new;
    v_action:=case when p_publish then 'create_publish' else 'create_draft' end;
  else
    select * into v_old from public.club_events where id=p_id for update;
    if not found then raise exception 'Event unavailable' using errcode='22023'; end if;
    if v_old.booking_kind<>'free' or v_old.access_kind<>'public' then
      raise exception 'Only public free events are editable here' using errcode='42501';
    end if;
    if p_expected_updated_at is null or p_expected_updated_at is distinct from v_old.updated_at then
      raise exception 'Event changed: refresh before saving' using errcode='40001';
    end if;
    update public.club_events set
      title=btrim(p_title),description=p_description,category=p_category,
      starts_at=p_starts_at,ends_at=p_ends_at,location_label=nullif(btrim(p_location_label),''),
      capacity=p_capacity,published=p_publish,
      booking_status='not_open',priority_kind='none',price_cents=0,premium_price_cents=null,
      updated_at=greatest(clock_timestamp(),v_old.updated_at+interval '1 microsecond')
    where id=p_id returning * into v_new;
    v_id:=p_id;
    v_action:=case when v_old.published and not p_publish then 'unpublish'
      when p_publish then 'edit_publish' else 'edit_draft' end;
  end if;
  insert into app_private.admin_free_events_audit
    (event_id,actor_user_id,action,before_snapshot,after_snapshot)
  values(v_id,v_actor,v_action,
    case when p_id is null then null else to_jsonb(v_old) end,to_jsonb(v_new));
  return v_id;
end;
$fn$;
revoke all on function public.admin_list_free_events() from public,anon;
revoke all on function public.admin_save_free_event(
  uuid,text,text,text,timestamptz,timestamptz,text,integer,boolean,timestamptz
) from public,anon;
grant execute on function public.admin_list_free_events() to authenticated;
grant execute on function public.admin_save_free_event(
  uuid,text,text,text,timestamptz,timestamptz,text,integer,boolean,timestamptz
) to authenticated;
comment on function public.admin_save_free_event(
  uuid,text,text,text,timestamptz,timestamptz,text,integer,boolean,timestamptz
) is 'Free public events only, secured by admin MFA AAL2, optimistic lock and private audit.';
commit;
