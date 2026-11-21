/* FOXON Marketing HQ: verified-source editorial planning, original creative layout,
   explicit hand-off and evidence-labelled insight. No direct social posting. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const config=window.VUBA_CONFIG||{};
if(config.supabaseUrl&&config.supabaseAnonKey){
 const db=createClient(config.supabaseUrl,config.supabaseAnonKey);
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const products=["FOXON Invoice","FOXON CIS","FOXON Miles","FOXON Gas"],channels=["LinkedIn","Facebook","Instagram"];
 const state={user:null,role:"",posts:[],brain:[],documents:[],campaigns:[],media:[],suggestions:[],image:null,busy:false,active:"director"};
 const note=s=>{if($("hqMessage"))$("hqMessage").textContent=s;};
 const dayString=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 const nextMonday=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+((8-d.getDay())%7||7));return d;};
 const nameOf=p=>products.find(n=>[p.title,p.topic,p.pillar].join(" ").toLowerCase().includes(n.toLowerCase()))||"General";
 const allowed=()=>["admin","approver","editor"].includes(state.role);
 const issues=p=>{const out=[];if(!p.caption?.trim())out.push("Caption missing");if(!p.source_notes?.trim())out.push("Source verification missing");if(p.format!=="Text-led"){if(!p.media_id)out.push("Artwork missing");else if(!state.media.some(m=>m.id===p.media_id&&m.approved&&!m.archived_at))out.push("Artwork not approved");}return out;};
 async function enter(user){
  state.user=user||null;if(!user){$("foxonHQ")?.remove();$("hqQuickJump")?.remove();state.posts=[];return;}
  const member=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
  if(member.error||!member.data)return;state.role=member.data.role;
  for(let i=0;i<40&&!$("studioHome");i++)await new Promise(resolve=>setTimeout(resolve,100));
  if(!$("studioHome"))return;
  if(!$("foxonHQ"))mount();
  await refresh();
 }
 function mount(){
  const root=document.createElement("section");root.id="foxonHQ";root.className="foxon-hq";
  root.innerHTML='<div class="hq-head"><div><small>FOXON / MARKETING OPERATIONS</small><h2>MARKETING HQ.</h2><p>Plan, design, review and learn — without losing control of publication.</p></div><button type="button" id="hqRefresh">Refresh</button></div>'+
  '<nav class="hq-tabs" aria-label="Marketing HQ sections"><button type="button" data-hq-tab="director" aria-pressed="true">Marketing Director</button><button type="button" data-hq-tab="creative">Creative Studio</button><button type="button" data-hq-tab="publishing">Publishing Desk</button><button type="button" data-hq-tab="insights">Insights &amp; QA</button></nav>'+
  '<p id="hqMessage" role="status"></p>'+
  '<div id="hqDirector" class="hq-page"><div class="hq-headline"><div><h3>Next week, planned properly</h3><p>Uses approved FOXON Brain entries and saved campaign briefs. Proposals are editable, not automatically approved.</p></div><button type="button" id="hqGeneratePlan">Plan next week</button></div><div class="hq-fields-row"><label>Campaign focus<select id="hqCampaign"><option value="">Organic / no campaign</option></select></label><label>Platform<select id="hqChannel"><option value="all">All three platforms</option><option>LinkedIn</option><option>Facebook</option><option>Instagram</option></select></label></div><div id="hqDraftCards" class="hq-cards"><p>Choose Plan next week to prepare editable drafts.</p></div><button type="button" id="hqSaveDrafts" disabled>Save selected drafts to calendar</button></div>'+
  '<div id="hqCreative" class="hq-page" hidden><div class="hq-headline"><div><h3>Creative Studio</h3><p>Real screenshots, approved imagery and original FOXON layouts. Designs need approval before use.</p></div><button type="button" id="hqDraw">Update design</button></div><div class="hq-creative-grid"><div class="hq-controls"><label>Layout<select id="hqLayout"><option value="phone">Phone mockup</option><option value="photo">Photography and headline</option><option value="bold">Bold graphic</option></select></label><label>Format<select id="hqSize"><option value="portrait">Portrait · 1080 × 1350</option><option value="square">Square · 1080 × 1080</option><option value="landscape">Landscape · 1200 × 675</option></select></label><label>Product<select id="hqProduct"><option>FOXON Invoice</option><option>FOXON CIS</option><option>FOXON Miles</option><option>FOXON Gas</option></select></label><label>Headline<textarea id="hqHeadline" maxlength="110" rows="3">MADE FOR THE TRADE.</textarea></label><label>Supporting line<input id="hqSubline" maxlength="100" value="YOUR WORK. YOUR WAY."></label><label>Approved library image<select id="hqLibraryImage"><option value="">Choose an approved image</option></select></label><label>Or upload a real screenshot/photo<input id="hqImageFile" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="hq-check"><input type="checkbox" id="hqRights"> I confirm image rights and accurate copy.</label><div class="hq-buttons"><button type="button" id="hqDownload">Download PNG</button><button type="button" id="hqUpload">Save for media approval</button></div><small>Phone screens are supplied by you, never invented. New library images remain unapproved until reviewed.</small></div><div class="hq-preview"><canvas id="hqCanvas" width="1080" height="1350" aria-label="FOXON graphic preview"></canvas></div></div></div>'+
  '<div id="hqPublishing" class="hq-page" hidden><div class="hq-headline"><div><h3>Publishing Desk</h3><p>Ready for hand-off is not the same as posted. Nothing here sends content to a social platform.</p><p><a href="https://app.metricool.com/brands/connections?blogId=8253976" target="_blank" rel="noopener noreferrer">Connect FOXON social accounts in Metricool</a> to prepare for a future authenticated publishing integration.</p></div><button type="button" id="hqExport">Export CSV</button></div><label class="hq-filter">Show <select id="hqPublishFilter"><option value="all">All approved/scheduled</option><option value="ready">Ready only</option><option value="issues">Needs attention</option></select></label><div id="hqPublishingItems" class="hq-cards"></div></div>'+
  '<div id="hqInsights" class="hq-page" hidden><div class="hq-headline"><div><h3>Analytics intelligence</h3><p>Verified workflow data is separate from manually imported platform metrics.</p></div><button type="button" id="hqContrast">Check icon contrast</button></div><div id="hqIntelligence"></div><p id="hqContrastResult" class="hq-muted"></p></div>';
  $("studioHome").appendChild(root);
  const heading=$("studioHome").querySelector(".studio-page-heading");
  if(heading&&!$("hqQuickJump")){const jump=document.createElement("button");jump.type="button";jump.id="hqQuickJump";jump.className="hq-quick-jump";jump.textContent="OPEN MARKETING HQ";jump.onclick=()=>root.scrollIntoView({block:"start",behavior:"smooth"});heading.appendChild(jump);}
  root.querySelectorAll("[data-hq-tab]").forEach(button=>button.addEventListener("click",()=>show(button.dataset.hqTab)));
  $("hqRefresh").onclick=refresh;$("hqGeneratePlan").onclick=generate;$("hqSaveDrafts").onclick=save;
  ["hqLayout","hqSize","hqHeadline","hqSubline"].forEach(id=>$(id).addEventListener(id==="hqHeadline"||id==="hqSubline"?"input":"change",draw));
  $("hqProduct").onchange=()=>{state.image=null;if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;}$("hqLibraryImage").value="";$("hqImageFile").value="";$("hqRights").checked=false;draw();note("Product changed — choose a matching real screenshot or approved image.");};
  $("hqDraw").onclick=draw;$("hqImageFile").onchange=loadFile;$("hqLibraryImage").onchange=loadApproved;
  $("hqDownload").onclick=download;$("hqUpload").onclick=upload;
  $("hqPublishFilter").onchange=renderPublishing;$("hqExport").onclick=()=>$("foxonExportQueue")?.click();
  $("hqContrast").onclick=contrast;
  window.FOXONMarketingHQ={refresh,openTab:name=>{location.hash="home";show(name);$("foxonHQ").scrollIntoView({block:"start",behavior:"smooth"});}};
  draw();
 }
 function show(name){
  state.active=name;
  for(const x of ["director","creative","publishing","insights"]){const el=$("hq"+x[0].toUpperCase()+x.slice(1));if(el)el.hidden=name!==x;}
  $("foxonHQ").querySelectorAll("[data-hq-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.hqTab===name)));
  if(name==="publishing")renderPublishing();if(name==="insights")renderInsights();
 }
 async function refresh(){
  if(!state.user||!$("foxonHQ"))return;
  const [posts,brain,documents,campaigns,media]=await Promise.all([
   db.from("studio_posts").select("id,title,topic,channel,status,caption,source_notes,media_id,format,pillar,scheduled_date,campaign_id").order("scheduled_date",{ascending:true}).limit(500),
   db.from("studio_brain_entries").select("title,category,body,source_path,source_date,source_label").eq("verification","approved").is("archived_at",null).limit(100),
   db.from("studio_brain_documents").select("title,filename,description,extraction_status").eq("verification","approved").is("archived_at",null).limit(80),
   db.from("studio_campaigns").select("id,name,objective,key_messages,status").in("status",["planning","active"]).limit(100),
   db.from("studio_media").select("id,filename,description,file_path,mime_type,approved,archived_at").is("archived_at",null).limit(250)
  ]);
  if(posts.error){note("Cannot load posts: "+posts.error.message);return;}
  state.posts=posts.data||[];state.brain=brain.data||[];state.documents=documents.data||[];state.campaigns=campaigns.data||[];state.media=media.data||[];
  const campaign=$("hqCampaign").value;
  $("hqCampaign").innerHTML='<option value="">Organic / no campaign</option>'+state.campaigns.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("");
  $("hqCampaign").value=state.campaigns.some(c=>c.id===campaign)?campaign:"";
  $("hqLibraryImage").innerHTML='<option value="">Choose an approved image</option>'+state.media.filter(m=>m.approved&&m.mime_type?.startsWith("image/")).map(m=>'<option value="'+esc(m.id)+'">'+esc(m.description||m.filename)+'</option>').join("");
  renderPublishing();renderInsights();
  note([brain.error?"Brain entries unavailable":"",documents.error?"Brain documents unavailable":"",campaigns.error?"Campaigns unavailable":"",media.error?"Media unavailable":""].filter(Boolean).join("; ")||"FOXON source data refreshed.");
 }
 function nextWeek(){
  const monday=new Date();monday.setHours(12,0,0,0);monday.setDate(monday.getDate()+((8-monday.getDay())%7||7));return monday;
 }
 function angleFor(app,seed){
  const entries=state.brain.filter(x=>[x.title,x.body].join(" ").toLowerCase().includes(app.toLowerCase()));
  if(entries.length){const e=entries[seed%entries.length];return {text:e.title,source:"Approved FOXON Brain: "+e.title+(e.source_path?" · "+e.source_path:"")+(e.source_date?" · "+e.source_date:"")};}
  const documents=state.documents.filter(d=>[d.title,d.filename,d.description].join(" ").toLowerCase().includes(app.toLowerCase()));
  if(documents.length){const d=documents[seed%documents.length];return {text:"What should trades know about "+d.title+"?",source:"Approved FOXON Brain document: "+(d.title||d.filename)+". Staff must check the original document before stating product capabilities."};}
  const topics={
   "FOXON Invoice":["How trade teams approach invoice records","What makes an invoice workflow feel organised?","A trade perspective on everyday payment admin","Questions about keeping records clear"],
   "FOXON CIS":["The questions trades ask about CIS admin","How teams approach contractor paperwork","What information gets checked twice?","A practical conversation about CIS routines"],
   "FOXON Miles":["Keeping mileage notes organised","What makes a journey log useful?","The moments people forget to record a journey","Your mileage admin questions"],
   "FOXON Gas":["What makes a practical engineer workflow","What information engineers want to hand over","A conversation about documenting site work","How trades keep work records clear"]
  };
  return {text:topics[app][seed%4],source:"Editorial question only. No product feature claims verified; review FOXON Brain before approval."};
 }
 function captionFor(app,channel,topic,variant){
  const lower=topic.toLowerCase();
  const options={
   LinkedIn:[
    "Good trade software starts with the people doing the work.\n\nThis week we are discussing "+lower+" through the lens of "+app+". What would make a working day simpler for your team?\n\n#FOXON #TradeSoftware",
    "One question we keep coming back to: "+topic+"?\n\nWe are exploring this topic while developing the conversation around "+app+". If you manage people or processes in the trades, what is your experience?",
    "The best product conversations start with real work, not feature lists.\n\nToday's topic is "+lower+". What would you want a software team to understand before offering a solution?\n\n#FOXON"
   ],
   Facebook:[
    "Quick question for people in the trades: how do you currently handle "+lower+"?\n\nWe're talking about "+app+" and would love to hear the reality of a busy day on site.",
    "Everyone seems to have their own way of dealing with paperwork and admin. What's yours when it comes to "+lower+"?\n\nTell us what's worked for you. — The FOXON team",
    "Calling tradespeople and small business owners: what's the one thing you'd change about "+lower+"?\n\nWe're listening as we share more about "+app+"."
   ],
   Instagram:[
    app+" / THE TRADE PERSPECTIVE.\n\n"+topic+".\n\nWhat would you change first? Tell us below.\n\n#FOXON #Trades #SiteLife",
    "REAL WORK. REAL QUESTIONS.\n\n"+topic+".\n\nWhat does your routine look like? Sound off below.\n\n#FOXON #TradeSoftware",
    "BEHIND THE WORK.\n\nWe're talking about "+lower+".\n\nWhat would you want us to explore next?\n\n#FOXON #Construction"
   ]
  };
  return options[channel][variant%3];
 }
 function generate(){
  const monday=nextWeek(),channel=$("hqChannel").value,campaign=state.campaigns.find(c=>c.id===$("hqCampaign").value);
  const ch=channel==="all"?channels:[channel],proposals=[];
  const week=Math.floor(monday.getTime()/604800000),headlines={
   LinkedIn:["The trade perspective","What matters to the team","A question worth asking"],
   Facebook:["A question for trades","Your experience matters","Tell us how you do it"],
   Instagram:["Behind the work","Site-life questions","A closer look"]
  };
  products.forEach((app,index)=>{
   const d=new Date(monday);d.setDate(monday.getDate()+index);const date=dayString(d),angle=angleFor(app,week+index);
   ch.forEach((platform,pi)=>{
    const variant=(week+index+pi)%3;
    const title=app+" — "+headlines[platform][variant];
    const caption=captionFor(app,platform,angle.text,variant);
    if(state.posts.some(p=>p.scheduled_date===date&&p.channel===platform))return;
    if(state.posts.some(p=>p.channel===platform&&p.title===title&&p.topic===angle.text))return;
    if(state.posts.some(p=>p.channel===platform&&p.caption===caption))return;
    proposals.push({date,channel:platform,app,title,topic:angle.text,caption,
     source_notes:angle.source+(campaign?"\nCampaign objective: "+campaign.name+" — "+String(campaign.objective||"").slice(0,180):"")+"\nDRAFT: verify copy and imagery before approval.",
     campaign_id:campaign?.id||null,format:platform==="LinkedIn"?"Text-led":"Single image",selected:true});
   });
  });
  state.suggestions=proposals;renderBrief();
  note(proposals.length+" unique platform-specific proposals. Previously planned slots and matching past captions were skipped.");
 }
 function renderBrief(){
  const root=$("hqDraftCards");root.innerHTML=state.suggestions.length?state.suggestions.map((p,i)=>
   '<article class="hq-proposal"><div class="hq-proposal-top"><label><input type="checkbox" data-select="'+i+'" '+(p.selected?"checked":"")+'> Include</label><strong>'+esc(p.app)+' · '+esc(p.channel)+'</strong></div><label>Headline<input data-title="'+i+'" maxlength="140" value="'+esc(p.title)+'"></label><label>Planned date<input data-date="'+i+'" type="date" value="'+esc(p.date)+'"></label><label>Caption<textarea data-caption="'+i+'" rows="6" maxlength="4000">'+esc(p.caption)+'</textarea></label><small>'+esc(p.source_notes)+'</small></article>').join(""):'<p>No new proposals. Adjust the focus or try another week.</p>';
  root.querySelectorAll("input,textarea").forEach(el=>el.addEventListener("change",()=>{
   const key=el.dataset.select!==undefined?"select":el.dataset.title!==undefined?"title":el.dataset.date!==undefined?"date":"caption";
   const i=Number(el.dataset[key]),p=state.suggestions[i];if(!p)return;
   p[key==="select"?"selected":key]=key==="select"?el.checked:el.value;
   $("hqSaveDrafts").disabled=!allowed()||!state.suggestions.some(p=>p.selected);
  }));
  $("hqSaveDrafts").disabled=!allowed()||!state.suggestions.some(p=>p.selected);
 }
 async function save(){
  if(!allowed()||state.busy)return;
  const items=state.suggestions.filter(p=>p.selected);
  if(!items.length)return;
  if(items.some(p=>!p.title.trim()||!p.caption.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))){note("Each draft needs a headline, caption and valid date.");return;}
  if(!confirm("Save "+items.length+" posts as drafts? No social accounts will be contacted."))return;
  state.busy=true;$("hqSaveDrafts").disabled=true;
  try{
   const payload=items.map(p=>({title:p.title,topic:p.topic,pillar:p.app,series:"Marketing HQ weekly plan",format:p.format,
    channel:p.channel,status:"draft",scheduled_date:p.date,caption:p.caption,source_notes:p.source_notes,
    media_id:null,campaign_id:p.campaign_id,created_by:state.user.id,updated_by:state.user.id}));
   const {data,error}=await db.from("studio_posts").insert(payload).select("id");
   if(error)throw error;
   state.suggestions=[];renderBrief();
   await window.VubaCalendarReload?.();await window.FOXONStudioUpgrade?.refresh?.();await refresh();
   note((data?.length||payload.length)+" draft posts saved, awaiting images and approval. No posts published.");
  }catch(e){note("Could not save drafts: "+e.message);}finally{state.busy=false;$("hqSaveDrafts").disabled=!state.suggestions.some(p=>p.selected);}
 }
 function loadFile(event){
  const file=event.target.files?.[0];if(!file)return;
  if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>10e6){note("Use a PNG, JPEG or WebP under 10 MB.");return;}
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=url;state.image=img;$("hqLibraryImage").value="";draw();note("Genuine image loaded.");};
  img.onerror=()=>{URL.revokeObjectURL(url);note("Could not read the selected image.");};
  img.src=url;
 }
 async function loadApproved(e){
  const item=state.media.find(m=>m.id===e.target.value&&m.approved&&!m.archived_at);
  if(!item){state.image=null;draw();return;}
  try{
   const {data,error}=await db.storage.from("foxon-approved-media").createSignedUrl(item.file_path,300);
   if(error||!data?.signedUrl)throw error||Error("Could not obtain a private media link.");
   const res=await fetch(data.signedUrl);if(!res.ok)throw Error("Could not download media.");
   const blob=await res.blob(),url=URL.createObjectURL(blob),image=new Image();
   image.onload=()=>{if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=url;state.image=image;draw();note("Approved library image loaded.");};
   image.src=url;
  }catch(err){note("Image unavailable: "+err.message);}
 }
 function wrap(ctx,text,width){
  const lines=[],words=String(text).toUpperCase().split(/\s+/);let line="";
  for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>width&&line){lines.push(line);line=word;}else line=test;}
  if(line)lines.push(line);return lines.slice(0,3);
 }
 function drawImage(ctx,img,x,y,w,h){
  const ratio=Math.max(w/img.width,h/img.height),iw=img.width*ratio,ih=img.height*ratio;
  ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
 }
 function draw(){
  const c=$("hqCanvas");if(!c)return;
  const sizes={portrait:[1080,1350],square:[1080,1080],landscape:[1200,675]};
  const [w,h]=sizes[$("hqSize").value];c.width=w;c.height=h;
  const ctx=c.getContext("2d"),pad=w*.07,mode=$("hqLayout").value;
  ctx.fillStyle="#121212";ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#f2c500";ctx.fillRect(pad,pad,70,8);
  ctx.fillStyle="#f7f7f7";ctx.font="bold "+(w*.035)+"px Arial";ctx.fillText("FOXON SOFTWARE",pad,pad+63);
  ctx.fillStyle="#f2c500";ctx.font="bold "+(w*.022)+"px Arial";ctx.fillText($("hqProduct").value.toUpperCase(),pad,pad+106);
  const img=state.image;
  if(mode==="phone"){
   const height=h*.48,width=Math.min(w*.49,height*.53),x=(w-width)/2,y=h*.18;
   ctx.fillStyle="#474747";ctx.beginPath();ctx.roundRect(x-8,y-8,width+16,height+16,50);ctx.fill();
   ctx.fillStyle="#080808";ctx.beginPath();ctx.roundRect(x,y,width,height,42);ctx.fill();
   ctx.save();ctx.beginPath();ctx.roundRect(x+12,y+18,width-24,height-36,30);ctx.clip();
   if(img)drawImage(ctx,img,x+12,y+18,width-24,height-36);
   else{ctx.fillStyle="#292929";ctx.fillRect(x+12,y+18,width-24,height-36);ctx.fillStyle="#f2c500";ctx.font="bold 22px Arial";ctx.textAlign="center";ctx.fillText("ADD REAL SCREEN",w/2,y+height/2);ctx.textAlign="left";}
   ctx.restore();
  }else if(mode==="photo"){
   const y=h*.2,height=h*.46;
   if(img){ctx.save();ctx.beginPath();ctx.rect(0,y,w,height);ctx.clip();drawImage(ctx,img,0,y,w,height);ctx.restore();}
   else{ctx.fillStyle="#2b2b2b";ctx.fillRect(0,y,w,height);ctx.fillStyle="#f2c500";ctx.font="bold 31px Arial";ctx.textAlign="center";ctx.fillText("ADD GENUINE PHOTO",w/2,y+height/2);ctx.textAlign="left";}
  }else{
   ctx.fillStyle="#242424";ctx.fillRect(pad,h*.23,w-pad*2,h*.42);ctx.fillStyle="#f2c500";ctx.fillRect(pad,h*.23,12,h*.42);
   ctx.font="bold "+(w*.13)+"px Arial";ctx.fillText("FOXON",pad+32,h*.48);
  }
  const fontSize=Math.min(w*.06,h*.078),lineHeight=fontSize*1.13;
  ctx.fillStyle="#f2c500";ctx.font="900 "+fontSize+"px Arial";
  const lines=wrap(ctx,$("hqHeadline").value||"MADE FOR THE TRADE",w-pad*2);
  const baseY=Math.min(h*.8,h-66-(lines.length-1)*lineHeight-38);
  lines.forEach((line,i)=>ctx.fillText(line,pad,baseY+i*lineHeight));
  ctx.fillStyle="#f7f7f7";ctx.font="bold "+Math.min(w*.022,h*.035)+"px Arial";ctx.fillText(($("hqSubline").value||"").toUpperCase(),pad,Math.min(h-37,baseY+lines.length*lineHeight+14),w-pad*2);
  ctx.fillStyle="#f2c500";ctx.fillRect(pad,h-18,w-pad*2,5);
 }
 function validArt(){
  if($("hqLayout").value!=="bold"&&!state.image){note("Add a real screenshot/photo to this layout before export.");return false;}
  return true;
 }
 function pngBlob(){return new Promise((resolve,reject)=>$("hqCanvas").toBlob(b=>b?resolve(b):reject(Error("Could not render PNG")),"image/png"));}
 async function download(){
  if(!validArt())return;
  try{draw();const blob=await pngBlob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="foxon-"+$("hqSize").value+"-"+Date.now()+".png";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);note("PNG downloaded. Verify copy and image rights before publishing.");}
  catch(e){note("Download failed: "+e.message);}
 }
 async function upload(){
  if(!allowed()||!state.user||!validArt()||state.busy)return;
  if(!$("hqRights").checked){note("Confirm your image rights and copy accuracy first.");return;}
  state.busy=true;$("hqUpload").disabled=true;
  try{
   draw();const blob=await pngBlob();if(blob.size>10*1024*1024)throw Error("Image exceeds 10 MB");
   const path=state.user.id+"/marketing-hq/"+crypto.randomUUID()+".png";
   const upload=await db.storage.from("foxon-approved-media").upload(path,blob,{contentType:"image/png",upsert:false});
   if(upload.error)throw upload.error;
   const result=await db.from("studio_media").insert({file_path:path,filename:"foxon-hq-"+Date.now()+".png",
    description:"Marketing HQ graphic for "+$("hqProduct").value,usage_rights:"Creator confirms source rights and copy. Requires approval before publication.",
    mime_type:"image/png",uploaded_by:state.user.id,approved:false}).select("id").single();
   if(result.error){await db.storage.from("foxon-approved-media").remove([path]);throw result.error;}
   note("Artwork saved privately for approval. It is not yet an approved image.");
   await window.FOXONStudioPlus?.refresh?.();await window.FOXONMediaAssist?.refresh?.();await refresh();
  }catch(e){note("Artwork not saved: "+e.message);}finally{state.busy=false;$("hqUpload").disabled=false;}
 }
 function renderPublishing(){
  const root=$("hqPublishingItems");if(!root)return;
  const filter=$("hqPublishFilter").value,items=state.posts.filter(p=>["approved","scheduled"].includes(p.status));
  const selected=items.filter(p=>filter==="all"||(filter==="ready"?!issues(p).length:issues(p).length));
  root.innerHTML=selected.length?selected.map(p=>'<article class="hq-publish-item"><span class="hq-label">'+esc(issues(p).length?"NEEDS CHECK":"READY FOR HAND-OFF")+'</span><small>'+esc(p.scheduled_date)+' · '+esc(p.channel)+' · '+esc(p.status)+'</small><h4>'+esc(p.title)+'</h4><p>'+esc((p.caption||"").slice(0,250))+'</p><small>'+esc(issues(p).join(" · ")||"Prepared internally; not published externally.")+'</small><div class="hq-buttons"><button type="button" data-copy="'+esc(p.id)+'">Copy caption</button><button type="button" data-open="'+esc(p.id)+'">Open platform</button><button type="button" data-edit="'+esc(p.id)+'">Edit</button></div></article>').join(""):'<p>No posts match this view.</p>';
  root.querySelectorAll("[data-copy]").forEach(b=>b.onclick=async()=>{const p=state.posts.find(x=>x.id===b.dataset.copy);if(!p)return;if(issues(p).length){note("Complete readiness checks before handing off this post.");return;}try{await navigator.clipboard.writeText(p.caption);note("Caption copied for manual publishing.");}catch{note("Clipboard unavailable. Open the post editor to copy the caption.");}});
  root.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{const p=state.posts.find(x=>x.id===b.dataset.open);if(!p)return;if(issues(p).length){note("Complete readiness checks first.");return;}const links={LinkedIn:"https://www.linkedin.com/feed/",Facebook:"https://www.facebook.com/",Instagram:"https://www.instagram.com/"};window.open(links[p.channel],"_blank","noopener,noreferrer");note("Social site opened for a manual post. FOXON has not published or confirmed delivery.");});
  root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>window.VubaOpenPost?.(b.dataset.edit));
 }
 function renderInsights(){
  const root=$("hqIntelligence");if(!root)return;
  const importRows=window.FOXONStudioUpgrade?.snapshot?.()?.importedMetrics||[];
  const rows=channels.map(channel=>{const data=importRows.filter(m=>m.channel===channel);return {channel,count:data.length,impressions:data.reduce((a,b)=>a+b.impressions,0),clicks:data.reduce((a,b)=>a+b.clicks,0)};});
  const observed=rows.filter(r=>r.impressions>=100).sort((a,b)=>b.clicks/b.impressions-a.clicks/a.impressions);
  root.innerHTML='<div class="hq-insight-grid">'+rows.map(r=>'<div><h4>'+r.channel+'</h4><strong>'+r.impressions.toLocaleString("en-GB")+'</strong><small>Imported impressions · '+r.clicks.toLocaleString("en-GB")+' clicks</small><p>CTR: '+(r.impressions?(100*r.clicks/r.impressions).toFixed(2)+"%":"—")+'</p></div>').join("")+'</div><p>'+esc(importRows.length?(observed.length?"Highest observed click rate (100+ impressions): "+observed[0].channel+". Treat this as a test idea, not proof of causation.":"Not enough observations to rank channels reliably."):"No actual platform metrics imported yet. Use the manual CSV import above; no performance figures are invented.")+'</p><p>Prepared posts: '+state.posts.filter(p=>["approved","scheduled"].includes(p.status)).length+'. This is internal planning, not a published post count.</p>';
 }
 function contrast(){
  const entries=[".studio-stat .stat-mark",".studio-navigation .nav-glyph"];
  const results=entries.map(selector=>{const e=document.querySelector(selector);if(!e)return selector+": not on this screen";const c=getComputedStyle(e);return selector+": text "+c.color+" / background "+c.backgroundColor;});
  $("hqContrastResult").textContent="Current-theme computed colours: "+results.join(" · ")+". Automated colour inspection does not replace visual, mobile or screen-reader testing.";
 }
 db.auth.onAuthStateChange((_e,session)=>setTimeout(()=>enter(session?.user||null),0));
 db.auth.getSession().then(({data})=>enter(data.session?.user||null));
 window.addEventListener("foxon:post-saved",()=>setTimeout(refresh,100));
 document.addEventListener("foxon:studio-refresh",()=>{if(state.active==="insights")renderInsights();});
}
