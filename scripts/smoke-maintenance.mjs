/** Offline maintenance preflight for GitHub Pages workflow. */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {SITE_MAINTENANCE} from '../site-maintenance-config.mjs';
if(SITE_MAINTENANCE.enabled!==true)throw Error('Maintenance smoke requires enabled mode');
const root=resolve(process.cwd(),'dist');
const [index,page,entry,config]=await Promise.all([
 'index.html','maintenance.html','site-entry.mjs','site-maintenance-config.mjs'
].map(name=>readFile(resolve(root,name),'utf8')));
const must=[
 [index,'src="./site-entry.mjs"'],[index,'name="robots" content="noindex, nofollow"'],
 [page,'Site en maintenance'],[page,'id="main"'],
 [page,'name="robots" content="noindex, nofollow"'],
 [page,"default-src 'none'"],[entry,"window.location.replace(destination.href)"],
 [entry,"await import('./app.js')"],[config,'enabled:true']
];
for(const [source,token] of must)if(!source.includes(token))
 throw Error('Invalid maintenance public artifact: '+token);
if(/<script\b|https?:\/\/|<form\b/i.test(page))
 throw Error('Maintenance page must not collect data, run scripts or load remote resources');
console.log('Maintenance preflight passed: anonymous visitors are sent to local static maintenance page.');
