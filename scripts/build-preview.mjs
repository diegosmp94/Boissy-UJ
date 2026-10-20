import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
const project = process.cwd();
const dist = join(project, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const publicPages = [
  'index.html', 'equipes.html', 'match-center.html', 'actualites.html',
  'communaute.html', 'soutenir.html', 'mon-espace.html'
];
const publicAssets = ['app.js', 'site-data.mjs', 'styles.css'];
for (const file of [...publicPages, ...publicAssets]) {
  try { await access(join(project, file)); }
  catch { continue; }
  await mkdir(dirname(join(dist, file)), { recursive: true });
  await cp(join(project, file), join(dist, file));
}
await cp(join(project, 'assets'), join(dist, 'assets'), { recursive: true });
await writeFile(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('Boissy-UJ : fichiers publics uniquement dans dist/');
