import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const app = read("app.js"), auth = read("auth.mjs"), cfg = read("auth-config.mjs"),
  sql = read("supabase/migrations/202610210001_auth_foundation.sql"),
  styles = read("styles.css");

test("Supabase Auth is wired to the existing Mon espace route", () => {
  assert.match(app, /import \{authMarkup,mountAuth,unmountAuth\} from '\.\/auth\.mjs'/);
  assert.match(app, /if\(path==='\/mon-espace'\) void mountAuth\(\); else unmountAuth\(\);/);
  assert.match(auth, /export function authMarkup\(/);
  assert.match(auth, /export async function mountAuth\(/);
});
test("Client exposes only a public Supabase publishable key", () => {
  assert.match(cfg, /sb_publishable_/);
  assert.doesNotMatch(cfg + app + auth, /service_role|sb_secret_|sk_live_|pk_live_/);
  assert.match(auth, /createClient\(/);
});
test("Registration and recovery do not derive roles from editable profile metadata", () => {
  assert.match(auth, /signUp\(/);
  assert.match(auth, /signInWithPassword\(/);
  assert.match(auth, /resetPasswordForEmail\(/);
  assert.match(auth, /updateUser\(/);
  assert.match(auth, /signOut\(/);
  assert.doesNotMatch(auth, /from\(["']user_roles["']\)\.(insert|update|upsert|delete)/);
  assert.match(sql, /values \(new\.id, 'supporter'\)/);
  assert.doesNotMatch(sql, /new\.raw_user_meta_data\s*->>\s*'role'/);
});
test("Role changes are denied to authenticated browser users", () => {
  assert.match(sql, /alter table public\.user_roles enable row level security;/);
  assert.match(sql, /revoke all on table public\.user_roles from anon, authenticated;/);
  assert.match(sql, /grant select on public\.user_roles to authenticated;/);
});
test("Account UI escapes server-supplied profile and email content using textContent", () => {
  assert.match(auth, /node\.textContent = text/);
  assert.match(auth, /profileResult\.data\?\.display_name/);
  assert.match(auth, /if \(!root\.isConnected\) return/);
  assert.match(styles, /\.auth-field input:focus-visible/);
});
