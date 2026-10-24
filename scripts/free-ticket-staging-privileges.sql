-- Read-only guard audit, STAGING ONLY, after manual migration review.
-- This does not create members, inspect personal rows or turn on ticketing.
-- Run from a privileged staging SQL console. Any failed assertion aborts.
do $$
declare
  v_enabled boolean;
  v_rls boolean;
  v_can_anon boolean;
  v_can_authenticated boolean;
begin
  select enabled into v_enabled from app_private.free_ticketing_gate where id=1;
  if v_enabled is distinct from false then
    raise exception 'Free-ticket feature flag must stay disabled until homologation';
  end if;
  foreach v_rls in array array[
    (select relrowsecurity from pg_class where oid='app_private.free_ticketing_gate'::regclass),
    (select relrowsecurity from pg_class where oid='app_private.free_event_tickets'::regclass),
    (select relrowsecurity from pg_class where oid='app_private.free_event_ticket_audit'::regclass)
  ] loop
    if v_rls is distinct from true then
      raise exception 'Private ticket tables must have RLS enabled';
    end if;
  end loop;

  foreach v_can_anon in array array[
    has_table_privilege('anon','app_private.free_ticketing_gate','SELECT,INSERT,UPDATE,DELETE'),
    has_table_privilege('anon','app_private.free_event_tickets','SELECT,INSERT,UPDATE,DELETE'),
    has_table_privilege('anon','app_private.free_event_ticket_audit','SELECT,INSERT,UPDATE,DELETE'),
    has_function_privilege('anon','public.request_free_event_ticket(uuid)','EXECUTE'),
    has_function_privilege('anon','public.cancel_my_free_event_ticket(uuid)','EXECUTE'),
    has_function_privilege('anon','public.checkin_free_event_ticket(uuid,text)','EXECUTE')
  ] loop
    if v_can_anon then raise exception 'Anonymous ticket privilege detected'; end if;
  end loop;

  foreach v_can_authenticated in array array[
    has_table_privilege('authenticated','app_private.free_ticketing_gate','SELECT,INSERT,UPDATE,DELETE'),
    has_table_privilege('authenticated','app_private.free_event_tickets','SELECT,INSERT,UPDATE,DELETE'),
    has_table_privilege('authenticated','app_private.free_event_ticket_audit','SELECT,INSERT,UPDATE,DELETE')
  ] loop
    if v_can_authenticated then
      raise exception 'Member must never directly access ticket private tables';
    end if;
  end loop;

  if not has_function_privilege('authenticated',
    'public.request_free_event_ticket(uuid)','EXECUTE')
    or not has_function_privilege('authenticated',
      'public.cancel_my_free_event_ticket(uuid)','EXECUTE')
    or not has_function_privilege('authenticated',
      'public.checkin_free_event_ticket(uuid,text)','EXECUTE')
  then raise exception 'Expected authenticated RPC grant is missing'; end if;

  if (select prosecdef from pg_proc where oid=
    'public.request_free_event_ticket(uuid)'::regprocedure) is distinct from true
    or (select prosecdef from pg_proc where oid=
    'public.checkin_free_event_ticket(uuid,text)'::regprocedure) is distinct from true
  then raise exception 'Transactional function ownership mode mismatch'; end if;
end $$;
-- Passing this static RLS/privilege audit is NOT a live multi-account or
-- concurrent-scan recipe. Do not turn ON the flag from this file.
