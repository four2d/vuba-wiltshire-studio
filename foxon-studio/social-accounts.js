/* FOXON direct social-account administration foundation.
   Read-only pending official Meta/LinkedIn authorisation; no credentials in browser.
   Scheduling: admins queue approved posts for a UK date/time; Supabase Cron sends them server-side.
   The browser only READS the queue; every change goes through the foxon-social-publish function. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {ukLocalToUtcIso,utcIsoToUkParts,formatUk,tomorrowUk,scheduleWindowError,DEFAULT_UK_TIME} from "./schedule-time.js?v=20261126schedule";
const config=window.VUBA_CONFIG||{};
if(config.supabaseUrl&&config.supabaseAnonKey){
 const db=createClient(config.supabaseUrl,config.supabaseAnonKey);
 const $=id=>document.getElementById(id);
 const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const platforms=[
  {name:"Facebook",label:"FOXON Facebook Page",url:"https://developers.facebook.com/apps/",help:"Publish approved posts to your Facebook Page."},
  {name:"Instagram",label:"FOXON Instagram Professional",url:"https://developers.facebook.com/apps/",help:"Share approved graphics to a professional Instagram account."},
  {name:"LinkedIn",label:"FOXON LinkedIn Company Page",url:"https://www.linkedin.com/developers/apps",help:"Publish company updates from your LinkedIn Page."}
 ];
 let user=null,role="",accounts=[],deliveries=[],posts=[],schedules=[],schedulingReady=true,connecting=false,refreshTimer=null;
 const LIVE_SCHEDULE=["scheduled","sending","published","needs_reconciliation"];
 const SCHEDULE_LABEL={scheduled:"Waiting",sending:"Sending now",published:"Published",failed:"Not posted",needs_reconciliation:"Check the platform",cancelled:"Cancelled"};
 const FRIENDLY={
  time_must_be_in_future:"Pick a time at least 5 minutes from now.",
  time_too_far_ahead:"Pick a time within the next 90 days.",
  invalid_time:"That UK date and time doesn't exist (clocks change). Pick another.",
  post_already_scheduled_for_this_account:"This post is already queued for that account.",
  post_already_scheduled_cancel_first:"This post is queued. Cancel the scheduled entry before publishing it now.",
  delivery_exists_reconcile_before_retry:"This post was already sent (or attempted) to that account. Duplicate the post to send it again.",
  already_sending_cannot_cancel:"It's being sent right now and can't be cancelled. Refresh in a minute.",
  already_sending_cannot_edit:"It's being sent right now and can't be edited. Refresh in a minute.",
  instagram_scheduling_disabled:"Instagram scheduling is switched off.",
  post_requires_approved_status:"Only approved posts can be scheduled.",
  linkedin_image_must_be_jpeg_png_or_gif:"LinkedIn images must be JPEG, PNG or GIF.",
  typed_publish_confirmation_required:"Type PUBLISH to confirm."
 };
 const friendly=code=>FRIENDLY[code]||String(code||"Unknown error").replace(/_/g," ");
 function setMessage(message){const el=$("foxonSocialStatus");if(el)el.textContent=message;}
 function mount(){
  const host=$("foxonConnectionWorkspace");if(!host||$("foxonSocialAccounts"))return;
  const root=document.createElement("section");root.id="foxonSocialAccounts";root.className="foxon-social-accounts foxon-easy-connect";
  root.innerHTML='<header class="fc-welcome"><span class="fc-spark">✦</span><div><h2>Add your accounts</h2><p>Choose an account below. Sign in on the social network, select the Page or account you want, then review the permissions. You’ll return here to see whether it connected.</p></div></header><div id="foxonSocialCards" class="fc-primary-cards"></div><p id="foxonSocialStatus" role="status" aria-live="polite" class="fc-friendly-status"></p><p class="fc-reassurance">✓ Your passwords stay with Facebook, Instagram and LinkedIn.</p><details id="foxonConnectedTools" class="fc-optional-details" hidden><summary>Posts and activity</summary><section class="foxon-direct-publish"><h3>Approved posts</h3><div id="foxonPublishCandidates"></div></section><section class="foxon-schedule-queue"><h3>Scheduled posts</h3><p class="foxon-schedule-note">Times are UK time (Europe/London). Nothing is sent until the scheduler is switched on server-side.</p><div id="foxonScheduleQueue"></div></section><section class="foxon-delivery-panel"><h3>Publishing history</h3><div id="foxonDeliveryList"></div></section></details>';
  host.replaceChildren(root);
  const admin=document.createElement("section");admin.id="foxonDeveloperAdmin";admin.className="fc-admin-section";admin.hidden=true;host.append(admin);
  render();
 }
 function facebookPages(){
  return accounts.filter(account=>account.platform==="Facebook"&&account.created_by===user?.id&&["pending","connected","disconnected"].includes(account.connection_status));
 }
 function openFacebookPages(){
  if($("foxonFacebookPages"))return;
  const dialog=document.createElement("dialog");
  dialog.id="foxonFacebookPages";
  dialog.setAttribute("aria-labelledby","foxonFacebookPagesTitle");
  const pages=facebookPages();
  dialog.innerHTML='<form><h2 id="foxonFacebookPagesTitle">Facebook Pages</h2><p>Choose which Pages Studio can use. Unchecked Pages stay available here.</p><fieldset><legend>Available Pages</legend>'+pages.map(page=>'<div><label><input type="checkbox" name="facebookPage" value="'+escapeHtml(page.id)+'" '+(page.connection_status==="connected"?'checked':'')+'> '+escapeHtml(page.display_name)+'</label></div>').join('')+'</fieldset><p role="status" data-page-status></p><div class="dialogActions"><button type="button" data-find-pages>Find more Pages</button><button type="button" data-cancel-pages>Cancel</button><button type="submit">Save Pages</button></div></form>';
  document.body.append(dialog);
  dialog.addEventListener("close",()=>dialog.remove(),{once:true});
  dialog.querySelector("[data-cancel-pages]").onclick=()=>dialog.close();
  dialog.querySelector("[data-find-pages]").onclick=()=>{dialog.close();void connect("Facebook");};
  const form=dialog.querySelector("form");
  form.onsubmit=async event=>{
   event.preventDefault();
   const submit=form.querySelector('[type="submit"]');
   submit.disabled=true;
   try{
    const ids=new FormData(form).getAll("facebookPage");
    await connectorRequest({action:"select_facebook_pages",ids});
    dialog.close();
    await load();
    setMessage(ids.length?ids.length+" Facebook "+(ids.length===1?"Page selected.":"Pages selected."):"No Facebook Pages selected.");
   }catch{
    dialog.querySelector("[data-page-status]").textContent="Could not save your selection. Please try again.";
   }finally{submit.disabled=false;}
  };
  dialog.showModal();
 }
 function render(){
  const cards=$("foxonSocialCards");if(!cards)return;
  cards.innerHTML=platforms.map(p=>{
   const connected=accounts.filter(a=>a.platform===p.name&&a.connection_status==="connected");
   const ready=connected.length>0;
   const mark={Facebook:"f",Instagram:"◎",LinkedIn:"in"}[p.name];
   return '<article class="fc-account-card"><div class="fc-card-top"><span class="fc-mark fc-mark-'+p.name.toLowerCase()+'" aria-hidden="true">'+mark+'</span><span class="fc-connection-status'+(ready?' is-connected':'')+'">'+(ready?'✓ Connected':'Not connected')+'</span></div><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.help)+'</p>'+(ready?'<small>'+connected.map(a=>escapeHtml(a.display_name)).join(", ")+'</small>':'')+'<button type="button" data-fc-action="'+escapeHtml(p.name)+'">'+((ready||(p.name==='Facebook'&&role==='admin'&&facebookPages().length))?'View account':'Add '+escapeHtml(p.name))+'</button></article>';
  }).join("");
  cards.querySelectorAll("[data-fc-action]").forEach(button=>button.addEventListener("click",()=>accountAction(button.dataset.fcAction)));
  const admin=$("foxonDeveloperAdmin");if(admin){
   admin.hidden=role!=="admin";
   admin.innerHTML=role==="admin"?'<details id="foxonAdminDetails"><summary>FOXON platform setup</summary><p>FOXON configures the social network integrations for the service. Customers should not need developer accounts or technical setup.</p><div id="foxonAdminHelp"></div></details>':"";
  }
  const tools=$("foxonConnectedTools");if(tools)tools.hidden=!accounts.some(a=>a.connection_status==="connected");
  renderReadyPosts();
  renderQueue();
  const log=$("foxonDeliveryList");if(log)log.innerHTML=deliveries.length?'<div class="foxon-delivery-table"><table><thead><tr><th>Post</th><th>Platform</th><th>Status</th><th>Sent</th></tr></thead><tbody>'+deliveries.map(d=>{
   const account=accounts.find(a=>a.id===d.social_account_id),post=posts.find(p=>p.id===d.post_id);
   return '<tr><td>'+escapeHtml(post?.title||"Post")+'</td><td>'+escapeHtml(account?.platform||"Platform")+'</td><td>'+escapeHtml(d.status)+'</td><td>'+escapeHtml(d.published_at?new Date(d.published_at).toLocaleString("en-GB"):"Not published")+'</td></tr>';
  }).join("")+'</tbody></table></div>':'<p>No activity yet.</p>';
 }
 async function accountAction(platform){
  if(platform==="Facebook"&&role==="admin"&&facebookPages().length){openFacebookPages();return;}
  const existing=accounts.filter(a=>a.platform===platform&&a.connection_status==="connected");
  if(existing.length){setMessage(platform+' connected: '+existing.map(a=>a.display_name).join(', '));return;}
  if(role!=="admin"){setMessage("Account connection is not yet enabled for your access level. FOXON is working on making this a simple sign-in for every user.");return;}
  await connect(platform);
 }
 function liveScheduleFor(postId){return schedules.find(x=>x.post_id===postId&&LIVE_SCHEDULE.includes(x.status));}
 function renderReadyPosts(){
  const root=$("foxonPublishCandidates");if(!root)return;
  const eligible=posts.filter(p=>p.status==="approved"&&accounts.some(a=>a.platform===p.channel&&a.connection_status==="connected")&&!deliveries.some(d=>d.post_id===p.id)&&!liveScheduleFor(p.id));
  if(!eligible.length){root.innerHTML='<p class="foxon-social-empty">No posts currently qualify. Connect an account and approve individual posts before they become available here.</p>';return;}
  const day=tomorrowUk();
  root.innerHTML=eligible.map(p=>{
   const choices=accounts.filter(a=>a.platform===p.channel&&a.connection_status==="connected");
   const limited=["Carousel","Reel","Video"].includes(p.format);
   const noSchedule=p.channel==="Instagram";
   const id=escapeHtml(p.id);
   return '<article class="foxon-ready-row"><div><strong>'+escapeHtml(p.title)+'</strong><small>'+escapeHtml(p.channel)+' · '+escapeHtml(p.format||"Text-led")+(p.media_id?' · 1 image':'')+'</small>'+(limited?'<p>Format not yet supported by the direct publisher.</p>':'')+(noSchedule?'<p>Instagram scheduling is switched off.</p>':'')+'</div><label>Destination<select data-destination="'+id+'">'+choices.map(a=>'<option value="'+escapeHtml(a.id)+'">'+escapeHtml(a.display_name)+'</option>').join("")+'</select></label><label>UK date<input type="date" data-schedule-date="'+id+'" value="'+day+'"></label><label>UK time<input type="time" step="60" data-schedule-time="'+id+'" value="'+DEFAULT_UK_TIME+'"></label><button type="button" data-schedule="'+id+'" '+(limited||noSchedule||!schedulingReady?'disabled':'')+'>Schedule</button><button type="button" data-publish="'+id+'" '+(limited?'disabled':'')+'>Publish now</button></article>';
  }).join("")+(schedulingReady?'':'<p class="foxon-social-empty">Scheduling isn’t switched on in the database yet. Publish now still works.</p>');
  root.querySelectorAll("[data-publish]").forEach(b=>b.addEventListener("click",()=>publishNow(b.dataset.publish)));
  root.querySelectorAll("[data-schedule]").forEach(b=>b.addEventListener("click",()=>schedulePost(b.dataset.schedule)));
 }
 const field=(attr,id)=>[...document.querySelectorAll("#foxonPublishCandidates ["+attr+"]")].find(el=>el.getAttribute(attr)===id);
 async function invokePublisher(body){
  const {data,error}=await db.functions.invoke("foxon-social-publish",{body});
  if(error){
   let code="";
   try{code=(await error.context?.json?.())?.error||"";}catch{}
   throw Error(code||error.message||"publisher_unavailable");
  }
  if(data?.error)throw Error(data.error);
  return data;
 }
 async function publishNow(id){
  if(role!=="admin")return;
  const post=posts.find(p=>p.id===id);
  const account=accounts.find(a=>a.id===field("data-destination",id)?.value);
  if(!post||!account||account.connection_status!=="connected")return;
  const answer=window.prompt('You are about to PUBLISH "'+post.title+'" to '+account.display_name+' NOW. Type PUBLISH to confirm. This cannot be undone automatically.');
  if(answer!=="PUBLISH"){setMessage("Publishing cancelled; no network request sent.");return;}
  setMessage("Sending approved post to "+account.display_name+"…");
  const buttons=[...document.querySelectorAll("#foxonPublishCandidates button")];buttons.forEach(b=>b.disabled=true);
  try{
   const data=await invokePublisher({action:"publish",post_id:id,social_account_id:account.id});
   if(!data?.success||data.status!=="published"||!data.external_post_id)throw Error("No confirmed platform post ID returned.");
   await load();
   setMessage("Published successfully to "+account.display_name+". Provider post ID: "+data.external_post_id);
  }catch(e){
   await load();
   setMessage("Publishing was not confirmed: "+friendly(e.message)+". Check the platform and delivery log before retrying to avoid duplicates.");
  }finally{buttons.forEach(b=>b.disabled=false);}
 }
 function confirmSchedule(title,account,iso,verb){
  // The typed PUBLISH confirmation is the scheduling confirmation too.
  return window.prompt('You are about to '+verb+' "'+title+'" to PUBLISH on '+account+' at '+formatUk(iso)+' (UK time). Type PUBLISH to confirm.')==="PUBLISH";
 }
 async function schedulePost(id){
  if(role!=="admin")return;
  const post=posts.find(p=>p.id===id);
  const account=accounts.find(a=>a.id===field("data-destination",id)?.value);
  if(!post||!account||account.connection_status!=="connected")return;
  const iso=ukLocalToUtcIso(field("data-schedule-date",id)?.value,field("data-schedule-time",id)?.value||DEFAULT_UK_TIME);
  const problem=iso?scheduleWindowError(iso):"invalid_time";
  if(problem){setMessage(friendly(problem));return;}
  if(!confirmSchedule(post.title,account.display_name,iso,"schedule")){setMessage("Scheduling cancelled; nothing was queued.");return;}
  try{
   await invokePublisher({action:"schedule",post_id:id,social_account_id:account.id,scheduled_for:iso,confirm:"PUBLISH"});
   await load();
   setMessage('Scheduled "'+post.title+'" for '+formatUk(iso)+" on "+account.display_name+".");
  }catch(e){await load();setMessage("Not scheduled: "+friendly(e.message));}
 }
 function renderQueue(){
  const root=$("foxonScheduleQueue");if(!root)return;
  if(!schedulingReady){root.innerHTML='<p>Scheduling isn’t switched on in the database yet.</p>';return;}
  const active=schedules.filter(x=>["scheduled","sending","failed","needs_reconciliation"].includes(x.status)).sort((a,b)=>Date.parse(a.scheduled_for)-Date.parse(b.scheduled_for));
  const recent=schedules.filter(x=>["published","cancelled"].includes(x.status)).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)).slice(0,10);
  const rows=[...active,...recent];
  if(!rows.length){root.innerHTML='<p>Nothing scheduled.</p>';return;}
  root.innerHTML='<div class="foxon-delivery-table"><table><thead><tr><th>Post</th><th>Account</th><th>UK time</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+rows.map(x=>{
   const post=posts.find(p=>p.id===x.post_id),account=accounts.find(a=>a.id===x.social_account_id);
   const id=escapeHtml(x.id);let actions="";
   if(role==="admin"){
    if(x.status==="scheduled")actions='<button type="button" data-queue-edit="'+id+'">Edit</button> <button type="button" data-queue-cancel="'+id+'">Cancel</button>';
    else if(x.status==="failed")actions='<button type="button" data-queue-edit="'+id+'">Pick a new time</button>';
    else if(x.status==="needs_reconciliation")actions='<button type="button" data-queue-posted="'+id+'">It posted</button> <button type="button" data-queue-not-posted="'+id+'">It didn’t post</button>';
   }
   let detail="";
   if(x.status==="scheduled"&&x.attempts>0)detail='Retry '+(x.attempts+1)+' of '+x.max_attempts+' at '+formatUk(x.next_attempt_at)+'. ';
   if(x.last_error&&x.status!=="published")detail+=x.last_error;
   if(x.status==="published"&&x.external_post_id)detail="Provider post ID: "+x.external_post_id;
   return '<tr data-queue-status="'+escapeHtml(x.status)+'"><td>'+escapeHtml(post?.title||"Post")+'</td><td>'+escapeHtml(account?(account.platform+" · "+account.display_name):"Account")+'</td><td>'+escapeHtml(formatUk(x.scheduled_for))+'</td><td><strong>'+escapeHtml(SCHEDULE_LABEL[x.status]||x.status)+'</strong>'+(detail?'<br><small>'+escapeHtml(detail)+'</small>':'')+'</td><td>'+actions+'</td></tr>';
  }).join("")+'</tbody></table></div>';
  root.querySelectorAll("[data-queue-edit]").forEach(b=>b.addEventListener("click",()=>editSchedule(b.dataset.queueEdit)));
  root.querySelectorAll("[data-queue-cancel]").forEach(b=>b.addEventListener("click",()=>cancelSchedule(b.dataset.queueCancel)));
  root.querySelectorAll("[data-queue-posted]").forEach(b=>b.addEventListener("click",()=>resolveSchedule(b.dataset.queuePosted,"posted")));
  root.querySelectorAll("[data-queue-not-posted]").forEach(b=>b.addEventListener("click",()=>resolveSchedule(b.dataset.queueNotPosted,"not_posted")));
 }
 function editSchedule(id){
  const x=schedules.find(s=>s.id===id);if(!x||$("foxonScheduleEdit"))return;
  const post=posts.find(p=>p.id===x.post_id);
  const choices=accounts.filter(a=>a.platform===post?.channel&&a.connection_status==="connected");
  const when=utcIsoToUkParts(x.status==="failed"?new Date(Date.now()+86400000).toISOString():x.scheduled_for);
  const dialog=document.createElement("dialog");dialog.id="foxonScheduleEdit";dialog.setAttribute("aria-labelledby","foxonScheduleEditTitle");
  dialog.innerHTML='<form><h2 id="foxonScheduleEditTitle">'+(x.status==="failed"?"Requeue":"Edit")+' scheduled post</h2><p><strong>'+escapeHtml(post?.title||"Post")+'</strong></p><p>To change the words or image, edit the post itself; the latest approved version is sent.</p><label>Destination<select name="account">'+choices.map(a=>'<option value="'+escapeHtml(a.id)+'" '+(a.id===x.social_account_id?'selected':'')+'>'+escapeHtml(a.display_name)+'</option>').join("")+'</select></label><label>UK date<input type="date" name="date" required value="'+when.date+'"></label><label>UK time<input type="time" step="60" name="time" required value="'+when.time+'"></label><p role="status" data-edit-status></p><div class="dialogActions"><button type="button" data-edit-close>Close</button><button type="submit">Save</button></div></form>';
  document.body.append(dialog);
  dialog.addEventListener("close",()=>dialog.remove(),{once:true});
  dialog.querySelector("[data-edit-close]").onclick=()=>dialog.close();
  const form=dialog.querySelector("form"),status=dialog.querySelector("[data-edit-status]");
  form.onsubmit=async event=>{
   event.preventDefault();
   const values=new FormData(form);
   const iso=ukLocalToUtcIso(values.get("date"),values.get("time"));
   const problem=iso?scheduleWindowError(iso):"invalid_time";
   if(problem){status.textContent=friendly(problem);return;}
   const account=accounts.find(a=>a.id===values.get("account"));
   if(!account||!confirmSchedule(post?.title||"Post",account.display_name,iso,"reschedule")){status.textContent="Not changed.";return;}
   try{
    await invokePublisher({action:"reschedule",schedule_id:id,social_account_id:account.id,scheduled_for:iso,confirm:"PUBLISH"});
    dialog.close();await load();setMessage("Rescheduled for "+formatUk(iso)+".");
   }catch(e){status.textContent="Not changed: "+friendly(e.message);}
  };
  dialog.showModal();
 }
 async function cancelSchedule(id){
  const x=schedules.find(s=>s.id===id),post=posts.find(p=>p.id===x?.post_id);
  if(!x||!window.confirm('Cancel the scheduled post "'+(post?.title||"Post")+'" for '+formatUk(x.scheduled_for)+'? Nothing will be sent.'))return;
  try{await invokePublisher({action:"cancel",schedule_id:id});await load();setMessage("Scheduled post cancelled. Nothing was sent.");}
  catch(e){await load();setMessage("Not cancelled: "+friendly(e.message));}
 }
 async function resolveSchedule(id,outcome){
  let external="";
  if(outcome==="posted"){
   const answer=window.prompt("You checked the platform and the post IS live. Optional: paste its post ID or link, then press OK.");
   if(answer===null)return;external=answer;
  }else if(!window.confirm("You checked the platform and the post is NOT there? This closes the entry. To try again, duplicate the post (this prevents double posting)."))return;
  try{await invokePublisher({action:"resolve",schedule_id:id,outcome,external_post_id:external});await load();setMessage("Recorded. Thank you for checking.");}
  catch(e){setMessage("Not recorded: "+friendly(e.message));}
 }
 function keepQueueFresh(){
  const busy=schedules.some(x=>x.status==="sending"||(x.status==="scheduled"&&Date.parse(x.next_attempt_at)-Date.now()<10*60000));
  if(busy&&!refreshTimer)refreshTimer=setInterval(()=>{if(document.visibilityState==="visible")void load();},30000);
  if(!busy&&refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}
 }
 function showSetup(platform){
  if(role!=="admin")return;
  const details=$("foxonAdminDetails"),help=$("foxonAdminHelp");if(!details||!help)return;
  details.open=true;
  const url=platform==="LinkedIn"?"https://www.linkedin.com/developers/apps":"https://developers.facebook.com/apps/";
  help.innerHTML='<h4>'+escapeHtml(platform)+' · Administrator setup</h4><p>FOXON configures this provider once for the whole platform. Customers will sign in to their own social accounts; they will not create developer apps.</p><p><a href="'+url+'" target="_blank" rel="noopener noreferrer">Open provider setup</a></p><p><a href="https://github.com/four2d/vuba-wiltshire-studio/blob/main/foxon-studio/DIRECT-SOCIAL-CONNECTIONS.md" target="_blank" rel="noopener noreferrer">Step-by-step instructions</a></p>';
  details.scrollIntoView({block:"nearest"});
 }
 function requestAccess(platform){
  const message="Please connect "+platform+" in FOXON Studio. A Studio administrator needs to authorise this account once.";
  if(!navigator.clipboard?.writeText){setMessage(message);return;}
  navigator.clipboard.writeText(message).then(()=>setMessage("Request copied — send it to your Studio administrator.")).catch(()=>setMessage(message));
 }
 async function connectorRequest(body){
  const {data,error}=await db.functions.invoke("foxon-social-oauth",{body});
  if(error?.context?.status===409)throw Error("Studio is still being set up for this social network. Please try again later.");
  if(error)throw Error(error.message||"Social authorisation unavailable.");
  if(data?.error)throw Error(data.error);
  return data;
 }
 async function connect(platform){
  if(role!=="admin"||connecting)return;
  connecting=true;
  setMessage("Opening official "+platform+" account authorisation…");
  try{
   const data=await connectorRequest({action:"begin",platform});
   if(!data?.authorization_url)throw Error("No authorisation URL was returned.");
   const url=new URL(data.authorization_url);
   if(!["www.facebook.com","www.linkedin.com"].includes(url.hostname)||url.protocol!=="https:")throw Error("Unexpected authorisation destination.");
   window.location.assign(url.toString());
  }catch(e){setMessage("Could not start "+platform+" connection: "+(e.message||String(e)));}
  finally{connecting=false;}
 }
 async function load(){
  if(!user||!$("foxonSocialAccounts"))return;
  if(!connecting)setMessage("Checking your accounts…");
  const [ac,delivery,post,queue]=await Promise.all([
   db.from("studio_social_accounts").select("id,platform,display_name,connection_status,last_error,connected_at,created_by").order("platform"),
   db.from("studio_publish_deliveries").select("id,post_id,social_account_id,status,published_at,last_error").order("created_at",{ascending:false}).limit(60),
   db.from("studio_posts").select("id,title,status,channel,format,caption,source_notes,media_id").limit(500),
   db.from("studio_publish_schedules").select("id,post_id,social_account_id,scheduled_for,status,attempts,max_attempts,next_attempt_at,last_error,external_post_id,published_at,updated_at").order("scheduled_for",{ascending:true}).limit(200)
  ]);
  if(ac.error||delivery.error){setMessage("Account status unavailable: "+(ac.error||delivery.error).message);return;}
  accounts=ac.data||[];deliveries=delivery.data||[];posts=post.data||[];
  // Before the scheduling migration is applied the table does not exist: keep Publish now working.
  schedulingReady=!queue.error;schedules=queue.error?[]:(queue.data||[]);
  render();
  keepQueueFresh();
  const count=accounts.filter(a=>a.connection_status==="connected").length;
  const notice=new URLSearchParams(window.location.search).get("social_connect");
  if(connecting)return;
  if(notice==="facebook_pages_ready"){setMessage("Facebook Pages found. Choose View account to select the Pages Studio can use.");return;}
  if(notice==="cancelled"){setMessage("Connection cancelled. Choose Add account to try again.");return;}
  if(notice&&notice!=="connected"){setMessage("The account could not be connected. Choose Add account to try again.");return;}
  setMessage(count?count+" account"+(count===1?"":"s")+" ready to use.":"");
 }
 async function init(u){
  user=u;
  if(!u){if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}$("foxonFacebookPages")?.close();$("foxonSocialAccounts")?.remove();$("foxonFutureConnections")?.remove();$("foxonDeveloperAdmin")?.remove();return;}
  const m=await db.from("studio_members").select("role").eq("user_id",u.id).maybeSingle();
  if(m.error||!m.data)return;
  role=m.data.role;
  for(let i=0;i<45&&!$("foxonConnectionWorkspace");i++)await new Promise(r=>setTimeout(r,100));
  mount();await load();
  window.FOXONSocialAccounts={refresh:load};
 }
 db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>init(session?.user||null),0));
 db.auth.getSession().then(({data})=>init(data.session?.user||null));
}
