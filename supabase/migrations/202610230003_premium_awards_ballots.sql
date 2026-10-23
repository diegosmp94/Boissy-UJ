-- Étape 54 : Awards Premium — vote privé, unique, vérifié exclusivement côté serveur.
-- Aucun abonnement n'est accordé ici, aucune catégorie ni aucun vote n'est inséré.
-- IMPORTANT : migration préparée pour staging uniquement avant déploiement autorisé.
-- Le webhook de facturation signé devra être développé et homologué SÉPARÉMENT.
begin;

-- Table strictement privée : aucun rôle web ne peut y accéder directement.
-- L'écriture future devra venir exclusivement d'un traitement de facturation vérifié.
create table if not exists app_private.award_vote_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source_kind text not null check (source_kind='verified_billing_webhook'),
  source_reference text not null unique
    check (char_length(btrim(source_reference)) between 10 and 220),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (valid_until>valid_from),
  check (revoked_at is null or revoked_at>=verified_at)
);
create index if not exists award_vote_entitlements_expiry_idx
  on app_private.award_vote_entitlements(valid_until);
alter table app_private.award_vote_entitlements enable row level security;
revoke all on app_private.award_vote_entitlements from public,anon,authenticated;
-- Aucun GRANT INSERT ni RPC d'attribution Premium. Faute d'attestation : refus.

-- Un seul bulletin ACTIF par compte et par catégorie.
-- La participation est privée : aucune lecture publique des votants ni des totaux.
create table if not exists app_private.award_ballots (
  award_id uuid not null references public.club_awards(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  nominee_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (award_id,user_id),
  constraint award_ballot_same_category foreign key (award_id,nominee_id)
    references public.club_award_nominees(award_id,id) on delete restrict
);
create index if not exists award_ballots_private_owner_idx
  on app_private.award_ballots(user_id,award_id);
alter table app_private.award_ballots enable row level security;
revoke all on app_private.award_ballots from public,anon,authenticated;

-- La transaction vérifie identité, droit PREMIUM réellement attesté, fenêtre
-- temporelle, consentement nominatif et publication, indépendamment du navigateur.
create or replace function public.member_cast_award_vote(
  p_award_id uuid,p_nominee_id uuid
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
  v_user uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_award_id is null or p_nominee_id is null then
    raise exception 'Invalid award selection' using errcode='22023';
  end if;

  -- Compte confirmé, pas de vote sur la simple présence d'un JWT ou rôle Supporter.
  if not exists(
    select 1 from auth.users u
    where u.id=v_user and u.email_confirmed_at is not null
  ) then
    raise exception 'Confirmed account required' using errcode='42501';
  end if;
  if not exists(
    select 1 from app_private.award_vote_entitlements e
    where e.user_id=v_user
      and e.source_kind='verified_billing_webhook'
      and e.verified_at<=v_now
      and e.revoked_at is null
      and e.valid_from<=v_now and v_now<e.valid_until
  ) then
    raise exception 'Verified Premium access required' using errcode='42501';
  end if;

  -- FOR SHARE synchronise avec les modifications d'édition par un opérateur.
  perform 1 from public.club_awards a
  where a.id=p_award_id and a.published=true
    and a.voting_status='open' and a.results_published=false
    and a.opens_at is not null and a.closes_at is not null
    and a.opens_at<=v_now and v_now<a.closes_at
  for share;
  if not found then
    raise exception 'Award voting is not available' using errcode='42501';
  end if;

  perform 1 from public.club_award_nominees n
  where n.id=p_nominee_id and n.award_id=p_award_id
    and n.published=true and n.consent_reviewed=true
  for share;
  if not found then
    raise exception 'Nomination unavailable' using errcode='42501';
  end if;

  insert into app_private.award_ballots (award_id,user_id,nominee_id)
    values (p_award_id,v_user,p_nominee_id)
    on conflict (award_id,user_id) do nothing;
  if not found then
    raise exception 'An active vote already exists for this award'
      using errcode='23505';
  end if;
  return true;
end;
$fn$;

-- Accès exclusivement à son bulletin. Ne révèle aucun total ni autre votant.
create or replace function public.member_my_award_vote(
  p_award_id uuid
) returns uuid
language plpgsql stable security definer set search_path=''
as $fn$
declare
  v_user uuid := (select auth.uid());
  v_nominee uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_award_id is null then
    raise exception 'Award identifier required' using errcode='22023';
  end if;
  select b.nominee_id into v_nominee
    from app_private.award_ballots b
    where b.award_id=p_award_id and b.user_id=v_user;
  return v_nominee;
end;
$fn$;

-- Un membre peut retirer son bulletin, y compris après fermeture du vote.
-- Le retrait supprime les données privées et n'exige pas un Premium toujours actif.
create or replace function public.member_withdraw_award_vote(
  p_award_id uuid
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_award_id is null then
    raise exception 'Award identifier required' using errcode='22023';
  end if;
  delete from app_private.award_ballots
  where award_id=p_award_id and user_id=v_user;
  return found;
end;
$fn$;

-- Supabase REST : seulement les trois fonctions vérifiées, jamais les tables.
revoke all on function public.member_cast_award_vote(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.member_my_award_vote(uuid)
  from public,anon,authenticated;
revoke all on function public.member_withdraw_award_vote(uuid)
  from public,anon,authenticated;
grant execute on function public.member_cast_award_vote(uuid,uuid)
  to authenticated;
grant execute on function public.member_my_award_vote(uuid)
  to authenticated;
grant execute on function public.member_withdraw_award_vote(uuid)
  to authenticated;

comment on table app_private.award_vote_entitlements is
  'Droit Premium provenant uniquement d’une attestation serveur de facturation vérifiée ; aucune attribution côté client.';
comment on table app_private.award_ballots is
  'Bulletins privés ; un vote actif par membre et catégorie ; retrait à la demande, aucune visibilité publique.';
comment on function public.member_cast_award_vote(uuid,uuid) is
  'Vote unique serveur ; vérifie compte confirmé, Premium attesté, fenêtre ouverte, catégorie et consentement.';
comment on function public.member_withdraw_award_vote(uuid) is
  'Supprime uniquement le propre vote du compte authentifié, même après clôture.';

commit;
