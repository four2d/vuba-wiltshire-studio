import {createStudioClient,getStudioUser,onStudioAuth} from "./staff-auth.js";
const db=createStudioClient();
const $=id=>document.getElementById(id);
const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const categories=["Brand","Audience","Operations","Marketing","Website","Product","Team","Open question","Other"];
let user=null,role=null,entries=[],selection=null;
function build(){
 const area=document.createElement("section");
 area.id="vubaBrain";
 area.dataset.brainView="knowledge";
 area.innerHTML=`
 <div class="brain-command">
   <div class="brain-command-copy">
     <div class="brain-overline"><span class="brain-overline-dot"></span> VUBA WILTSHIRE / KNOWLEDGE BASE</div>
     <h2>Everything we know.<br><em>All in one place.</em></h2>
     <p>One trusted home for brand guidance, product references and decisions — so every piece of content starts with the right facts.</p>
     <div class="brain-command-actions">
       <button type="button" id="newBrainEntry" class="brain-action-primary">＋ Add knowledge</button>
       <button type="button" id="brainOpenDocuments" class="brain-action-outline">⇧ Upload documents</button>
     </div>
   </div>
   <div class="brain-command-art" aria-hidden="true"><div class="brain-art-circle one"></div><div class="brain-art-circle two"></div><div class="brain-art-sheet back"><span></span><span></span></div><div class="brain-art-sheet front"><span class="brain-art-sigil">V</span><span></span><span></span><span></span></div></div>
 </div>
 <div class="brain-overview-bar">
  <div><strong id="brainCount">—</strong><span>Knowledge entries</span></div>
  <div><strong id="brainApproved">—</strong><span>Ready to use</span></div>
  <div><strong id="brainReview">—</strong><span>Awaiting review</span></div>
  <p>Only approved knowledge informs marketing suggestions.</p>
 </div>
 <div class="brain-workspace-nav" aria-label="Brain areas"><button type="button" data-brain-tab="knowledge" class="active">✦ &nbsp; Knowledge</button><button type="button" data-brain-tab="documents">▤ &nbsp; Documents</button></div>
 <div class="brain-knowledge-header"><div><span class="studio-kicker">CURATED KNOWLEDGE</span><h3>Explore the Brain</h3><p>Find a source, check its status or update what the team knows.</p></div><button id="refreshBrain" type="button" class="brain-refresh">↻ Refresh</button></div>
 <div class="brain-filter"><label class="brain-search-label"><span>SEARCH KNOWLEDGE</span><input id="brainSearch" type="search" placeholder="Search everything in the Brain…"></label><label><span>CATEGORY</span><select id="brainCategory"><option value="">All categories</option>${categories.map(c=>'<option>'+safe(c)+'</option>').join("")}</select></label><label><span>STATUS</span><select id="brainVerification"><option value="">All statuses</option><option value="approved">Approved</option><option value="needs_review">Needs review</option><option value="superseded">Superseded</option></select></label><label class="brain-show-archived"><input type="checkbox" id="brainShowArchived"> Archived</label></div>
 <div class="brain-library-note">✳ &nbsp; Source documents are securely stored. Facts must be approved before they can inform published content.</div>
 <div id="brainCards" class="brain-grid" aria-live="polite"></div><p id="brainMessage" role="status"></p>`
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
 <p id="brainFormError" role="alert"></p><div class="dialogActions"><button type="button" id="brainArchive" class="brain-danger-action" hidden>Archive entry</button><button type="button" id="brainCopy">Copy as Grok handoff</button><button type="submit" id="saveBrain">Save knowledge</button></div></form>`;
 document.body.appendChild(d);
 area.querySelectorAll("[data-brain-tab]").forEach(b=>b.onclick=()=>switchTab(b.dataset.brainTab));
 $("brainOpenDocuments").onclick=()=>{switchTab("documents");$("brainDropzone")?.scrollIntoView({block:"center",behavior:"smooth"});};
 $("brainSearch").oninput=render;
 $("brainCategory").onchange=render;
 $("brainVerification").onchange=render;
 $("brainShowArchived").onchange=render;
 $("refreshBrain").onclick=load;
 $("newBrainEntry").onclick=()=>openEntry();
 $("closeBrain").onclick=()=>d.close();
 $("brainCards").onclick=e=>{const b=e.target.closest("button[data-brain-id]");if(b)openEntry(entries.find(x=>x.id===b.dataset.brainId));};
 $("brainForm").onsubmit=save;
 $("brainArchive").onclick=archiveEntry;
 $("brainCopy").onclick=()=>{
  const f=$("brainForm"),entry=["### Vuba Brain handoff", "Title: "+f.elements.title.value, "Category: "+f.elements.category.value,
   "Status: "+f.elements.verification.value,"Source: "+f.elements.source_label.value+" / "+f.elements.source_path.value,
   "Source date: "+f.elements.source_date.value,"",f.elements.body.value,"","Verification notes: "+f.elements.notes.value].join("\n");
  navigator.clipboard?.writeText(entry).then(()=>{$("brainFormError").textContent="Copied for Grok. This does not write to the Mac shared-memory folder.";}).catch(()=>{$("brainFormError").textContent="Copy unavailable in this browser. Select the text instead.";});
 };
}
function switchTab(tab){
 const root=$("vubaBrain");if(!root)return;
 root.dataset.brainView=tab==="documents"?"documents":"knowledge";
 root.querySelectorAll("[data-brain-tab]").forEach(x=>{
  const active=x.dataset.brainTab===root.dataset.brainView;
  x.classList.toggle("active",active);x.setAttribute("aria-selected",String(active));
 });
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
 $("brainCount").textContent=String(entries.filter(x=>!x.archived_at).length);
 $("brainApproved").textContent=String(entries.filter(x=>!x.archived_at&&x.verification==="approved").length);
 $("brainReview").textContent=String(entries.filter(x=>!x.archived_at&&x.verification==="needs_review").length);
 render();
}
function render(){
 if(!$("brainCards"))return;
 const q=$("brainSearch").value.toLowerCase().trim(),category=$("brainCategory").value,status=$("brainVerification").value;
 const showArchived=$("brainShowArchived")?.checked;
 const filtered=entries.filter(x=>(showArchived||!x.archived_at)&&(!category||x.category===category)&&(!status||x.verification===status)&&(!q||[x.title,x.body,x.notes,x.source_path,x.category].join(" ").toLowerCase().includes(q)));
 $("brainCards").innerHTML=filtered.map(x=>`<article class="brain-card">
 <div class="brain-card-head"><span class="brain-tag">${safe(x.category)}</span><span class="brain-status brain-${safe(x.verification)}">${x.archived_at?"Archived":safe(x.verification.replace("_"," "))}</span></div>
 <h3>${safe(x.title)}</h3><p>${safe(x.body).slice(0,340)}${x.body.length>340?"…":""}</p>
 <div class="brain-source">Source: ${safe(x.source_label||"Team entry")} ${x.source_date?"· "+safe(x.source_date):""}<div>${safe(x.source_path||"No path supplied")}</div>${x.source_label==="Private GitHub: four2d/Vuba-Wiltshire"&&/^[a-zA-Z0-9_./-]+$/.test(x.source_path)?'<a target="_blank" rel="noopener noreferrer" href="https://github.com/four2d/Vuba-Wiltshire/blob/main/'+safe(x.source_path)+'">Open private source</a>':""}</div>
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
 $("brainArchive").hidden=!entry||!lead;
 $("brainArchive").textContent=entry?.archived_at?"Restore entry":"Archive entry";
 $("brainDialogTitle").textContent=entry?"Vuba Brain · "+entry.title:"Add knowledge for review";
 $("brainFormError").textContent="";
 $("brainDialog").showModal();
}
async function archiveEntry(){
 if(!selection||!["admin","approver"].includes(role))return;
 const restoring=!!selection.archived_at;
 if(!confirm(restoring?"Restore this Brain entry to active knowledge?":"Archive this Brain entry? It will be excluded from active knowledge and content suggestions."))return;
 const {error}=await db.from("studio_brain_entries").update({archived_at:restoring?null:new Date().toISOString(),archived_by:restoring?null:user.id,updated_by:user.id}).eq("id",selection.id);
 if(error){$("brainFormError").textContent=error.message;return;}
 $("brainDialog").close();selection=null;await load();document.dispatchEvent(new Event("vuba-brain-updated"));
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
await init(await getStudioUser());
onStudioAuth((user)=>setTimeout(()=>init(user||null),0));
