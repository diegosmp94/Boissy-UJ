import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../auth.mjs',import.meta.url),'utf8');
test('sign-out completion only affects the same attached account panel',()=>{
 const handler=source.slice(source.indexOf('signOut.addEventListener('),source.indexOf('account.append(signOut);'));
 assert.match(handler,/if \(!root\.isConnected \|\| !account\.isConnected \|\| !root\.contains\(account\)\)return/);
 assert.match(handler,/if\(root\.isConnected && account\.isConnected && root\.contains\(account\)\)/);
 assert.match(handler,/authCard\(root, "login"\)/);
});
test('sign-out state stays stale-safe when a newer auth form takes over',()=>{
 assert.match(source,/sessionViewGeneration\+=1;\s*signOut\.disabled = true/);
 assert.match(source,/if\(signOut\.disabled\)return/);
});
