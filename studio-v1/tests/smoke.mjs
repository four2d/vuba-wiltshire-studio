import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const root='studio-v1';const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const name of [...html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"]*)?"/g)].map(x=>x[1])){
 if(/^(?:https?:|data:)/.test(name))continue;
 assert.ok(fs.existsSync(path.join(root,name)), 'missing local asset '+name);
}
for(const file of fs.readdirSync(root).filter(x=>x.endsWith('.js'))){
 const p=path.join(root,file);
 if(file==='config.js'||file==='offline.js'){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
 else{const code=fs.readFileSync(p,'utf8');const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8'});assert.equal(r.status,0,p+': '+r.stderr);}
}
const shell=fs.readFileSync(path.join(root,'shell.js'),'utf8');
const hq=fs.readFileSync(path.join(root,'marketing-hq.js'),'utf8');
assert.match(shell,/Vuba Wiltshire|VUBA WILTSHIRE/);
assert.ok(!/FOXON|foxonsoftware|CIS, Miles and Gas/.test(shell));
assert.ok(!/foxonsoftware|CIS admin|invoice workflow|mileage notes/.test(hq));
assert.match(html,/marketing-hq\.js/);
assert.match(html,/studio-upgrades\.js/);
assert.match(html,/social-accounts\.js/);
console.log('Vuba static smoke check passed');