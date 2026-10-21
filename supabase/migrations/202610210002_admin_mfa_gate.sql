-- Boissy-UJ | Etape 3 : seuls les administrateurs en niveau AAL2
-- peuvent utiliser la clause "or admin" des politiques RLS.
-- Cette migration ne cree aucun role et aucun utilisateur.
begin;

create or replace function app_private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $function$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
    and exists (
      select 1 from public.user_roles r
      where r.user_id = (select auth.uid())
        and r.role = 'admin'
    );
$function$;

revoke all on function app_private.is_admin() from public;
revoke all on function app_private.is_admin() from anon;
grant execute on function app_private.is_admin() to authenticated;

comment on function app_private.is_admin() is
  'Admin exige a la fois le role admin et un JWT de niveau AAL2 (MFA).';

commit;
