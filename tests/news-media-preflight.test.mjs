import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610230002_verified_news_media_assets.sql');
const admin=read('admin-news-media.mjs');

test('prepared media migration has one transaction and no corrupted or repeated functions',()=>{
 assert.equal((sql.match(/^begin;$/gm)||[]).length,1);
 assert.equal((sql.match(/^commit;$/gm)||[]).length,1);
 assert.equal((sql.match(/create or replace function public\.admin_save_news_media\(/g)||[]).length,1);
 assert.equal((sql.match(/create or replace function public\.admin_check_news_media_file\(/g)||[]).length,1);
 assert.equal((sql.match(/create or replace function app_private\.media_file_ready\(/g)||[]).length,1);
});
test('publication is rejected on server when the approved Storage object is missing',()=>{
 assert.match(sql,/if p_visible and not \(select app_private\.media_file_ready\(p_path,p_kind\)\)/);
 assert.match(sql,/raise exception 'Approved Storage file absent or unsafe'/);
 assert.match(sql,/o\.bucket_id='boissy-uj-approved' and b\.public=true/);
 assert.match(sql,/o\.name=p_path/);
 assert.match(sql,/unique index if not exists news_media_unique_storage_path_idx/);
});
test('only real files with compatible MIME and safe nonzero size are accepted',()=>{
 for(const mime of ['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
  assert.ok(sql.includes("o.metadata->>'mimetype'='"+mime+"'"),mime);
 assert.match(sql,/o\.metadata->>'size' ~ '\^\[0-9\]\{1,9\}\$'/);
 assert.match(sql,/then \(o\.metadata->>'size'\)::bigint else 0 end\) between 1 and 50000000/);
 assert.doesNotMatch(sql,/o\.metadata->>'size'\)::bigint between 1 and 50000000/);
});
test('private helper and public preflight require server-side gate and restrictive grants',()=>{
 assert.match(sql,/revoke all on function app_private\.media_file_ready\(text,text\) from public,anon,authenticated/);
 assert.match(sql,/revoke all on function public\.admin_check_news_media_file\(text,text\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.admin_check_news_media_file\(text,text\) to authenticated/);
 const preflight=sql.split('create or replace function public.admin_check_news_media_file(')[1]?.split('revoke all on function public.admin_check_news_media_file')[0]||'';
 assert.match(preflight,/auth\.uid\(\)/);
 assert.match(preflight,/app_private\.is_admin\(\)/);
 assert.match(preflight,/using errcode='42501'/);
 assert.doesNotMatch(preflight,/service_role|user_metadata/);
});
test('admin explicitly checks file and disables publish until a matching successful preflight',()=>{
 assert.match(admin,/api\.rpc\('admin_check_news_media_file'/);
 assert.match(admin,/const key=fileKey\(\)/);
 assert.match(admin,/if\(!root\.isConnected\|\|key!==fileKey\(\)\)return/);
 assert.match(admin,/if\(result\.error\|\|result\.data!==true\)/);
 assert.match(admin,/verifiedFileKey=key/);
 assert.match(admin,/if\(draft\.visible&&verifiedFileKey!==fileKey\(\)\)/);
 assert.match(admin,/node\.addEventListener\('input',resetFileCheck\)/);
 assert.match(admin,/node\.addEventListener\('change',resetFileCheck\)/);
 assert.match(admin,/adminSessionStatus\(api,userId\)/);
});
test('withdrawal warning explains that public Storage files require actual removal',()=>{
 assert.match(admin,/retrait de visibilité ne supprime PAS un fichier du bucket public/);
 assert.match(admin,/Supabase Storage en cas de demande d’effacement/);
 assert.match(admin,/fileStatus\.setAttribute\('aria-live','polite'\)/);
});
