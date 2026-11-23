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
const brand=fs.readFileSync(path.join(root,'vuba-brand.css'),'utf8');
const theme=fs.readFileSync(path.join(root,'vuba-theme.css'),'utf8');
const accounts=fs.readFileSync(path.join(root,'social-accounts.js'),'utf8');
const media=fs.readFileSync(path.join(root,'media-manager.js'),'utf8');
assert.match(html,/vuba-brand\.css/);
assert.match(brand,/#821732/);
assert.match(brand,/#035b80/);
assert.match(brand,/#575756/);
assert.match(brand,/Poppins/);
assert.match(brand,/\.brand-lockup::before/);
assert.match(shell,/Vuba Classic · Red & Blue/);
assert.ok(!/FOXON|foxon/i.test([html,shell,hq,theme,accounts,media].join('\n')), 'FOXON wording must not appear in Vuba runtime');
assert.ok(!/#f2c500/i.test(theme), 'FOXON yellow must not appear in default Vuba theme');
assert.ok(!/invoice, cis, miles, gas/i.test(media), 'FOXON tags must not appear in Vuba media library');
console.log('Vuba static and branding smoke checks passed');