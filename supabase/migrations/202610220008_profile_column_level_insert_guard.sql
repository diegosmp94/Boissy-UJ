-- Protect immutable identity and timestamps at profile creation too.
-- Signed-in members may create only their own profile (RLS) and supply
-- the displayed name; id is matched against auth.uid() by INSERT WITH CHECK.
-- Defaults and server triggers continue to populate timestamps.
begin;
revoke insert on table public.profiles from authenticated;
grant insert (id,display_name) on table public.profiles to authenticated;
commit;
