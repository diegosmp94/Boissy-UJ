-- Boissy-UJ étape 19 : deux disciplines, cinq équipes confirmées.
-- Ne change aucun UUID historique ; n'ajoute aucun match, joueur ou rôle.
begin;
alter table public.club_teams
  add column if not exists discipline text not null default 'football';
alter table public.club_teams
  drop constraint if exists club_teams_code_check;
alter table public.club_teams
  add constraint club_teams_code_check
  check (code in ('a','b','c','veterans','futsal'));
alter table public.club_teams
  drop constraint if exists club_teams_sort_order_check;
alter table public.club_teams
  add constraint club_teams_sort_order_check
  check (sort_order between 1 and 5);
alter table public.club_teams
  add constraint club_teams_discipline_code_check
  check (
    (discipline='football' and code in ('a','b','c','veterans'))
    or (discipline='futsal' and code='futsal')
  );
-- Une seule équipe Futsal, informations validées par le club.
-- La source « manual » ne prétend pas disposer d'une synchronisation FFF.
insert into public.club_teams (code,name,division,source_kind,sort_order,discipline)
values ('futsal','Boissy-UJ Futsal','Départemental 2','manual',5,'futsal')
on conflict (code) do nothing;
comment on column public.club_teams.discipline is
 'Discipline football à 11 ou futsal ; catégorie indépendante du rôle joueur/entraîneur.';
comment on table public.club_teams is
 'Boissy-UJ : quatre équipes football à 11 et une équipe futsal Départemental 2.';
-- On conserve RLS, la politique SELECT et les interdictions d'écriture navigateur.
commit;
