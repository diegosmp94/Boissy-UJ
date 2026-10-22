-- P1 homologation: restrict member profile updates to self-owned display_name.
-- The existing RLS policy still restricts rows by auth.uid().
-- Existing BEFORE UPDATE trigger sets updated_at server-side.
-- SECURITY DEFINER admin audit RPC continues to run as its privileged owner.
begin;
revoke update on table public.profiles from authenticated;
grant update (display_name) on table public.profiles to authenticated;
commit;
