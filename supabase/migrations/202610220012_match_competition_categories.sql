-- Cup and league are classified per published/draft match by an MFA administrator.
-- Existing fixtures stay UNSPECIFIED to avoid inventing a competition.
begin;
alter table public.matches
 add column if not exists competition_kind text not null default 'unspecified'
 check (competition_kind in ('league','cup','friendly','unspecified'));
alter table public.matches
 add column if not exists competition_label text
 check (competition_label is null or length(btrim(competition_label)) between 3 and 100);

create table if not exists app_private.match_competition_audit(
 id bigint generated always as identity primary key,
 match_id uuid not null references public.matches(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 old_kind text not null, old_label text,
 new_kind text not null, new_label text,
 changed_at timestamptz not null default now()
);
alter table app_private.match_competition_audit enable row level security;
revoke all on app_private.match_competition_audit from public,anon,authenticated;

create or replace function public.admin_set_match_competition(
 p_match_id uuid,p_kind text,p_label text
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_old public.matches%rowtype;
 v_label text := nullif(btrim(p_label),'');
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_match_id is null or p_kind not in ('league','cup','friendly','unspecified')
   or p_kind is null
   or (v_label is not null and (length(v_label) not between 3 and 100 or v_label ~ '[[:cntrl:]]'))
   or (p_kind='cup' and v_label is null)
 then
  raise exception 'Invalid competition category' using errcode='22023';
 end if;
 select * into v_old from public.matches where id=p_match_id for update;
 if not found then raise exception 'Match not found' using errcode='22023'; end if;
 update public.matches
  set competition_kind=p_kind,competition_label=v_label,updated_at=now()
 where id=p_match_id;
 insert into app_private.match_competition_audit(
  match_id,actor_user_id,old_kind,old_label,new_kind,new_label)
 values(p_match_id,v_actor,v_old.competition_kind,v_old.competition_label,p_kind,v_label);
 return p_match_id;
end;
$fn$;
revoke all on function public.admin_set_match_competition(uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.admin_set_match_competition(uuid,text,text)
 to authenticated;
comment on column public.matches.competition_kind is
 'league, cup, friendly or unspecified; only MFA admins classify via audited RPC.';
commit;