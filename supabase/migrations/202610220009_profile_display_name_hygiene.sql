-- P1 defence-in-depth: apply the same display-name rules as the admin RPC.
-- No existing profile is changed; frontend registration already requires at least 2 chars.
-- Control characters are rejected; accented letters and Unicode names remain supported.
begin;
alter table public.profiles
  add constraint boissy_profile_display_name_hygiene
  check (
    char_length(pg_catalog.btrim(display_name)) between 2 and 80
    and display_name !~ '[[:cntrl:]]'
  ) not valid;
alter table public.profiles
  validate constraint boissy_profile_display_name_hygiene;
commit;
