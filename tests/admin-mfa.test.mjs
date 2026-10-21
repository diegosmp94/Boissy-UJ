import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = readFileSync(new URL("../supabase/migrations/202610210002_admin_mfa_gate.sql", import.meta.url),"utf8");
test("administrator security requires role AND MFA AAL2",()=>{
  assert.match(file,/auth\.jwt\(\) ->> 'aal'\) = 'aal2'/);
  assert.match(file,/and exists \(/i);
  assert.match(file,/r\.role = 'admin'/);
  assert.match(file,/security definer set search_path = ''/);
  assert.match(file,/revoke all on function app_private\.is_admin\(\) from anon/);
});
