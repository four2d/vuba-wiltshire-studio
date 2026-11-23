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
const stats=fs.readFileSync(path.join(root,'shell.js'),'utf8');
const iconCss=fs.readFileSync(path.join(root,'dashboard-icons.css'),'utf8');
for(const kind of ['planned','approval','image','opportunity'])assert.match(stats,new RegExp('dashboard-metric-icon--'+kind));
assert.equal((stats.match(/dashboard-metric-icon--/g)||[]).length,4);
assert.equal((stats.match(/<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"/g)||[]).length,4);
for(const name of ['premium.css','vuba-theme.css','theme-options.css','theme-contrast.css','theme-edition-v2.css','theme-arcade-deluxe.css']){
 assert.ok(!/\\.stat-mark(?:\\b|[.])/g.test(fs.readFileSync(path.join(root,name),'utf8')), 'legacy icon styles in '+name);
}
assert.match(html,/dashboard-icons\.css/);
assert.match(iconCss,/stroke-linecap:round/);
const conn=fs.readFileSync(path.join(root,'social-accounts.js'),'utf8');
assert.match(html,/connections-simple\\.css/);
for(const p of ['Facebook','Instagram','LinkedIn'])assert.match(conn,new RegExp('name:"'+p+'"'));
assert.ok(!/FOXON|foxon/i.test(conn));
assert.match(conn,/vuba-social-oauth/);
assert.match(conn,/Not connected/);
console.log('Vuba static, branding, dashboard and simple connections checks passed');