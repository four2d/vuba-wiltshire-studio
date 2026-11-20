import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.VUBA_CONFIG;
const db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pages=[
 ["home","Overview","layout-dashboard"],["calendar","Calendar","calendar-days"],["builder","Post builder","square-pen"],
 ["ideas","Post ideas","lightbulb"],["plan","Marketing plan","target"],["campaigns","Campaigns","megaphone"],
 ["media","Media library","images"],["reviews","Approvals","check-check"],["brain","FOXON Brain","book-open"]
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
 <aside class="studio-navigation" aria-label="Studio navigation">
  <div class="brand-lockup">
   <img src="foxon-logo-horizontal-dark.svg" alt="FOXON SOFTWARE" width="216" height="64">
   <small class="foxon-product-label">SOCIAL STUDIO</small>
  </div>
  <div class="studio-workspace-label"><span class="workspace-live-dot"></span> WORKSPACE <span class="workspace-chevron">⌄</span></div>
  <div class="studio-nav-scroll">
   <span class="studio-nav-heading">WORKSPACE</span>
   <div class="studio-nav-links">
    ${pages.filter(x=>["home","calendar","builder","ideas","reviews"].includes(x[0])).map(([id,name])=>'<a href="#'+id+'" data-route-link="'+id+'"><span class="nav-glyph" data-glyph="'+id+'"></span><span>'+esc(name)+'</span><span class="nav-active-mark"></span></a>').join("")}
   </div>
   <span class="studio-nav-heading secondary-heading">MANAGE</span>
   <div class="studio-nav-links studio-secondary-links">
    ${pages.filter(x=>["plan","campaigns","media","brain"].includes(x[0])).map(([id,name])=>'<a href="#'+id+'" data-route-link="'+id+'"><span class="nav-glyph" data-glyph="'+id+'"></span><span>'+esc(name)+'</span><span class="nav-active-mark"></span></a>').join("")}
   </div>
  </div>
  <div class="sidebar-bottom">
   <div class="sidebar-brand-chip"><span>F</span><div><strong>FOXON Software</strong><small>Team workspace</small></div></div>
   <button type="button" id="sidebarSignout" class="sidebar-signout">Sign out <span>↗</span></button>
  </div>
 </aside>
 <div class="studio-topbar"><button type="button" id="studioMobileMenu" class="mobile-menu-btn" aria-label="Open navigation" aria-expanded="false">☰</button><span id="studioBreadcrumb">Overview</span><div class="topbar-right"><span class="studio-live-pill"><i></i> No-credit mode</span><button type="button" id="topbarNewPost" class="topbar-create"><span>＋</span> Create post</button></div></div>
 <button type="button" id="studioNavShade" class="studio-nav-shade" aria-label="Close navigation" hidden></button>
 <section id="studioHome" class="studio-page" aria-label="Overview">
  <div class="studio-page-heading"><div><span class="studio-kicker">FOXON SOCIAL CONTROL</span><h1>BUILT FOR THE TRADE.</h1><p>Real products. Strong stories. FOXON through and through.</p></div><div class="heading-date" id="overviewDate"></div></div>
  <div class="studio-hero">
   <div class="hero-grid-overlay" aria-hidden="true"></div>
   <div class="hero-copy"><span class="hero-eyebrow"><span></span> TOOLS THAT GRAFT</span><h2>YOUR BRAND.<br><em>READY FOR THE JOB.</em></h2><p>Plan hard-working social posts for FOXON Invoice, CIS, Miles and Gas. Use real app screens, sharp headlines and the proper FOXON look.</p>
   <div class="hero-actions"><button type="button" id="heroFillCalendar">PLAN THE NEXT 4 WEEKS</button><button type="button" id="heroExploreIdeas" class="hero-secondary">Explore ideas <span>↗</span></button></div></div>
   <div class="hero-graphic" aria-hidden="true"><div class="graphic-ring graphic-ring-one"></div><div class="graphic-ring graphic-ring-two"></div><div class="graphic-card graphic-card-back"><div class="graphic-mini-badge">DRAFT</div><div class="graphic-card-line"></div><div class="graphic-card-line short"></div></div><div class="graphic-card graphic-card-front"><div class="graphic-image-art"><span class="graphic-sun"></span><span class="graphic-road road-one"></span><span class="graphic-road road-two"></span></div><div class="graphic-card-bottom"><span class="graphic-mini-dot"></span><span>FOXON SOFTWARE</span><span>✦</span></div></div></div>
  </div>
  <div class="studio-stat-grid">
   <button type="button" data-dash-route="calendar" class="studio-stat"><span class="stat-top"><small>PLANNED CONTENT</small><span class="stat-mark">↗</span></span><span class="stat-number" id="dashUpcoming">–</span><span class="stat-foot">Posts in the next 28 days</span></button>
   <button type="button" data-dash-route="reviews" class="studio-stat"><span class="stat-top"><small>NEEDS APPROVAL</small><span class="stat-mark amber">◷</span></span><span class="stat-number" id="dashReview">–</span><span class="stat-foot">Waiting for your review</span></button>
   <button type="button" data-dash-route="media" class="studio-stat"><span class="stat-top"><small>IMAGES NEEDED</small><span class="stat-mark rose">▧</span></span><span class="stat-number" id="dashImages">–</span><span class="stat-foot">Posts awaiting a visual</span></button>
   <button type="button" data-dash-route="calendar" class="studio-stat"><span class="stat-top"><small>CONTENT OPPORTUNITIES</small><span class="stat-mark blue">＋</span></span><span class="stat-number" id="dashGaps">–</span><span class="stat-foot">Open slots to fill</span></button>
  </div>
  <div class="studio-home-grid">
   <section class="panel studio-home-main"><div class="studio-section-heading"><div><span class="section-eyebrow">EDITORIAL PIPELINE</span><h2>On the horizon</h2><p>Upcoming stories, ready to take shape.</p></div><button type="button" class="studio-text-btn" data-dash-route="calendar">Full calendar <span>↗</span></button></div><div id="dashList"><p class="hint">Loading your editorial queue…</p></div></section>
   <div class="home-side-stack"><section class="panel studio-automation-panel"><div class="automation-icon">✦</div><span class="studio-kicker">YOUR EDITORIAL TOOLKIT</span><h2>KEEP IT MOVING.</h2><p>Fill gaps with seasonal, trade-first draft ideas. Match approved photography automatically where available.</p>
   <div class="automation-progress"><div class="progress-label"><span>4-week editorial plan</span><strong id="planProgress">0%</strong></div><div class="progress-track"><span id="planProgressBar"></span></div><small>Based on your planned publishing slots</small></div>
   <button id="fillCalendar" type="button">Fill calendar gaps <span>→</span></button><p id="fillCalendarMessage" class="hint" role="status"></p><div class="automation-disclaimer">✳ &nbsp; Drafts only. Approval always stays with your team.</div>
   </section>
   <section class="studio-tip-card"><span class="tip-spark">✧</span><div><strong>SHOW THE TOOL.</strong><p>Use official FOXON screens, brand graphics and approved product imagery. Keep the details true to the apps.</p><button type="button" data-dash-route="media">Open media library <span>↗</span></button></div></section>
   </div>
  </div>
  <div class="studio-footnote"><span class="studio-footnote-dot"></span> Your team stays in control. Nothing publishes until it has been approved and connected to a publishing channel.</div>
 </section>
 <section id="studioBuilder" class="studio-page" aria-label="Post builder">
   <div class="studio-page-heading"><div><span class="studio-kicker">FOXON POST BUILDER</span><h1>MAKE IT COUNT.</h1><p>Sharp copy. Genuine FOXON screens. No nonsense.</p></div></div>
   <div class="studio-builder-actions">
    <article class="panel studio-builder-card featured"><div class="studio-builder-icon">✦</div><div class="builder-card-index">01 / SMART START</div><h2>Let the Studio lead.</h2><p>We'll suggest a relevant topic, prepare your first draft and search approved FOXON imagery automatically.</p><div class="builder-visual"><span class="builder-visual-chip">✦ &nbsp; CONTENT ASSISTANT</span><div class="builder-visual-lines"><span></span><span></span><span></span></div><span class="builder-visual-photo">▧ &nbsp; Library image matched</span></div><button id="builderSuggest" type="button">Create a suggested draft <span>→</span></button></article>
    <article class="panel studio-builder-card"><div class="studio-builder-icon secondary">＋</div><div class="builder-card-index">02 / YOUR DIRECTION</div><h2>Start with your idea.</h2><p>Got something specific to say? Set the topic, choose your channel and make it your own.</p><div class="builder-visual simple"><span class="builder-blank-label">YOUR NEXT POST</span><div class="builder-visual-lines"><span></span><span></span><span></span></div><span class="builder-corner-accent"></span></div><button id="builderBlank" type="button">Create a blank post <span>→</span></button></article>
   </div><div class="builder-note"><span>ⓘ</span> Automatic text and image matching work without API credits. New AI-generated images will require a connected generation service.</div>
 </section>`;

 root.prepend(shell);
 $("heroFillCalendar").onclick=fillCalendar;
 $("heroExploreIdeas").onclick=()=>navigate("ideas");
 $("sidebarSignout").onclick=()=>document.getElementById("logout")?.click();
 $("topbarNewPost").onclick=()=>document.getElementById("new")?.click();
 $("studioMobileMenu").onclick=()=>toggleMobileMenu();
 $("studioNavShade").onclick=()=>toggleMobileMenu(false);
 $("overviewDate").textContent=new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 installNavGlyphs();
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
function toggleMobileMenu(force){
 const open=typeof force==="boolean"?force:!document.body.classList.contains("studio-nav-open");
 document.body.classList.toggle("studio-nav-open",open);
 $("studioMobileMenu")?.setAttribute("aria-expanded",String(open));
 $("studioNavShade").hidden=!open;
}
function installNavGlyphs(){
 const icons={
  home:"M3 11.5 12 4l9 7.5V21H3z M9 21v-7h6v7",
  calendar:"M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18",
  builder:"M4 20h16 M5 15l10-10 4 4-10 10H5z",
  ideas:"M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 13c1 1 1 2 1 3h6c0-1 0-2 1-3a7 7 0 0 0-4-13z",
  reviews:"M4 12l5 5L20 6 M3 3h18v18H3z",
  plan:"M12 3v18 M3 12h18 M6 6l12 12 M18 6L6 18",
  campaigns:"M3 11l11-5v12L3 13z M14 8l5-3v14l-5-3 M6 14v6",
  media:"M3 4h18v16H3z M3 16l6-6 5 5 3-3 4 4 M16 9h.01",
  brain:"M12 5C9 3 6 4 3 5v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-2-9 0z M12 5v16"
 };
 document.querySelectorAll("#studioShell [data-glyph]").forEach(el=>{
  const path=icons[el.dataset.glyph]||icons.home;
  el.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg>';
 });
}
function navigate(name){location.hash=name;route();}
function currentRoute(){
 const token=location.hash.replace(/^#/,"").split("?")[0];
 return allowed.has(token)?token:"home";
}
function route(){
 if(!$("studioShell"))return;
 const name=currentRoute();activeRoute=name;
 const label=pages.find(p=>p[0]===name)?.[1]||"Overview";
 $("studioBreadcrumb").textContent=label;
 document.title=label+" · FOXON Social Studio";
 if(document.body.classList.contains("studio-nav-open"))toggleMobileMenu(false);
 $("studioShell").querySelectorAll("[data-route-link]").forEach(a=>{
  const on=a.dataset.routeLink===name;
  a.classList.toggle("is-active",on);
  if(on)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");
 });
 applyVisibility();
 if(name==="home")refreshDashboard();
 window.scrollTo?.({top:0,behavior:"instant"});
 if(name==="campaigns"||name==="media"||name==="reviews")window.FOXONStudioPlus?.refresh?.();
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
 updateSectionHeading(p);
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
function updateSectionHeading(page){
 const configs={
  campaigns:["CAMPAIGN PLANNING","Shape the story.","Create and manage connected campaigns, audiences and outcomes."],
  media:["YOUR CREATIVE ASSETS","Make it visual.","Import authentic FOXON product photography, approve assets and build a usable visual library."],
  reviews:["EDITORIAL APPROVALS","Ready for your review.","See what needs a decision, request changes and keep a clear approval history."],
  ideas:["EDITORIAL INSPIRATION","Fresh perspectives.","Trade-first content ideas informed by season, strategy and your approved knowledge."],
  plan:["THE BIGGER PICTURE","Plan with purpose.","Keep your shared marketing priorities and objectives in one place."]
 };
 const settings=configs[page];
 if(!settings)return;
 const target=(["campaigns","media","reviews"].includes(page)?$("workspacePlus"):$("strategyArea"));
 if(!target)return;
 let heading=target.querySelector(":scope > .studio-interior-heading");
 if(!heading){
  heading=document.createElement("header");heading.className="studio-interior-heading";
  target.insertBefore(heading,target.firstChild);
 }
 heading.innerHTML='<span class="studio-kicker">'+esc(settings[0])+'</span><h1>'+esc(settings[1])+'</h1><p>'+esc(settings[2])+'</p>';
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
 const shortlisted=upcoming.slice(0,6);
 const assetIds=[...new Set(shortlisted.map(p=>p.media_id).filter(Boolean))];
 let urls={};
 if(assetIds.length){
  const assets=await db.from("studio_media").select("id,file_path").in("id",assetIds).eq("approved",true);
  if(!assets.error){
   await Promise.all((assets.data||[]).map(async media=>{
    const link=await db.storage.from("foxon-approved-media").createSignedUrl(media.file_path,3600);
    if(link.data?.signedUrl)urls[media.id]=link.data.signedUrl;
   }));
  }
 }
 const symbols={"Instagram":"◎","Facebook":"f","LinkedIn":"in"};
 $("dashList").innerHTML=shortlisted.length?'<div class="editorial-post-grid foxon-feed-grid">'+shortlisted.map(p=>{
   const image=urls[p.media_id];
   const date=new Date(p.scheduled_date+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
   const status=p.status.replaceAll("_"," ");
   const channel=p.channel||"Instagram";
   const hasText=Boolean((p.caption||"").trim());
   const caption=hasText?esc(p.caption):"Caption not written yet";
   const media=image?'<span class="foxon-feed-image"><img loading="lazy" src="'+esc(image)+'" alt="Attached approved post artwork"></span>':
     '<span class="foxon-feed-missing"><span>NO ARTWORK ATTACHED</span><small>Attach approved media to preview the final visual</small></span>';
   const mediaBlock='<span class="foxon-feed-media">'+media+'</span>';
   const captionBlock='<span class="foxon-feed-caption'+(hasText?"":" is-empty")+'">'+caption+'</span>';
   const body=channel==="Instagram"?mediaBlock+captionBlock:captionBlock+mediaBlock;
   return '<button type="button" class="foxon-feed-card platform-'+esc(channel.toLowerCase())+'" data-dash-edit="'+esc(p.id)+'" aria-label="Edit '+esc(channel)+' post: '+esc(p.title)+'">'+
     '<span class="foxon-feed-header"><img src="foxon-logo-horizontal-dark.svg" alt="FOXON Software"><span class="foxon-feed-profile"><strong>FOXON Software</strong><small>'+esc(channel)+' · '+esc(date)+'</small></span><span class="foxon-feed-channel">'+esc(symbols[channel]||"✦")+'</span></span>'+
     '<span class="foxon-feed-body">'+body+'</span>'+
     '<span class="foxon-feed-actions" aria-hidden="true">♡ &nbsp; ◯ &nbsp; ↗</span>'+
     '<span class="foxon-feed-footer"><strong>'+esc(p.title)+'</strong><span class="foxon-feed-state">'+esc(status)+'</span></span>'+
     '</button>';
 }).join("")+'</div>':"<div class='studio-empty'><span>✦</span><h3>Make room for something good.</h3><p>Your next posts will appear here once you've planned them.</p><button type='button' id='emptyPlan'>Plan content →</button></div>";
 $("dashList").querySelectorAll("[data-dash-edit]").forEach(b=>b.onclick=()=>{navigate("calendar");window.FOXONOpenPost?.(b.dataset.dashEdit)});
 if($("emptyPlan"))$("emptyPlan").onclick=fillCalendar;
 const coverage=slots.length?Math.round((slots.length-gaps)/slots.length*100):100;
 $("planProgress").textContent=coverage+"%";
 $("planProgressBar").style.width=coverage+"%";
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
  await window.FOXONMediaAssist?.refresh?.();
  const pillars=["Product Education","FOXON Invoice","FOXON CIS","FOXON Miles","FOXON Gas","Trade Productivity","Behind the Software","Frequently Asked Questions"];
  for(const s of scheduled){
   const starter=window.FOXONOfflineDraft?.({existingTitles:titles,pillar:pillars[(s.week*4+plan.length)%pillars.length],channel:s.channel});
   if(!starter)throw Error("Offline content templates unavailable. Refresh the Studio.");
   titles.push(starter.title);
   const match=window.FOXONMediaAssist?.bestForText?.([starter.title,starter.topic,starter.pillar].join(" "));
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
  await window.FOXONCalendarReload?.();
  await window.FOXONStudioPlus?.refresh?.();
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
