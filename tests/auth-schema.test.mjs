import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration = readFileSync(
  new URL('../supabase/migrations/202610210001_auth_foundation.sql', import.meta.url),
  'utf8'
);
test('secure auth schema defines profiles and cumulative roles',()=>{
  assert.match(migration,/create table if not exists public\.profiles/i);
  assert.match(migration,/create table if not exists public\.user_roles/i);
  assert.match(migration,/primary key \(user_id, role\)/i);
  for(const role of ['supporter','player','coach','admin']) assert.ok(migration.includes("'"+role+"'"));
});
test('RLS is active for all account tables',()=>{
  for(const table of ['profiles','user_roles']) assert.match(migration,new RegExp('alter table public\\.'+table+' enable row level security','i'));
  assert.match(migration,/profiles_select_self_or_admin/);
  assert.match(migration,/roles_select_self_or_admin/);
});
test('roles can never be self-assigned with the client API',()=>{
  assert.match(migration,/revoke all on table public\.user_roles from anon, authenticated/i);
  assert.match(migration,/grant select on public\.user_roles to authenticated/i);
  assert.doesNotMatch(migration,/create policy "[^"]+"\s+on public\.user_roles for (insert|update|delete)/i);
});
test('signup assigns supporter only and never trusts metadata for a role',()=>{
  assert.match(migration,/insert into public\.user_roles\(user_id, role\)[\s\S]*?values \(new\.id, 'supporter'\)/i);
  assert.doesNotMatch(migration,/new\.raw_user_meta_data\s*->>\s*'role'/i);
  assert.match(migration,/security definer set search_path = ''/i);
});
