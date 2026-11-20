import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const conf=window.VUBA_CONFIG;
const db=createClient(conf.supabaseUrl,conf.supabaseAnonKey);
const $=id=>document.getElementById(id);
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const categories=["Brand","Audience","Operations","Marketing","Website","Product","Team","Open question","Other"];
let user=null,role=null,entries=[],selection=null;
function build(){
 const area=document.createElement("section");
 area.id="vubaBrain";
 area.innerHTML=`<div class="brain-head"><div><span class="brain-eyebrow">TEAM KNOWLEDGE</span><h2>Vuba Brain</h2><p>Shared, source-attributed company knowledge. Approval is required before using a claim in public content.</p></div><button id="newBrainEntry" type="button">+ Add knowledge</button></div>
 <div class="brain-summary"><span id="brainCount"></span><span id="brainApproved"></span><span id="brainReview"></span></div>
 <div class="brain-filter"><label>Search knowledge<input id="brainSearch" type="search" placeholder="Brand, product, stock, launch, people…"></label><label>Category<select id="brainCategory"><option value="">All categories</option>${categories.map(c=>'<option>'+safe(c)+'</option>').join("")}</select></label><label>Verification<select id="brainVerification"><option value="">All</option><option value="approved">Approved</option><option value="needs_review">Needs review</option><option value="superseded">Superseded</option></select></label><button id="refreshBrain" type="button">Refresh</button></div>
 <p class="hint">Source snapshots are not a live Mac-folder or GitHub sync. If Grok updates a file, refresh its entry here or ask ChatGPT to import the new version. Avoid publishing unverified or superseded claims.</p>
 <div id="brainCards" class="brain-grid" aria-live="polite"></div><p id="brainMessage" role="status"></p>`;
 const host=$("app");
 host.insertBefore(area,$("workspacePlus")||$("strategyArea")||host.querySelector(".metrics"));
 const tab=document.createElement("button");
 tab.type="button";tab.id="brainJump";tab.textContent="Vuba Brain";
 const buttons=host.querySelector(".actions");
 buttons.appendChild(tab);
 tab.onclick=()=>area.scrollIntoView({behavior:"smooth",block:"start"});
 const d=document.createElement("dialog");d.id="brainDialog";
 d.innerHTML=`<form id="brainForm">
 <div class="dialogHead"><h2 id="brainDialogTitle">Knowledge entry</h2><button id="closeBrain" type="button" aria-label="Close">×</button></div>
 <input type="hidden" name="id">
 <label>Title<input name="title" maxlength="180" required placeholder="Short, specific subject"></label>
 <div class="fields"><label>Category<select name="category">${categories.map(c=>'<option>'+safe(c)+'</option>').join("")}</select></label><label>Review status<select name="verification"><option value="needs_review">Needs review</option><option value="approved">Approved for content use</option><option value="superseded">Superseded / no longer current</option></select></label></div>
 <label>Knowledge / source text<textarea name="body" rows="9" maxlength="20000" required placeholder="Exact rule, fact, decision or open question; keep [TBC] where information is unconfirmed."></textarea></label>
 <div class="fields"><label>Source name<input name="source_label" maxlength="250" placeholder="Grok, Vuba guidelines, staff confirmation…"></label><label>Source path or reference<input name="source_path" maxlength="500" placeholder="docs/BRAND.md or project document title"></label><label>Source date<input name="source_date" type="date"></label></div>
 <label>Verification notes<textarea name="notes" rows="3" maxlength="3000" placeholder="Who confirmed it? What still needs checking?"></textarea></label>
 <p class="hint">Only admins and approvers can approve or supersede knowledge. New staff contributions start in Needs review.</p>
 <p id="brainFormError" role="alert"></p><div class="dialogActions"><button type="button" id="brainCopy">Copy as Grok handoff</button><button type="submit" id="saveBrain">Save knowledge</button></div></form>`;
 document.body.appendChild(d);
 $("brainSearch").oninput=render;
 $("brainCategory").onchange=render;
 $("brainVerification").onchange=render;
 $("refreshBrain").onclick=load;
 $("newBrainEntry").onclick=()=>openEntry();
 $("closeBrain").onclick=()=>d.close();
 $("brainCards").onclick=e=>{const b=e.target.closest("button[data-brain-id]");if(b)openEntry(entries.find(x=>x.id===b.dataset.brainId));};
 $("brainForm").onsubmit=save;
 $("brainCopy").onclick=()=>{
  const f=$("brainForm"),entry=["### Vuba Brain handoff", "Title: "+f.elements.title.value, "Category: "+f.elements.category.value,
   "Status: "+f.elements.verification.value,"Source: "+f.elements.source_label.value+" / "+f.elements.source_path.value,
   "Source date: "+f.elements.source_date.value,"",f.elements.body.value,"","Verification notes: "+f.elements.notes.value].join("\n");
  navigator.clipboard?.writeText(entry).then(()=>{$("brainFormError").textContent="Copied for Grok. This does not write to the Mac shared-memory folder.";}).catch(()=>{$("brainFormError").textContent="Copy unavailable in this browser. Select the text instead.";});
 };
}
async function init(u){
 user=u;
 if(!u){$("vubaBrain")?.remove();$("brainDialog")?.remove();$("brainJump")?.remove();entries=[];return;}
 const member=await db.from("studio_members").select("role").eq("user_id",u.id).maybeSingle();
 if(member.error||!member.data)return;
 role=member.data.role;
 if(!$("vubaBrain"))build();
 await load();
}
async function load(){
 if(!user||!$("brainCards"))return;
 const {data,error}=await db.from("studio_brain_entries").select("*").order("updated_at",{ascending:false}).limit(500);
 if(error){$("brainMessage").textContent="Couldn't load Brain: "+error.message;return;}
 entries=data||[];$("brainMessage").textContent="";
 $("brainCount").textContent=entries.length+" entries";
 $("brainApproved").textContent=entries.filter(x=>x.verification==="approved").length+" approved";
 $("brainReview").textContent=entries.filter(x=>x.verification==="needs_review").length+" need review";
 render();
}
function render(){
 if(!$("brainCards"))return;
 const q=$("brainSearch").value.toLowerCase().trim(),category=$("brainCategory").value,status=$("brainVerification").value;
 const filtered=entries.filter(x=>(!category||x.category===category)&&(!status||x.verification===status)&&(!q||[x.title,x.body,x.notes,x.source_path,x.category].join(" ").toLowerCase().includes(q)));
 $("brainCards").innerHTML=filtered.map(x=>`<article class="brain-card">
 <div class="brain-card-head"><span class="brain-tag">${safe(x.category)}</span><span class="brain-status brain-${safe(x.verification)}">${safe(x.verification.replace("_"," "))}</span></div>
 <h3>${safe(x.title)}</h3><p>${safe(x.body).slice(0,340)}${x.body.length>340?"…":""}</p>
 <div class="brain-source">Source: ${safe(x.source_label||"Team entry")} ${x.source_date?"· "+safe(x.source_date):""}<div>${safe(x.source_path||"No path supplied")}</div></div>
 <button data-brain-id="${safe(x.id)}" type="button">Read ${["admin","approver"].includes(role)?" / review":""}</button></article>`).join("")||"<p>No Brain entries match this filter.</p>";
}
function openEntry(entry){
 selection=entry||null;const f=$("brainForm");f.reset();
 for(const key of ["id","title","category","verification","body","source_label","source_path","source_date","notes"]){
  if(!f.elements[key])continue;
  f.elements[key].value=entry?.[key]||({category:"Other",verification:"needs_review"}[key]||"");
 }
 const lead=["admin","approver"].includes(role);
 f.elements.verification.disabled=!lead;
 f.elements.verification.value=entry?.verification||"needs_review";
 for(const field of f.querySelectorAll("input:not([type=hidden]), textarea, select"))field.disabled=!!entry&&!lead;
 $("saveBrain").hidden=!!entry&&!lead;
 $("brainDialogTitle").textContent=entry?"Vuba Brain · "+entry.title:"Add knowledge for review";
 $("brainFormError").textContent="";
 $("brainDialog").showModal();
}
async function save(e){
 e.preventDefault();const f=e.currentTarget;
 if(selection&&!["admin","approver"].includes(role))return;
 const payload={};
 for(const key of ["title","body","category","verification","source_label","source_path","source_date","notes"])payload[key]=f.elements[key].value.trim();
 if(!payload.source_date)payload.source_date=null;
 if(!["admin","approver"].includes(role))payload.verification="needs_review";
 payload.updated_by=user.id;
 if(!selection)payload.created_by=user.id;
 const {error}=selection
  ?await db.from("studio_brain_entries").update(payload).eq("id",selection.id)
  :await db.from("studio_brain_entries").insert(payload);
 if(error){$("brainFormError").textContent=error.message;return;}
 $("brainDialog").close();await load();
 document.dispatchEvent(new Event("vuba-brain-updated"));
}
const {data:{session}}=await db.auth.getSession();
await init(session?.user||null);
db.auth.onAuthStateChange((_,session)=>setTimeout(()=>init(session?.user||null),0));
