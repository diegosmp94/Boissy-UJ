-- Additional indexes for foreign-key lookups in the new private title registry.
-- Non-destructive, empty by default, and never changes privileges or nominations.
begin;
create index if not exists club_office_titles_creator_idx
 on app_private.club_office_titles(created_by);
create index if not exists club_office_assignments_actor_idx
 on app_private.club_office_assignments(assigned_by);
create index if not exists club_office_audit_actor_idx
 on app_private.club_office_audit(actor_id);
create index if not exists club_office_audit_subject_idx
 on app_private.club_office_audit(subject_id);
commit;
