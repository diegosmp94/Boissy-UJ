-- Display-name-only rename. Preserve team UUID, code, discipline, slug/routes,
-- current matches, assignments, callups, division and all other business records.
begin;
do $$
begin
 if not exists (
  select 1 from public.club_teams where code='futsal' and discipline='futsal'
 ) then
  raise exception 'Expected futsal team not found; review before rename';
 end if;
 if exists (
  select 1 from public.club_teams
  where code='futsal' and discipline='futsal'
    and name not in ('Boissy-UJ Futsal','Seniors Futsal')
 ) then
  raise exception 'Unexpected existing futsal team name; review before rename';
 end if;
 update public.club_teams
   set name='Seniors Futsal'
   where code='futsal' and discipline='futsal' and name='Boissy-UJ Futsal';
end;
$$;
commit;
