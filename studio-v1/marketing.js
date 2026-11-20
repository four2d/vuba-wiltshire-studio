import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg = window.VUBA_CONFIG;
const db = createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pillars = {
 "Installer Advice":"Useful trade","Product Education":"Useful trade",
 "Blends & Colour Inspiration":"Products / stock","Local Stock & Availability":"Products / stock",
 "Project Planning":"Useful trade","Behind the Scenes / Depot":"Local / depot",
 "Installer & Project Spotlights":"Useful trade","FAQs & Myth Busting":"Useful trade",
 "Homeowner Education":"Useful trade","Commercial / Sales":"Commercial"
};
const targets = {"Useful trade":.6,"Products / stock":.2,"Local / depot":.1,"Commercial":.1};
const seasonSets = [
 {months:[11,0,1],label:"Winter",items:[
 ["Before the Pour: checking the forecast before promising a start date","Installer Advice","Before the Pour","Ask installers what they check; verify any temperature, moisture or dew-point guidance against current Vuba documents before writing a technical caption.","Carousel"],
 ["Cold-weather site readiness: questions to ask before committing a crew","Project Planning","Site-Day Checklist","Focus on planning questions only. Do not give unsupported thresholds, cure times or application instructions.","Carousel"],
 ["Winter projects: explaining programme uncertainty to customers","Project Planning","","A practical trade conversation on agreeing weather-dependent scheduling; no invented promises.","Text-led"],
 ["Ask Vuba Wiltshire: what should I check before a winter installation?","FAQs & Myth Busting","Ask Vuba Wiltshire","Collect a real question and get an approved HQ technical source before answering.","Single image"],
 ["Choosing a blend in low winter light","Blends & Colour Inspiration","Blend of the Week","Use a confirmed blend name and genuine approved photo, or keep this as a photography brief.","Single image"],
 ["What installers need from a local trade counter in winter","Behind the Scenes / Depot","","Use an actual depot photograph or staff contribution; do not imply stock, services or opening hours.","Single image"],
 ["Planning materials for the first jobs of the new year","Project Planning","","Prompt installers to confirm orders, lead times and availability with staff; no unverified stock claims.","Single image"]
 ]},
 {months:[2,3,4],label:"Spring",items:[
 ["Spring site-preparation questions before the first pour","Installer Advice","Before the Pour","Questions only until technical preparation advice is checked against HQ guidance.","Carousel"],
 ["Choosing colour samples in changing natural light","Blends & Colour Inspiration","Blend of the Week","Requires genuine approved sample photographs and a verified blend identity.","Carousel"],
 ["Project planning when the diary starts filling","Project Planning","","Offer useful scheduling questions; don't claim actual availability.","Text-led"],
 ["Ask Vuba Wiltshire: a real spring installer question","FAQs & Myth Busting","Ask Vuba Wiltshire","Get a genuine question and approved answer from a named source.","Single image"],
 ["Behind the counter: a genuine spring morning","Behind the Scenes / Depot","","Requires a real photograph from the depot; no invented activity.","Reel"]
 ]},
 {months:[5,6,7],label:"Summer",items:[
 ["Summer site-day checklist: what needs confirming before work starts?","Installer Advice","Site-Day Checklist","Use only verified technical sources for conditions and handling guidance.","Carousel"],
 ["Planning the crew and material delivery for a busy week","Project Planning","","Focus on decisions and checks; do not imply confirmed delivery capability.","Text-led"],
 ["Blend choices in strong sunlight","Blends & Colour Inspiration","Blend of the Week","Use genuine approved photos and confirmed blend identity.","Single image"],
 ["Installer spotlight: the story behind a completed job","Installer & Project Spotlights","","Requires the installer's permission and verified project details.","Carousel"],
 ["Ask Vuba Wiltshire: an installer question from the counter","FAQs & Myth Busting","Ask Vuba Wiltshire","Only quote a real question with permission; verify the answer.","Single image"]
 ]},
 {months:[8,9,10],label:"Autumn",items:[
 ["Autumn weather planning: the questions to settle before a start","Project Planning","Before the Pour","No technical thresholds without checked HQ documents.","Carousel"],
 ["Site-Day Checklist: checking the conditions before a pour","Installer Advice","Site-Day Checklist","Create a checklist only with verified current manufacturer guidance.","Carousel"],
 ["Autumn light and resin blend selection","Blends & Colour Inspiration","Blend of the Week","Genuine sample photos, approved blend identity.","Single image"],
 ["Planning projects as daylight hours change","Project Planning","","Practical planning prompts; do not invent durations.","Text-led"],
 ["Ask Vuba Wiltshire: a real autumn installation question","FAQs & Myth Busting","Ask Vuba Wiltshire","Ask staff to provide question and vetted technical source.","Single image"]
 ]}
];
const evergreen=[
 ["Installer Tip: one preparation check teams often overlook","Installer Advice","Installer Tip","Ask an experienced installer for one verified example. Do not invent installation advice.","Single image"],
 ["Product Education: what question should be asked before specifying a system?","Product Education","","Use manufacturer-approved product information; avoid unsupported specifications.","Carousel"],
 ["Ask Vuba Wiltshire: a question from the trade counter","FAQs & Myth Busting","Ask Vuba Wiltshire","Collect the real question and source first.","Single image"],
 ["Project spotlight: a decision the installer got right","Installer & Project Spotlights","","Requires consent and verified job details; no fabricated client outcome.","Carousel"],
 ["On the Pallet: a real arrival from Sutton Veny","Local Stock & Availability","On the Pallet","Publish only when staff confirm the product, arrival and availability.","Single image"],
 ["How a local trade counter can help with project planning","Commercial / Sales","","Use only confirmed services, hours and delivery information.","Text-led"],
 ["A real face behind the depot","Behind the Scenes / Depot","","Requires genuine staff participation and consent.","Single image"],
 ["Site-Day Checklist: three questions before the crew arrives","Project Planning","Site-Day Checklist","Use planning questions, not technical instructions.","Carousel"]
];
let user=null,role=null,plan=null,posts=[],campaignPlans=[],approvedKnowledge=[],suggestions=[],previewIndex=-1,previewDraft=null;
function launchUI(){
 const app=document.getElementById("app"); if(!app||document.getElementById("strategyArea"))return;
 const el=document.createElement("section");el.id="strategyArea";el.className="strategy-area";
 el.innerHTML=`<div class="strategy-tabs"><button id="tabSuggestions" class="active" type="button">Suggested posts</button><button id="tabPlan" type="button">Marketing plan</button></div>
 <section id="suggestionPanel" class="panel"><div class="strategy-head"><div><h2>What should we post next?</h2><p id="seasonIntro">Ideas tailored to the season, editorial balance and your plan.</p></div><button id="refreshSuggestions" type="button">Refresh suggestions</button></div><p class="hint">Suggestions are briefs, not finished captions. Facts, photos and technical guidance must be verified before approval.</p><div id="suggestionCards" class="suggestion-cards"></div><p id="suggestionMessage" role="status"></p></section>
 <section id="planPanel" class="panel" hidden><div class="strategy-head"><div><h2>Vuba Wiltshire marketing plan</h2><p>One shared strategy for all staff. It informs the next round of suggested posts.</p></div><span id="planPermission" class="hint"></span></div><form id="strategyForm"><label>Overall aim<textarea name="goal" rows="2" required></textarea></label><label>Primary audience<textarea name="audience" rows="2" required></textarea></label><label>Current priorities<textarea name="priorities" rows="3" required></textarea></label><label>Campaigns and key messages<textarea name="campaigns" rows="3" placeholder="Only add real agreed campaigns."></textarea></label><label>Seasonal focus<textarea name="seasonal_notes" rows="3" placeholder="What's especially relevant for installers this season?"></textarea></label><label>Confirmed events and dates<textarea name="confirmed_events" rows="3" placeholder="Training, open days, launches — confirmed dates only."></textarea></label><label>Posting rhythm<textarea name="cadence" rows="2"></textarea></label><div class="strategy-head"><button id="saveStrategy" type="submit">Save shared plan</button><span id="strategyMessage" role="status"></span></div></form></section>`;
 app.insertBefore(el,app.querySelector(".metrics"));
 const dialog=document.createElement("dialog");
 dialog.id="ideaPreview";
 dialog.setAttribute("aria-labelledby","previewHeading");
 dialog.innerHTML=`<div class="preview-header"><div><small class="suggestion-pill">EDITORIAL PREVIEW</small><h2 id="previewHeading">Suggested post</h2></div><button type="button" id="closePreview" aria-label="Close preview">×</button></div>
 <div id="previewMeta" class="preview-meta"></div>
 <div class="preview-section"><h3>Suggested angle</h3><p id="previewAngle"></p></div>
 <div class="preview-section"><h3>Working headline</h3><p id="previewTitle"></p></div>
 <div class="preview-section"><h3>Image / format brief</h3><p id="previewVisual"></p></div>
 <div class="preview-section"><h3>Draft caption</h3><p class="hint">Generate a draft with AI, or add the idea without a caption.</p><textarea id="previewCaption" class="preview-caption" rows="5" placeholder="Add your own caption, paste one from ChatGPT, or generate when API credits are available."></textarea><p class="hint">Edits remain in this preview until you choose Add to calendar.</p></div>
 <div class="preview-section"><h3>How this will look</h3><div class="workspace-tabs" id="ideaPreviewChannels"><button type="button" data-idea-channel="Instagram" class="active">Instagram</button><button type="button" data-idea-channel="Facebook">Facebook</button><button type="button" data-idea-channel="LinkedIn">LinkedIn</button></div>
 <div class="social-mock"><div class="mock-head"><div class="mock-avatar">VW</div><div><strong>Vuba Wiltshire</strong><small id="ideaMockPlatform">Instagram · Preview</small></div></div><div class="mock-image"><div class="mock-placeholder">Approved photo can be chosen in the post editor</div></div><div class="mock-copy"><h3 id="ideaMockTitle"></h3><p id="ideaMockCaption"></p></div><div class="mock-actions">♡ &nbsp; ◌ &nbsp; ↗</div></div></div>
 <div class="preview-section"><h3>Checks before publishing</h3><p id="previewChecks"></p></div>
 <p id="previewError" role="status"></p>
 <div class="preview-actions"><button type="button" id="previewAI" class="secondary-btn">Generate AI draft</button><button type="button" id="previewAdd">Add to calendar</button></div>`;
 document.body.appendChild(dialog);
 document.getElementById("closePreview").onclick=()=>dialog.close();
 document.getElementById("previewAI").onclick=generatePreviewDraft;
 document.getElementById("previewCaption").oninput=updateIdeaMock;
 document.getElementById("ideaPreviewChannels").onclick=e=>{
  const b=e.target.closest("[data-idea-channel]");if(!b)return;
  document.querySelectorAll("[data-idea-channel]").forEach(x=>x.classList.toggle("active",x===b));
  document.getElementById("ideaMockPlatform").textContent=b.dataset.ideaChannel+" · Preview";
  document.querySelector("#ideaPreview .social-mock").className="social-mock platform-"+b.dataset.ideaChannel.toLowerCase();
  updateIdeaMock();
 };
 document.getElementById("previewAdd").onclick=()=>addPreviewToCalendar();

 document.getElementById("tabSuggestions").onclick=()=>tab("suggestions");
 document.getElementById("tabPlan").onclick=()=>tab("plan");
 document.getElementById("refreshSuggestions").onclick=()=>loadAll();
 document.getElementById("strategyForm").onsubmit=savePlan;
 document.getElementById("suggestionCards").onclick=async ev=>{
 const b=ev.target.closest("button[data-preview]");if(!b)return;openPreview(Number(b.dataset.preview));
 };
}
function tab(mode){
 document.getElementById("suggestionPanel").hidden=mode!=="suggestions";
 document.getElementById("planPanel").hidden=mode!=="plan";
 document.getElementById("tabSuggestions").classList.toggle("active",mode==="suggestions");
 document.getElementById("tabPlan").classList.toggle("active",mode==="plan");
}
async function init(u){
 user=u;if(!user){document.getElementById("strategyArea")?.remove();return;}
 const {data:member,error}=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
 if(error||!member)return;role=member.role;launchUI();await loadAll();
}
async function loadAll(){
 try{
  const [p,ps,cs,brain]=await Promise.all([
   db.from("studio_marketing_plan").select("*").eq("id",1).single(),
   db.from("studio_posts").select("title,pillar,scheduled_date,status,created_at").order("created_at",{ascending:false}).limit(150),
   db.from("studio_campaigns").select("id,name,objective,audience,key_messages,start_date,end_date,status").in("status",["planning","active"]).limit(100),
   db.from("studio_brain_entries").select("title,body,category,source_path,source_date").eq("verification","approved").in("category",["Marketing","Product","Audience","Operations"]).limit(60)
  ]);
  if(p.error)throw p.error;if(ps.error)throw ps.error;if(cs.error)throw cs.error;if(brain.error)throw brain.error;
  plan=p.data;posts=ps.data||[];campaignPlans=cs.data||[];approvedKnowledge=brain.data||[];
  const form=document.getElementById("strategyForm");
  for(const key of ["goal","audience","priorities","campaigns","seasonal_notes","confirmed_events","cadence"])form.elements[key].value=plan[key]||"";
  const editable=["admin","approver"].includes(role);
  form.querySelectorAll("textarea").forEach(x=>x.disabled=!editable);
  document.getElementById("saveStrategy").hidden=!editable;
  document.getElementById("planPermission").textContent=editable?"You can edit this plan.":"View only — ask an approver to amend the plan.";
  generateSuggestions();
 }catch(e){document.getElementById("suggestionMessage").textContent=e.message||String(e)}
}
const normal=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,"").split(/\s+/).filter(w=>w.length>3);
function generateSuggestions(){
 const now=new Date();const month=now.getMonth();const season=seasonSets.find(s=>s.months.includes(month));
 const candidates=[...season.items,...evergreen];
 // Approved Brain knowledge contributes editorial subjects, not unverified claims.
 for(const k of approvedKnowledge.slice(0,12)){
  const pillar=k.category==="Product"?"Product Education":k.category==="Audience"?"Installer Advice":k.category==="Operations"?"Project Planning":"FAQs & Myth Busting";
  candidates.push([
   "From Vuba Brain: "+String(k.title).slice(0,90),pillar,"",
   "Approved Brain entry, source: "+(k.source_path||"team knowledge")+(k.source_date?" · "+k.source_date:"")+". Recheck current details and authorised imagery before publishing.",
   "Text-led",null
  ]);
 }
 // Actual planned or active campaigns contribute topics to the editorial queue.
 for(const c of campaignPlans){
  const focus=String(c.key_messages||c.objective||c.name).split(/[\n;]+/).map(x=>x.trim()).filter(Boolean).slice(0,3);
  for(const angle of focus){
   candidates.push([
    c.name+": "+angle.slice(0,96),"Project Planning","",
    "Marketing campaign brief: "+c.name+". Objective: "+(c.objective||"Not entered")+". Audience: "+(c.audience||"Not entered")+". Do not assert campaign claims without evidence.",
    "Text-led",c.id
   ]);
  }
 }
 // Campaign and seasonal focus become ideas to research, never factual captions.
 const focus=[plan.campaigns,plan.seasonal_notes,plan.priorities].filter(Boolean);
 for(const f of focus){const sections=f.split(/[\n;]+/).map(t=>t.trim()).filter(t=>t.length>=8).slice(0,5);
 for(const item of sections) candidates.push(["Planning brief: "+item.slice(0,85),"Project Planning","","Use this plan priority as a topic. Verify specifics with the team before writing claims.","Text-led"]);}
 const recent=posts.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,20);
 const counts={};Object.keys(targets).forEach(k=>counts[k]=0);
 for(const p of recent){const cat=pillars[p.pillar];if(cat)counts[cat]++;}
 const titles=posts.map(p=>normal(p.title).join(" "));
 const ranked=candidates.map((v,i)=>{
  const cat=pillars[v[1]],difference=targets[cat]*(recent.length+1)-(counts[cat]||0);
  const words=normal(v[0]);const repeated=titles.some(t=>words.filter(w=>t.includes(w)).length>=Math.min(3,words.length));
  const planHit=normal(plan.priorities+" "+plan.campaigns+" "+plan.seasonal_notes).filter(w=>words.includes(w)).length;
  return {v,score:difference*3+Math.min(planHit,4)- (repeated?12:0)+(season.items.includes(v)?2:0)+(v[5]?4:0)-i*.005,repeated};
 }).sort((a,b)=>b.score-a.score).filter(x=>!x.repeated);
 suggestions=ranked.slice(0,8);
 document.getElementById("seasonIntro").textContent=season.label+" planning · "+now.toLocaleDateString("en-GB",{month:"long",year:"numeric"})+" · prioritising gaps in the last 20 posts";
 document.getElementById("suggestionCards").innerHTML=suggestions.map(({v},i)=>`<article class="suggestion-card"><span class="suggestion-pill">${safe(v[1])} · ${safe(pillars[v[1]])}</span><h3>${safe(v[0])}</h3><p>${safe(v[3])}</p><div class="suggestion-foot"><small>${safe(v[2]||"Standalone")} · ${safe(v[4])}</small><button data-preview="${i}" type="button">Preview post</button></div></article>`).join("");
 if(!suggestions.length)document.getElementById("suggestionCards").textContent="Your recent posts cover these topics. Update the marketing plan to develop more angles.";
}
async function savePlan(e){
 e.preventDefault();if(!["admin","approver"].includes(role))return;
 const form=e.currentTarget;const payload={updated_by:user.id};
 for(const k of ["goal","audience","priorities","campaigns","seasonal_notes","confirmed_events","cadence"])payload[k]=form.elements[k].value.trim().slice(0,5000);
 const {error}=await db.from("studio_marketing_plan").update(payload).eq("id",1);
 document.getElementById("strategyMessage").textContent=error?error.message:"Shared marketing plan saved.";
 if(!error)await loadAll();
}

function openPreview(index){
 const item=suggestions[index]?.v;if(!item)return;
 previewIndex=index;previewDraft=null;
 const [title,pillar,series,notes,format]=item;
 document.getElementById("previewHeading").textContent=title;
 document.getElementById("previewMeta").textContent=[pillar,series||"Standalone",format,item[5]?"Linked to a marketing campaign":null].filter(Boolean).join(" · ");
 document.getElementById("previewAngle").textContent="The post should give a useful, trade-focused angle on: "+title+".";
 document.getElementById("previewTitle").textContent=title;
 document.getElementById("previewVisual").textContent=format==="Carousel"?"A small sequence of clear, genuine photos or approved educational graphics.":format==="Text-led"?"Text-focused content with a clear practical takeaway.":"Use genuine, relevant Vuba photography or an approved branded graphic — no fabricated products or packaging.";
 document.getElementById("previewChecks").textContent=notes;
 document.getElementById("previewCaption").value="";
 document.querySelector("#ideaPreview .social-mock").className="social-mock platform-instagram";
 updateIdeaMock();
 document.getElementById("previewError").textContent="";
 document.getElementById("previewAI").disabled=false;
 document.getElementById("previewAI").textContent=cfg.aiEnabled===false?"Create offline starter":"Generate AI draft";
 document.getElementById("previewAdd").disabled=false;
 document.getElementById("previewAdd").textContent="Add to calendar";
 document.getElementById("ideaPreview").showModal();
}
async function generatePreviewDraft(){
 const item=suggestions[previewIndex]?.v;if(!item)return;
 if(cfg.aiEnabled===false){
  const starter=window.VubaOfflineDraft?.({topic:item[0],pillar:item[1]});
  if(!starter)return;
  previewDraft={topic:item[0],title:item[0].slice(0,140),caption:starter.caption,pillar:item[1],source_notes:item[3]+"\\n"+starter.source_notes};
  document.getElementById("previewCaption").value=starter.caption;
  document.getElementById("previewChecks").textContent=previewDraft.source_notes;
  document.getElementById("previewAI").textContent="Refresh offline starter";
  document.getElementById("previewError").textContent="Offline template, not live AI. Please tailor the caption to this specific idea.";
  updateIdeaMock();return;
 }
 const [title,pillar,,notes,format]=item;
 const button=document.getElementById("previewAI");
 button.disabled=true;button.textContent="Generating…";
 document.getElementById("previewError").textContent="";
 try{
  const {data,error}=await db.functions.invoke(cfg.aiFunction||"draft-post",{body:{
   topic:title, title:"",pillar,source:"Editorial brief only (not verified facts): "+notes,
   channel:format==="Text-led"?"LinkedIn":"Instagram",format
  }});
  if(error){
   let message=error.message||"AI generation failed";
   try{const detail=await error.context?.json();message=detail?.error||message;}catch(_){}
   throw Error(message);
  }
  if(!data?.caption)throw Error("The AI returned no caption.");
  previewDraft={
   topic:String(data.topic||title).slice(0,300),title:String(data.title||title).slice(0,140),
   caption:String(data.caption).slice(0,1400),pillar:Object.prototype.hasOwnProperty.call(pillars,data.pillar)?data.pillar:pillar,
   source_notes:String(data.source_notes||notes).slice(0,3000)
  };
  document.getElementById("previewTitle").textContent=previewDraft.title;
  document.getElementById("previewCaption").value=previewDraft.caption;
 updateIdeaMock();
  document.getElementById("previewChecks").textContent=previewDraft.source_notes;
  button.textContent="Regenerate AI draft";
 }catch(e){
  document.getElementById("previewError").textContent=e.message||String(e);
  button.textContent="Try AI draft again";
 }finally{button.disabled=false;}
}
function updateIdeaMock(){
 document.getElementById("ideaMockTitle").textContent=document.getElementById("previewTitle").textContent;
 document.getElementById("ideaMockCaption").textContent=document.getElementById("previewCaption").value.trim()||"Caption will appear here when drafted.";
}
async function addPreviewToCalendar(){
 const v=suggestions[previewIndex]?.v;if(!v||!user)return;
 const d=new Date();d.setDate(d.getDate()+7);
 const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 const button=document.getElementById("previewAdd");
 button.disabled=true;document.getElementById("previewError").textContent="";
 const editedCaption=document.getElementById("previewCaption").value.trim();
 const payload={
  topic:previewDraft?.topic||v[0],title:(previewDraft?.title||v[0]).slice(0,140),
  pillar:previewDraft?.pillar||v[1],series:v[2]||null,campaign_id:v[5]||null,
  format:["Carousel","Text-led","Reel","Story","Branded graphic"].includes(v[4])?v[4]:"Single image",
  channel:v[4]==="Text-led"?"LinkedIn":"Instagram",
  status:editedCaption?"draft":"idea",scheduled_date:date,
  caption:editedCaption,
  source_notes:previewDraft?.source_notes||("IDEA ONLY — "+v[3]+"\nMarketing aim: "+(plan?.goal||"").slice(0,220)),
  created_by:user.id,updated_by:user.id
 };
 const {error}=await db.from("studio_posts").insert(payload);
 if(error){button.disabled=false;document.getElementById("previewError").textContent=error.message;return;}
 document.getElementById("ideaPreview").close();
 document.getElementById("suggestionMessage").textContent=(editedCaption?"Draft":"Idea")+" added for "+new Date(date+"T12:00:00").toLocaleDateString("en-GB")+".";
 await loadAll();
}
const {data:{session}}=await db.auth.getSession();await init(session?.user||null);
db.auth.onAuthStateChange((_,session)=>{setTimeout(()=>init(session?.user||null),0)});

document.addEventListener("vuba-brain-updated",()=>{if(user&&document.getElementById("strategyArea"))loadAll()});
