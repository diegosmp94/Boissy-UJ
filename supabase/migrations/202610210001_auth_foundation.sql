-- Boissy-UJ | ETAPE 3 : fondations profils et roles
-- Ne cree aucun utilisateur et n'active aucun paiement.
-- Les informations sensibles des joueurs/mineurs ne sont pas stockees ici.
begin;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Supporter'
    check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('supporter','player','coach','admin')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists idx_user_roles_role on public.user_roles (role);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Role lookup encapsule pour eviter les politiques RLS recursives.
-- Le schema prive n'est pas expose dans les APIs publiques.
create or replace function app_private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1
      from public.user_roles r
     where r.user_id = (select auth.uid())
       and r.role = 'admin'
  );
$function$;

revoke all on function app_private.is_admin() from public;
revoke all on function app_private.is_admin() from anon;
grant execute on function app_private.is_admin() to authenticated;

-- Profil : visible/modifiable uniquement par soi-meme ou par un administrateur.
create policy "profiles_select_self_or_admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select app_private.is_admin()));

create policy "profiles_insert_self"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_self_or_admin"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select app_private.is_admin()))
  with check (id = (select auth.uid()) or (select app_private.is_admin()));

-- Droits : lisibles par le compte concerne et par les admins.
-- Aucune politique INSERT/UPDATE/DELETE pour authenticated !
-- L'attribution et la revocation passent par le serveur privilegie.
create policy "roles_select_self_or_admin"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select app_private.is_admin()));

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
revoke all on table public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

-- Attribution du role minimal au moment de l'inscription.
-- raw_user_meta_data est controle par l'utilisateur : jamais utiliser
-- cette source pour donner les roles coach / admin / premium.
create or replace function app_private.handle_boissy_signup()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
begin
  insert into public.profiles(id, display_name)
  values (
    new.id,
    left(
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Supporter'),
      100
    )
  )
  on conflict (id) do nothing;

  insert into public.user_roles(user_id, role)
  values (new.id, 'supporter')
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;

revoke all on function app_private.handle_boissy_signup() from public, anon, authenticated;

create or replace function app_private.touch_boissy_profile()
returns trigger
language plpgsql set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function app_private.touch_boissy_profile() from public, anon, authenticated;

drop trigger if exists trg_boissy_signup on auth.users;
create trigger trg_boissy_signup
after insert on auth.users
for each row execute function app_private.handle_boissy_signup();

drop trigger if exists trg_boissy_profiles_updated on public.profiles;
create trigger trg_boissy_profiles_updated
before update on public.profiles
for each row execute function app_private.touch_boissy_profile();

comment on table public.profiles is
  'Boissy-UJ: profil public minimal sans informations sensibles de mineurs.';
comment on table public.user_roles is
  'Boissy-UJ: roles cumulables, modifications reservees au serveur privilegie.';

commit;
