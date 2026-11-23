import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root="foxon-studio/";
const read=x=>readFileSync(root+x,"utf8");
const shell=read("shell.js"),html=read("index.html"),css=read("dashboard-icons.css");
assert.equal((shell.match(/dashboard-metric-icon--/g)||[]).length,4);
for(const name of ["planned","approval","image","opportunity"])assert(shell.includes("dashboard-metric-icon--"+name),name+" icon missing");
assert.equal((shell.match(/<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"/g)||[]).length,4);
assert(html.includes("dashboard-icons.css"),"New icon stylesheet not loaded");
assert(css.includes("#f2c500"),"FOXON colour palette not applied");
for(const p of ["premium.css","foxon-theme.css","theme-options.css","theme-contrast.css","theme-edition-v2.css","theme-arcade-deluxe.css","icon-colour-invert.css"]){
 assert(!/\.stat-mark(?:\b|[.])/.test(read(p)),"Obsolete icon selector in "+p);
}
console.log("FOXON dashboard metric icons and CSS cleanup verified");
