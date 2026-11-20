import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.VUBA_CONFIG;
const db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pages=[
 ["home","Overview","layout-dashboard"],["calendar","Calendar","calendar-days"],["builder","Post builder","square-pen"],
 ["ideas","Post ideas","lightbulb"],["plan","Marketing plan","target"],["campaigns","Campaigns","megaphone"],
 ["media","Media library","images"],["reviews","Approvals","check-check"],["brain","Vuba Brain","book-open"]
];
const allowed=new Set(pages.map(x=>x[0]));
const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
let currentUser=null,role=null,posts=[],membersReady=false,inFlight=false;
let activeRoute="";
function buildShell(){
 if($("studioShell"))return;
 const root=$("app");
 const shell=document.createElement("div");shell.id="studioShell";
 shell.innerHTML=`
 <nav class="studio-navigation" aria-label="Studio pages"><div class="studio-brand"><span class="studio-brand-mark">V</span><strong>Social Studio</strong><small>Vuba Wiltshire</small></div>
  <div class="studio-nav-links">${pages.map(([id,name])=>'<a href="#'+id+'" data-route-link="'+id+'">'+esc(name)+'</a>').join("")}</div>
 </nav>
 <section id="studioHome" class="studio-page" aria-label="Overview">
  <div class="studio-hero"><div><span class="studio-kicker">WORKSPACE OVERVIEW</span><h1>Welcome to Vuba Social Studio.</h1><p>Your marketing at a glance. Create, review and approve from one place.</p></div><button type="button" id="homeCreatePost">+ New post</button></div>
  <div class="studio-stat-grid">
   <button type="button" data-dash-route="calendar" class="studio-stat"><span id="dashUpcoming">–</span><small>Next 28 days</small></button>
   <button type="button" data-dash-route="reviews" class="studio-stat"><span id="dashReview">–</span><small>Awaiting approval</small></button>
   <button type="button" data-dash-route="media" class="studio-stat"><span id="dashImages">–</span><small>Posts needing an image</small></button>
   <button type="button" data-dash-route="calendar" class="studio-stat"><span id="dashGaps">–</span><small>Open publishing slots</small></button>
  </div>
  <div class="studio-home-grid"><section class="panel studio-home-main"><div class="studio-section-heading"><div><h2>Coming up</h2><p>Drafts and posts awaiting attention</p></div><button type="button" class="studio-text-btn" data-dash-route="calendar">Open calendar</button></div><div id="dashList"><p class="hint">Loading posts…</p></div></section>
  <section class="panel studio-automation-panel"><span class="studio-kicker">NO-CREDIT AUTOMATION</span><h2>Keep the calendar moving</h2>
   <p>Fill the next four weeks with trade-first editorial drafts. Existing posts stay untouched; new images are matched only from approved photographs.</p>
   <div class="studio-automation-stats"><div><strong>4 weeks</strong><span>Rolling plan</span></div><div><strong>4 slots</strong><span>Per week</span></div></div>
   <button id="fillCalendar" type="button">Fill calendar gaps</button><p id="fillCalendarMessage" class="hint" role="status"></p>
   <p class="studio-safe-note">Creates drafts only. No AI credits, automatic publishing or unverified stock claims.</p>
  </section></div>
  <div class="studio-footnote"><span class="studio-footnote-dot"></span> Posts require approval before publishing. Automated social-network publishing is not connected yet.</div>
 </section>
 <section id="studioBuilder" class="studio-page" aria-label="Post builder">
   <div class="studio-page-intro"><span class="studio-kicker">CREATE CONTENT</span><h1>Post builder</h1><p>Start with a topic, let the no-credit editor prepare a draft, and match an approved image automatically.</p></div>
   <div class="studio-builder-actions">
    <article class="panel studio-builder-card"><div class="studio-builder-icon">✦</div><h2>Create a suggested post</h2><p>Get a ready-to-edit caption and look for a relevant approved library image.</p><button id="builderSuggest" type="button">Create suggested draft</button></article>
    <article class="panel studio-builder-card"><div class="studio-builder-icon">+</div><h2>Start from your own idea</h2><p>Choose the channel, write the caption and select or generate an image brief where required.</p><button id="builderBlank" type="button">Create blank post</button></article>
   </div>
   <p class="hint">Image creation within the website still requires a generation service. You can match approved photos without API credits.</p>
 </section>`;
 root.prepend(shell);
 $("homeCreatePost").onclick=()=>navigate("builder");
 $("builderSuggest").onclick=()=>{$("autoSuggest")?.click();};
 $("builderBlank").onclick=()=>{$("new")?.click();};
 shell.querySelectorAll("[data-dash-route]").forEach(b=>b.onclick=()=>navigate(b.dataset.dashRoute));
 $("fillCalendar").onclick=fillCalendar;
 window.addEventListener("hashchange",route);
 const watch=new MutationObserver(()=>applyVisibility());
 watch.observe(root,{childList:true});
 document.body.classList.add("studio-shell-ready");
 route();
}
function navigate(name){location.hash=name;route();}
function currentRoute(){
 const token=location.hash.replace(/^#/,"").split("?")[0];
 return allowed.has(token)?token:"home";
}
function route(){
 if(!$("studioShell"))return;
 const name=currentRoute();activeRoute=name;
 $("studioShell").querySelectorAll("[data-route-link]").forEach(a=>{
  const on=a.dataset.routeLink===name;
  a.classList.toggle("is-active",on);
  if(on)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");
 });
 applyVisibility();
 if(name==="home")refreshDashboard();
 if(name==="campaigns"||name==="media"||name==="reviews")window.VubaStudioPlus?.refresh?.();
}
function show(el,visible){if(el)el.hidden=!visible;}
function applyVisibility(){
 if(!$("studioShell"))return;
 const p=activeRoute||currentRoute();
 show($("studioHome"),p==="home");show($("studioBuilder"),p==="builder");
 for(const x of document.querySelectorAll("#app > .top,#app > .metrics,#app > .layout"))show(x,p==="calendar");
 // The current calendar markup is wrapped in #calendarPage on new installs.
 show($("calendarPage"),p==="calendar");
 const area=$("workspacePlus");
 show(area,["campaigns","media","reviews"].includes(p));
 const map={campaigns:"campaigns",media:"assets",reviews:"reviews"};
 if(area){
  const tab=area.querySelector('[data-section="'+(map[p]||"campaigns")+'"]');
  if(["campaigns","media","reviews"].includes(p)&&tab&&!tab.classList.contains("active"))tab.click();
 }
 const strategy=$("strategyArea");
 show(strategy,["ideas","plan"].includes(p));
 if(strategy){
  const tabId=p==="plan"?"tabPlan":"tabSuggestions";
  if((p==="ideas"||p==="plan")&&$(tabId)&&!$(tabId).classList.contains("active"))$(tabId).click();
 }
 show($("vubaBrain"),p==="brain");
 show($("brainJump"),false);
}
function slotDates(){
 const start=new Date();start.setHours(12,0,0,0);
 const day=(start.getDay()+6)%7;
 const monday=new Date(start);monday.setDate(start.getDate()-day);
 // 4 posts weekly: IG Monday & Friday; LinkedIn Tuesday; Facebook Wednesday.
 const slots=[{day:0,channel:"Instagram"},{day:1,channel:"LinkedIn"},{day:2,channel:"Facebook"},{day:4,channel:"Instagram"}];
 const out=[];
 for(let week=0;week<4;week++)for(const s of slots){
  const date=new Date(monday);date.setDate(monday.getDate()+week*7+s.day);
  if(date>=start)out.push({date:dateKey(date),channel:s.channel,week});
 }
 return out;
}
async function refreshDashboard(){
 if(!currentUser||!$("studioHome"))return;
 const [postResult,mediaResult]=await Promise.all([
  db.from("studio_posts").select("id,title,channel,status,scheduled_date,media_id,caption,pillar").order("scheduled_date",{ascending:true}).limit(500),
  db.from("studio_media").select("id,approved").eq("approved",true)
 ]);
 if(postResult.error){$("dashList").textContent=postResult.error.message;return;}
 posts=postResult.data||[];
 const today=dateKey(new Date());
 const limit=new Date();limit.setDate(limit.getDate()+28);const final=dateKey(limit);
 const upcoming=posts.filter(x=>x.scheduled_date>=today&&x.scheduled_date<final);
 const pending=posts.filter(x=>x.status==="review");
 const slots=slotDates();
 const gaps=slots.filter(s=>!posts.some(p=>p.scheduled_date===s.date&&p.channel===s.channel)).length;
 const noImage=upcoming.filter(x=>!x.media_id).length;
 $("dashUpcoming").textContent=upcoming.length;
 $("dashReview").textContent=pending.length;
 $("dashImages").textContent=noImage;
 $("dashGaps").textContent=gaps;
 const shortlisted=upcoming.slice(0,7);
 $("dashList").innerHTML=shortlisted.map(p=>`<div class="studio-upcoming-row"><div class="studio-post-date">${new Date(p.scheduled_date+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div><div class="studio-post-copy"><strong>${esc(p.title)}</strong><small>${esc(p.channel)} · ${esc(p.status.replaceAll("_"," "))}${!p.media_id?" · Image needed":""}</small></div><button type="button" data-dash-edit="${esc(p.id)}">Edit</button></div>`).join("")||"<p class='hint'>No upcoming posts yet. Fill calendar gaps to get started.</p>";
 $("dashList").querySelectorAll("[data-dash-edit]").forEach(b=>b.onclick=()=>{
  navigate("calendar");
  window.VubaOpenPost?.(b.dataset.dashEdit);
 });
 if(mediaResult.error)$("fillCalendarMessage").textContent="Media library unavailable: "+mediaResult.error.message;
}
async function fillCalendar(){
 if(!currentUser||inFlight)return;
 inFlight=true;const button=$("fillCalendar"),message=$("fillCalendarMessage");
 button.disabled=true;button.textContent="Preparing drafts…";message.textContent="";
 try{
  const query=await db.from("studio_posts").select("id,title,channel,scheduled_date,status").gte("scheduled_date",dateKey(new Date())).limit(500);
  if(query.error)throw Error(query.error.message);
  const existing=query.data||[];
  const scheduled=slotDates().filter(s=>!existing.some(p=>p.scheduled_date===s.date&&p.channel===s.channel));
  if(!scheduled.length){message.textContent="Calendar already has a post in every planned slot. Nothing changed.";return;}
  const titles=existing.map(x=>x.title);
  const plan=[];
  await window.VubaMediaAssist?.refresh?.();
  const pillars=["Installer Advice","Project Planning","Blends & Colour Inspiration","FAQs & Myth Busting","Behind the Scenes / Depot","Product Education"];
  for(const s of scheduled){
   const starter=window.VubaOfflineDraft?.({existingTitles:titles,pillar:pillars[(s.week*4+plan.length)%pillars.length]});
   if(!starter)throw Error("Offline content templates unavailable. Refresh the Studio.");
   titles.push(starter.title);
   const match=window.VubaMediaAssist?.bestForText?.([starter.title,starter.topic,starter.pillar].join(" "));
   plan.push({
    title:starter.title,topic:starter.topic,pillar:starter.pillar,
    format:starter.format||"Single image",series:starter.series||null,
    caption:starter.caption,source_notes:starter.source_notes+
     "\nAUTO-PLANNED: Draft requires staff review. Publish slot is proposed, not an automatic publication.",
    status:"draft",scheduled_date:s.date,channel:s.channel,
    media_id:match?.id||null,created_by:currentUser.id,updated_by:currentUser.id
   });
  }
  const {error}=await db.from("studio_posts").insert(plan);
  if(error)throw Error(error.message);
  message.textContent="Created "+plan.length+" draft(s), preserving existing posts. Photos were added only where matching approved library images were available. Review before approving.";
  await window.VubaCalendarReload?.();
  await window.VubaStudioPlus?.refresh?.();
  await refreshDashboard();
 }catch(e){message.textContent="Couldn't fill calendar: "+(e?.message||String(e));}
 finally{inFlight=false;button.disabled=false;button.textContent="Fill calendar gaps";}
}
async function auth(u){
 currentUser=u;
 if(!u){$("studioShell")?.remove();document.body.classList.remove("studio-shell-ready");return;}
 const {data,error}=await db.from("studio_members").select("role").eq("user_id",u.id).maybeSingle();
 if(error||!data)return;role=data.role;membersReady=true;
 buildShell();
 route();
}
const {data:{session}}=await db.auth.getSession();
await auth(session?.user||null);
db.auth.onAuthStateChange((_,session)=>setTimeout(()=>auth(session?.user||null),0));
