import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicReleaseRecord} from '../scripts/write-public-release.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const yml=read('.github/workflows/pages-public.yml');
const marker=read('scripts/write-public-release.mjs');
const live=read('scripts/live-pages-smoke.mjs');
const builder=read('scripts/build-preview.mjs');
const releaseAudit=read('scripts/audit-preview.mjs');
const initial=read('index.html');

test('public release marker contains the validated Git SHA only',()=>{
 const sha='a'.repeat(40);
 assert.deepEqual(publicReleaseRecord(sha),{commit:sha,source:'main'});
 assert.ok(Object.isFrozen(publicReleaseRecord(sha)));
 for(const s of ['', 'abc', 'b'.repeat(39), 'B'.repeat(40), 'b'.repeat(41),
  'b'.repeat(40)+'?token=secret',null])
  assert.throws(()=>publicReleaseRecord(s),/unverified Git commit/);
 assert.match(marker,/writeFile\(resolve\(root,'release\.json'\),JSON\.stringify\(record\)/);
 assert.doesNotMatch(marker,/service_role|STRIPE_SECRET_KEY|\.env|supabase\/migrations/);
});
test('Pages publication is automated on main only, after all public release tests',()=>{
 assert.match(yml,/push:\s*\n\s*branches: \[main\]/);
 assert.match(yml,/workflow_dispatch:/);
 assert.match(yml,/cancel-in-progress: false/);
 assert.match(yml,/npm run release:check/);
 assert.match(yml,/npm run audit:privacy/);
 assert.match(yml,/npm run smoke:browser/);
 assert.match(yml,/BOISSY_RELEASE_SHA:/);
 assert.match(yml,/node scripts\/write-public-release\.mjs/);
 assert.match(yml,/actions\/configure-pages@v5/);
 assert.match(yml,/actions\/upload-pages-artifact@v3/);
 assert.match(yml,/path: dist/);
 assert.match(yml,/needs: build/);
 assert.match(yml,/pages: write/);
 assert.match(yml,/id-token: write/);
 assert.match(yml,/actions\/deploy-pages@v4/);
});
test('publication checks the actual HTTPS origin and exact main revision after deploy',()=>{
 assert.match(yml,/needs: deploy/);
 assert.match(yml,/BOISSY_EXPECTED_COMMIT:/);
 assert.match(yml,/https:\/\/diegosmp94\.github\.io\/Boissy-UJ\//);
 assert.match(yml,/npm run smoke:live/);
 assert.match(yml,/exit 1/);
 assert.match(live,/const expectedCommit=String\(process\.env\.BOISSY_EXPECTED_COMMIT/);
 assert.match(live,/release\.json/);
 assert.match(live,/'"commit":"'\+expectedCommit\+'"'|'"commit":"'\+expectedCommit\+'"/);
 assert.match(live,/Authentification/);
 assert.match(live,/Calendrier et résultats/);
 assert.match(live,/Actualités/);
 assert.match(live,/Prochain match/);
});
test('deployed asset bundle excludes private source, secrets and legal SEO is not bypassed',()=>{
 assert.match(builder,/const clientExtensions=new Set\(\['\.html','\.js','\.mjs','\.css'\]\)/);
 assert.match(releaseAudit,/Internal resource leaked/);
 assert.match(releaseAudit,/Private credential marker/);
 assert.match(initial,/name="robots" content="noindex, nofollow"/);
 assert.match(yml,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(yml,/db push|supabase link|apply_migration|STRIPE_SECRET|service_role|npx\s+supabase/);
});
