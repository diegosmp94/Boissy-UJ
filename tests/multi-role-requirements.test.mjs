import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const spec=read('docs/CAHIER_DES_CHARGES.md');
const decisions=read('docs/DECISIONS.md');
const roadmap=read('docs/PLAN_DEVELOPPEMENT.md');
const authDoc=read('docs/ETAPE_3_AUTH.md');
const panelDoc=read('docs/ETAPE_7_CONTROL_CENTER.md');
const authSchema=read('supabase/migrations/202610210001_auth_foundation.sql');
const mfaSchema=read('supabase/migrations/202610210002_admin_mfa_gate.sql');

test('cahier des charges accepts all requested double and triple combinations',()=>{
  for(const roles of [
    'Joueur + entraîneur','Joueur + administrateur',
    'Entraîneur + administrateur','Joueur + entraîneur + administrateur'
  ]) assert.ok(spec.includes(roles), 'missing '+roles);
  assert.match(spec,/Un même compte peut posséder simultanément les rôles/);
  assert.match(spec,/supporter.*ne compte pas dans le calcul des doubles ou triples/s);
});

test('every added role is admin-approved without self-approval',()=>{
  assert.match(spec,/aucun deuxième ou troisième rôle n'est actif avant la validation d'un administrateur/);
  assert.match(spec,/ne peut jamais approuver sa propre demande/);
  assert.match(spec,/administrateur distinct du bénéficiaire/);
  assert.match(spec,/MFA \*\*AAL2\*\*/);
  assert.match(spec,/demande en attente n'ouvre \*\*aucune permission\*\*/);
  assert.match(spec,/rôle \x60admin\x60 n'attribue pas automatiquement le rôle \x60coach\x60/);
});

test('one role removal retains others and coach team assignment stays separate',()=>{
  assert.match(spec,/La révocation d'une seule fonction laisse les autres intactes/);
  assert.match(spec,/révocation \x60coach\x60 désactive également ses affectations d'équipes/);
  assert.match(spec,/validation d'un rôle entraîneur.*validation de.*ses affectations par équipe/);
});

test('current database design allows multiple roles and refuses client grants',()=>{
  assert.match(authSchema,/primary key \(user_id, role\)/);
  assert.doesNotMatch(authSchema,/unique\s*\(user_id\)/i);
  assert.match(authSchema,/role in \('supporter','player','coach','admin'\)/);
  assert.match(authSchema,/grant select on public\.user_roles to authenticated/);
  assert.doesNotMatch(authSchema,/grant\s+(?:insert|update|delete)\s+on public\.user_roles to authenticated/i);
  assert.match(mfaSchema,/auth\.jwt\(\) ->> 'aal'\) = 'aal2'/);
});

test('no documentation misleadingly claims approval flow is deployed',()=>{
  assert.match(spec,/circuit de demandes et d'approbations des doubles\/triples rôles.*encore être développé/);
  assert.match(authDoc,/circuit de demandes\/approbations \*\*non développé\*\*/);
  assert.match(decisions,/Cahier des charges V1\.1/);
  assert.match(roadmap,/cahier des charges V1\.1/i);
  assert.match(panelDoc,/prévisualisation n'attribue jamais de rôle/);
  assert.match(read('README.md'),/docs\/CAHIER_DES_CHARGES\.md/);
});
