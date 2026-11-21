/* FOXON Studio upgrade pack: read-only analytics, safe calendar planning,
   editorial QA and export. No simulated publishing or engagement data. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const config=window.VUBA_CONFIG||{};
if(config.supabaseUrl && config.supabaseAnonKey){
 const db=createClient(config.supabaseUrl,config.supabaseAnonKey);
 const byId=id=>document.getElementById(id);
 const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const dateToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
 const plusDays=(days)=>{const d=new Date();d.setDate(d.getDate()+days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
 const fmt=d=>{if(!d)return "Unscheduled";const v=new Date(d+"T12:00:00");return Number.isNaN(v.getTime())?d:v.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});};
 const state={user:null,role:"",posts:[],approvedMedia:new Set(),brain:[],mode:"month",product:"all",dragId:null,busy:false,importedMetrics:[]};
 const allowedRoles=new Set(["admin","approver","editor"]);
 const editorFields=["title","topic","date","postChannel","pillar","format","series","caption","source","postStatus"];
 function sourceName(p){const s=[p.title||"",p.topic||"",p.pillar||""].join(" ").toLowerCase();for(const n of ["invoice","cis","miles","gas"])if(new RegExp("(^|[^a-z])"+n+"([^a-z]|$)").test(s))return "FOXON "+(n==="cis"?"CIS":n[0].toUpperCase()+n.slice(1));return "General";}
 function guardNote(p){const issues=[];if(!String(p.caption||"").trim())issues.push("caption missing");if(p.format!=="Text-led"){if(!p.media_id)issues.push("approved image not selected");else if(!state.approvedMedia.has(p.media_id))issues.push("image not approved");}if(!String(p.source_notes||"").trim())issues.push("source notes missing");return issues;}
 async function init(user){
  state.user=user||null;
  if(!user){document.querySelectorAll(".foxon-upgrade").forEach(n=>n.remove());state.posts=[];state.importedMetrics=[];return;}
  const m=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
  if(m.error||!m.data)return;
  state.role=m.data.role;
  await mountWhenReady();
 }
 async function mountWhenReady(){
  for(let i=0;i<35&&!byId("studioShell");i++)await new Promise(r=>setTimeout(r,100));
  if(!byId("studioShell")||!state.user)return;
  mountDashboard();mountMetricImport();mountCalendar();mountBuilder();
  await refresh();
 }
 async function refresh(){
  if(!state.user||state.busy)return;
  state.busy=true;
  try{
   const [p,m,b]=await Promise.all([
    db.from("studio_posts").select("id,title,topic,caption,source_notes,status,channel,pillar,format,scheduled_date,media_id,created_at,updated_at").order("scheduled_date",{ascending:true}).limit(500),
    db.from("studio_media").select("id").eq("approved",true).is("archived_at",null).limit(1000),
    db.from("studio_brain_entries").select("title,source_label,source_path,source_date").eq("verification","approved").is("archived_at",null).limit(100)
   ]);
   if(p.error)throw p.error;
   state.posts=p.data||[];
   state.approvedMedia=new Set((m.data||[]).map(a=>a.id));
   state.brain=b.error?[]:(b.data||[]);
   renderDashboard(m.error?.message||"",b.error?.message||"");
   renderAgenda();renderBuilder();
  }catch(error){
   const node=byId("foxonUpgradeNotice");
   if(node)node.textContent="Couldn't load the current planning data: "+(error.message||String(error));
  }finally{state.busy=false;}
 }
 function mountDashboard(){
  if(byId("foxonActionCentre"))return;
  const grid=document.querySelector("#studioHome .studio-stat-grid");
  if(!grid)return;
  const panel=document.createElement("section");
  panel.id="foxonActionCentre";panel.className="foxon-upgrade foxon-upgrade-panel";
  panel.setAttribute("aria-label","Today's editorial actions");
  panel.innerHTML='<div class="foxon-upgrade-heading"><div><small>YOUR WORKFLOW</small><h2>What needs attention?</h2><p>Live checks against saved posts and approved media.</p></div><button type="button" id="foxonRefreshInsights">Refresh</button></div><p id="foxonUpgradeNotice" class="foxon-upgrade-note" role="status"></p><div id="foxonActionItems" class="foxon-action-items"></div><div class="foxon-upgrade-heading foxon-analytics-heading"><div><small>WORKFLOW ANALYTICS</small><h2>Content pipeline</h2><p>Counts from FOXON Studio, not social-platform performance.</p></div><button type="button" id="foxonExportQueue">Export approved queue (CSV)</button></div><div id="foxonAnalytics" class="foxon-analytics"></div><p class="foxon-upgrade-fine">Publishing status describes internal preparation only. No post is automatically published or scheduled on a social network.</p>';
  grid.insertAdjacentElement("afterend",panel);
  byId("foxonRefreshInsights").addEventListener("click",refresh);
  byId("foxonExportQueue").addEventListener("click",exportQueue);
 }
 function mountMetricImport(){
  if(byId("foxonMetricImport"))return;
  const parent=byId("foxonActionCentre");if(!parent)return;
  const section=document.createElement("section");section.id="foxonMetricImport";section.className="foxon-metric-import";
  section.innerHTML='<div class="foxon-upgrade-heading"><div><small>PLATFORM RESULTS · MANUAL IMPORT</small><h2>Social performance</h2><p>Bring in a CSV from the social platforms. Data remains in this browser session.</p></div><div class="foxon-metric-actions"><button type="button" id="foxonMetricTemplate">CSV template</button><label class="foxon-metric-upload">Import CSV<input type="file" id="foxonMetricFile" accept=".csv,text/csv"></label></div></div><p id="foxonMetricStatus" role="status" class="foxon-upgrade-fine">No platform metrics connected or imported. Workflow counts above are not impressions or engagement.</p><div id="foxonMetricTotals" aria-live="polite"></div>';
  parent.appendChild(section);
  byId("foxonMetricTemplate").addEventListener("click",()=>{
   const fields="date,channel,post_id,impressions,clicks,reactions,comments,shares\r\n";
   const url=URL.createObjectURL(new Blob([fields],{type:"text/csv;charset=utf-8"}));
   const a=document.createElement("a");a.href=url;a.download="foxon-social-metrics-template.csv";a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  byId("foxonMetricFile").addEventListener("change",async event=>{
   const file=event.target.files?.[0];if(!file)return;
   try{
    if(file.size>2_000_000)throw Error("CSV exceeds the 2 MB limit.");
    const rows=parseCsv(await file.text());
    const names=["date","channel","impressions","clicks","reactions","comments","shares"];
    if(!rows.length)throw Error("CSV has no rows.");
    const headers=rows[0].map(v=>v.trim().toLowerCase());
    for(const name of names)if(!headers.includes(name))throw Error('Required column missing: '+name);
    const col=name=>headers.indexOf(name);
    const data=[];const known=new Set();
    for(const row of rows.slice(1,5002)){
     if(!row.some(x=>String(x).trim()))continue;
     const get=name=>String(row[col(name)]??"").trim();
     const date=get("date"),channel=get("channel"),id=col("post_id")>=0?get("post_id"):"";
     if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+"T12:00:00").getTime()))throw Error("Use YYYY-MM-DD dates.");
     if(!["LinkedIn","Facebook","Instagram"].includes(channel))throw Error("Channel must be LinkedIn, Facebook or Instagram.");
     const item={date,channel,id};
     for(const k of ["impressions","clicks","reactions","comments","shares"]){
      const v=Number(get(k));if(!Number.isSafeInteger(v)||v<0)throw Error(k+" must contain a non-negative whole number.");
      item[k]=v;
     }
     const key=date+"|"+channel+"|"+id;
     if(id&&known.has(key))throw Error("Duplicate post_id for the same channel and date.");
     if(id)known.add(key);data.push(item);
    }
    if(!data.length)throw Error("No valid metric rows found.");
    if(rows.length>5002)throw Error("File exceeds 5,000 metric rows.");
    state.importedMetrics=data;renderImportedMetrics();document.dispatchEvent(new Event("foxon:studio-refresh"));
    byId("foxonMetricStatus").textContent=data.length+" user-supplied metric row(s) imported from "+file.name+". Figures are not independently verified or synced to FOXON Studio.";
   }catch(error){byId("foxonMetricStatus").textContent="Import not completed: "+(error.message||String(error));}
   finally{event.target.value="";}
  });
 }
 function parseCsv(raw){
  const text=String(raw).replace(/^\uFEFF/,"");
  const rows=[];let row=[],value="",quoted=false;
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(c==='"'&&quoted&&text[i+1]==='"'){value+='"';i++;continue;}
   if(c==='"'){quoted=!quoted;continue;}
   if(c===","&&!quoted){row.push(value);value="";continue;}
   if((c==="\n"||c==="\r")&&!quoted){
    if(c==="\r"&&text[i+1]==="\n")i++;
    row.push(value);rows.push(row);row=[];value="";continue;
   }
   value+=c;
  }
  if(quoted)throw Error("CSV contains an unclosed quoted value.");
  if(value||row.length){row.push(value);rows.push(row);}
  return rows;
 }
 function renderImportedMetrics(){
  const host=byId("foxonMetricTotals");if(!host)return;
  const arr=state.importedMetrics;if(!arr.length){host.textContent="";return;}
  const total=k=>arr.reduce((sum,x)=>sum+x[k],0);
  const impress=total("impressions"),clicks=total("clicks"),engagements=total("reactions")+total("comments")+total("shares");
  const pct=(num,den)=>den?(100*num/den).toFixed(2)+"%":"—";
  host.innerHTML='<div class="foxon-metric-stats"><div><small>Impressions</small><strong>'+impress.toLocaleString("en-GB")+'</strong></div><div><small>Clicks</small><strong>'+clicks.toLocaleString("en-GB")+'</strong></div><div><small>Engagements</small><strong>'+engagements.toLocaleString("en-GB")+'</strong></div><div><small>Click rate</small><strong>'+pct(clicks,impress)+'</strong></div></div><div class="foxon-channel-row">'+["LinkedIn","Facebook","Instagram"].map(c=>'<span>'+esc(c)+': <strong>'+arr.filter(x=>x.channel===c).reduce((sum,x)=>sum+x.impressions,0).toLocaleString("en-GB")+' impressions</strong></span>').join("")+'</div><p class="foxon-upgrade-fine">Imported session data only. Engagements = reactions + comments + shares. Click rate = clicks ÷ impressions. These figures have not been reconciled with platform accounts.</p>';
 }
 function renderDashboard(mediaWarning,brainWarning){
  const root=byId("foxonActionCentre");if(!root)return;
  const today=dateToday(),end=plusDays(28);
  const upcoming=state.posts.filter(p=>p.scheduled_date>=today&&p.scheduled_date<=end);
  const review=state.posts.filter(p=>p.status==="review");
  const noMedia=upcoming.filter(p=>p.format!=="Text-led"&&(!p.media_id||!state.approvedMedia.has(p.media_id)));
  const past=state.posts.filter(p=>p.scheduled_date<today&&!["approved","scheduled"].includes(p.status));
  const ready=upcoming.filter(p=>["approved","scheduled"].includes(p.status)&&!guardNote(p).length);
  const actions=[
   {n:review.length,title:"Awaiting approval",subtitle:"Posts to review",route:"reviews"},
   {n:noMedia.length,title:"Images to check",subtitle:"Upcoming posts without approved visuals",route:"media"},
   {n:past.length,title:"Overdue drafts",subtitle:"Past planned dates, not yet ready",route:"calendar"},
   {n:ready.length,title:"Prepared for hand-off",subtitle:"Internally ready; not published",route:"calendar"}
  ];
  byId("foxonActionItems").innerHTML=actions.map(a=>'<button type="button" data-go="'+esc(a.route)+'"><strong>'+a.n+'</strong><span><b>'+esc(a.title)+'</b><small>'+esc(a.subtitle)+'</small></span><span aria-hidden="true">↗</span></button>').join("");
  root.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>location.hash=b.dataset.go));
  const names=["idea","draft","review","approved","scheduled"];
  const total=state.posts.length;
  byId("foxonAnalytics").innerHTML='<div class="foxon-analytics-row">'+names.map(name=>{
   const num=state.posts.filter(p=>p.status===name).length;
   const width=total?Math.max(2,Math.round(num/total*100)):0;
   return '<div class="foxon-analytics-unit"><span>'+esc(name)+' <strong>'+num+'</strong></span><div class="foxon-meter"><i style="width:'+width+'%"></i></div></div>';
  }).join("")+'</div><div class="foxon-channel-row">'+["LinkedIn","Facebook","Instagram"].map(c=>'<span>'+esc(c)+': <strong>'+state.posts.filter(p=>p.channel===c).length+'</strong></span>').join("")+'</div>';
  byId("foxonUpgradeNotice").textContent=[mediaWarning?"Approved media check unavailable: "+mediaWarning:"",brainWarning?"Brain source lookup unavailable: "+brainWarning:""].filter(Boolean).join(" · ");
 }
 function mountCalendar(){
  if(byId("foxonCalendarTools"))return;
  const calendar=byId("calendar"),weekdays=document.querySelector("#app .weekdays");
  if(!calendar||!weekdays)return;
  const tools=document.createElement("div");tools.id="foxonCalendarTools";tools.className="foxon-upgrade foxon-calendar-tools";
  tools.innerHTML='<div class="foxon-calendar-toggle"><button type="button" data-view="month" aria-pressed="true">Month</button><button type="button" data-view="agenda" aria-pressed="false">Agenda</button></div><label class="foxon-product-filter">FOXON app <select id="foxonProductFilter"><option value="all">All products</option><option value="FOXON Invoice">Invoice</option><option value="FOXON CIS">CIS</option><option value="FOXON Miles">Miles</option><option value="FOXON Gas">Gas</option><option value="General">General</option></select></label><span class="foxon-calendar-instruction">Drag an idea or draft onto another date to reschedule it.</span><span id="foxonCalendarStatus" role="status"></span>';
  weekdays.insertAdjacentElement("beforebegin",tools);
  const agenda=document.createElement("div");agenda.id="foxonAgenda";agenda.className="foxon-upgrade foxon-agenda";agenda.hidden=true;calendar.insertAdjacentElement("afterend",agenda);
  tools.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{
   state.mode=b.dataset.view;
   tools.querySelectorAll("[data-view]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
   calendar.hidden=state.mode==="agenda";weekdays.hidden=state.mode==="agenda";agenda.hidden=state.mode!=="agenda";
   renderAgenda();
  }));
  calendar.addEventListener("dragstart",event=>{
   const el=event.target.closest("button[data-post]");if(!el)return;
   const post=state.posts.find(p=>p.id===el.dataset.post);
   if(!post||!["idea","draft"].includes(post.status)||!allowedRoles.has(state.role)){event.preventDefault();return;}
   state.dragId=post.id;event.dataTransfer.setData("text/plain",post.id);event.dataTransfer.effectAllowed="move";
  });
  calendar.addEventListener("dragover",event=>{
   const day=event.target.closest(".day[data-date]");
   if(day&&state.dragId){event.preventDefault();event.dataTransfer.dropEffect="move";}
  });
  calendar.addEventListener("drop",async event=>{
   const day=event.target.closest(".day[data-date]");if(!day||!state.dragId)return;
   event.preventDefault();const id=state.dragId;state.dragId=null;
   const post=state.posts.find(p=>p.id===id);
   if(!post||!["idea","draft"].includes(post.status))return;
   if(post.scheduled_date===day.dataset.date)return;
   if(!confirm('Move "'+post.title+'" to '+fmt(day.dataset.date)+'? This changes its planned date only.'))return;
   const status=byId("foxonCalendarStatus");status.textContent="Moving draft…";
   const {data,error}=await db.from("studio_posts").update({scheduled_date:day.dataset.date,updated_by:state.user.id}).eq("id",id).in("status",["idea","draft"]).select("id").maybeSingle();
   if(error||!data){status.textContent="Could not move: "+(error?.message||"Draft changed or permission denied.");return;}
   status.textContent="Planned date updated. No social post was published.";
   await window.VubaCalendarReload?.();await refresh();
  });
  calendar.addEventListener("dragend",()=>{state.dragId=null;});
  // Existing calendar renders itself; annotate each date cell and eligible post after repaint.
  const observer=new MutationObserver(()=>annotateCalendar());
  observer.observe(calendar,{childList:true});
  annotateCalendar();
  byId("foxonProductFilter")?.addEventListener("change",event=>{state.product=event.target.value;annotateCalendar();renderAgenda();});
  byId("channel")?.addEventListener("change",renderAgenda);
  byId("status")?.addEventListener("change",renderAgenda);
 }
 function annotateCalendar(){
  const calendar=byId("calendar");if(!calendar)return;
  // The calendar now owns canonical YYYY-MM-DD attributes. No locale-dependent date parsing.
  calendar.querySelectorAll(".day[data-date] button[data-post]").forEach(button=>{
   const p=state.posts.find(x=>x.id===button.dataset.post);
   const movable=!!p&&["idea","draft"].includes(p.status)&&allowedRoles.has(state.role);
   button.draggable=movable;
   button.dataset.product=sourceName(p||{}).toLowerCase().replace("foxon ","");
   button.hidden=state.product!=="all"&&sourceName(p||{})!==state.product;
   if(movable&&!button.dataset.foxonDragTip){
    button.dataset.foxonDragTip="1";
    button.title=(button.title||"")+" · Drag to reschedule";
   }
  });
 }
 function renderAgenda(){
  const node=byId("foxonAgenda");if(!node)return;
  const channel=byId("channel")?.value||"",status=byId("status")?.value||"";
  const filtered=state.posts.filter(p=>(!channel||p.channel===channel)&&(!status||p.status===status)&&(state.product==="all"||sourceName(p)===state.product)).sort((a,b)=>(a.scheduled_date||"").localeCompare(b.scheduled_date||"")).slice(0,80);
  node.innerHTML=filtered.length?filtered.map(p=>'<button type="button" data-agenda-id="'+esc(p.id)+'"><span class="foxon-agenda-date">'+esc(fmt(p.scheduled_date))+'</span><span class="foxon-agenda-main"><strong>'+esc(p.title)+'</strong><small>'+esc(sourceName(p))+' · '+esc(p.channel)+' · '+esc(p.status)+'</small></span><span aria-hidden="true">↗</span></button>').join(""):'<p class="foxon-upgrade-fine">No posts match these filters.</p>';
  node.querySelectorAll("[data-agenda-id]").forEach(b=>b.addEventListener("click",()=>window.VubaOpenPost?.(b.dataset.agendaId)));
 }
 function mountBuilder(){
  if(byId("foxonQuality"))return;
  const form=byId("postForm"),actions=form?.querySelector(".dialogActions");
  if(!form||!actions)return;
  const box=document.createElement("section");
  box.id="foxonQuality";box.className="foxon-upgrade foxon-quality";
  box.innerHTML='<div class="foxon-upgrade-heading"><div><small>EDITORIAL SAFETY</small><h3>Draft checks &amp; recovery</h3></div><button type="button" id="foxonRecoverDraft" hidden>Recover unsaved text</button></div><p id="foxonDraftQuality" role="status">Add a caption to see the editorial checks.</p><div class="foxon-quality-actions"><button type="button" id="foxonCopyCaption">Copy caption</button><label>Approved Brain source<select id="foxonBrainSources"><option value="">Choose a verified entry…</option></select></label><button type="button" id="foxonAttachSource">Add source to notes</button></div><small>Sources are references only: check the underlying approved entry before making claims. Draft recovery is stored in this browser tab, not published.</small>';
  form.insertBefore(box,actions);
  const check=()=>renderBuilder();
  editorFields.forEach(id=>byId(id)?.addEventListener("input",()=>{check();storeDraft();}));
  byId("postForm").addEventListener("change",()=>{check();storeDraft();});
  byId("editor")?.addEventListener("close",()=>renderBuilder());
  byId("foxonRecoverDraft").addEventListener("click",recoverDraft);
  byId("foxonCopyCaption").addEventListener("click",async()=>{
   try{await navigator.clipboard.writeText(byId("caption")?.value||"");byId("foxonDraftQuality").textContent="Caption copied to clipboard.";}
   catch{byId("foxonDraftQuality").textContent="Clipboard unavailable. Select and copy the caption manually.";}
  });
  byId("foxonAttachSource").addEventListener("click",()=>{
   const i=Number(byId("foxonBrainSources")?.value);
   if(!Number.isInteger(i)||i<0||!state.brain[i])return;
   const b=state.brain[i];const note="Approved FOXON Brain reference: "+b.title+(b.source_path?" — "+b.source_path:"")+(b.source_date?" ("+b.source_date+")":"");
   const el=byId("source");el.value=el.value.trim()?el.value.trim()+"\n"+note:note;
   el.dispatchEvent(new Event("input",{bubbles:true}));renderBuilder();
  });
  window.addEventListener("foxon:post-saved",()=>clearDraft());
  renderBuilder();
 }
 function renderBuilder(){
  const node=byId("foxonDraftQuality");if(!node)return;
  const caption=byId("caption")?.value||"",source=byId("source")?.value.trim(),image=byId("postMedia")?.value;
  const chars=Array.from(caption).length;
  const issues=[];
  if(!caption.trim())issues.push("caption needed");
  if(!source)issues.push("source/verification notes needed");
  if(byId("format")?.value!=="Text-led"){
   if(!image)issues.push("no image selected");
   else if(!state.approvedMedia.has(image))issues.push("check image approval");
  }
  node.textContent=chars+" characters · "+(issues.length?issues.join(" · "):"Editorial checks complete. Staff approval is still required.");
  const sourceList=byId("foxonBrainSources");if(sourceList){
   const current=sourceList.value;
   sourceList.innerHTML='<option value="">Choose a verified entry…</option>'+state.brain.map((b,i)=>'<option value="'+i+'">'+esc(b.title)+'</option>').join("");
   sourceList.value=current;
  }
  const recovery=byId("foxonRecoverDraft");
  if(recovery)recovery.hidden=!loadDraft();
 }
 function draftKey(){return "foxon-draft-v2-"+(state.user?.id||"none");}
 function storeDraft(){
  if(!state.user||!byId("editor")?.open)return;
  const values={};editorFields.forEach(id=>{if(byId(id))values[id]=byId(id).value;});
  // Session-only recovery: do not persist captions in localStorage.
  try{sessionStorage.setItem(draftKey(),JSON.stringify({values,postId:byId("postId")?.value||"",at:Date.now()}));}catch{}
  const button=byId("foxonRecoverDraft");if(button)button.hidden=false;
 }
 function loadDraft(){
  try{const raw=sessionStorage.getItem(draftKey());if(!raw)return null;const x=JSON.parse(raw);return x?.values&&Date.now()-x.at<86400000?x:null;}catch{return null;}
 }
 function recoverDraft(){
  const saved=loadDraft();if(!saved)return;
  if((byId("postId")?.value||"")!==saved.postId){byId("foxonDraftQuality").textContent="This saved text belongs to a different post; open that draft before recovering.";return;}
  if(!confirm("Replace the current form text with your session recovery copy?"))return;
  editorFields.forEach(id=>{if(byId(id)&&Object.hasOwn(saved.values,id))byId(id).value=saved.values[id];});
  renderBuilder();
 }
 function clearDraft(){try{sessionStorage.removeItem(draftKey());}catch{}renderBuilder();}
 function exportQueue(){
  const today=dateToday();
  const rows=state.posts.filter(p=>["approved","scheduled"].includes(p.status)&&p.scheduled_date>=today).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date));
  if(!rows.length){byId("foxonUpgradeNotice").textContent="No approved or internally scheduled posts are available to export.";return;}
  const safeCsv=v=>{let s=String(v??"");if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const fields=["scheduled_date","channel","status","title","caption","pillar","format","source_notes","readiness_issues"];
  const csv=[fields.join(","),...rows.map(p=>fields.map(k=>safeCsv(k==="readiness_issues"?guardNote(p).join("; "):p[k])).join(","))].join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download="foxon-approved-content-"+today+".csv";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  byId("foxonUpgradeNotice").textContent=rows.length+" prepared posts exported. This does not publish them or verify platform delivery.";
 }
 db.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>init(session?.user||null),0);});
 db.auth.getSession().then(({data})=>init(data.session?.user||null));
 window.addEventListener("hashchange",()=>{if(location.hash==="#home"||location.hash==="#calendar")refresh();});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.user)refresh();});
 window.addEventListener("foxon:post-saved",()=>{setTimeout(refresh,100);});
 window.FOXONStudioUpgrade={refresh,snapshot:()=>({importedMetrics:state.importedMetrics.map(x=>({...x})),postCount:state.posts.length})};
}
