/* FOXON direct social-account administration foundation.
   Read-only pending official Meta/LinkedIn authorisation; no credentials in browser. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
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
 let user=null,role="",accounts=[],deliveries=[],posts=[],providerReady={},providerError="";
 function setMessage(message){const el=$("foxonSocialStatus");if(el)el.textContent=message;}
 function mount(){
  const host=$("foxonConnectionWorkspace");if(!host||$("foxonSocialAccounts"))return;
  const root=document.createElement("section");root.id="foxonSocialAccounts";root.className="foxon-social-accounts foxon-easy-connect";
  root.innerHTML='<header class="fc-welcome"><span class="fc-spark">✦</span><div><h2>Add your accounts</h2><p>Choose the places you want to post. Connect once, then use FOXON Studio for everything else.</p></div></header><div id="foxonSocialCards" class="fc-primary-cards"></div><p id="foxonSocialStatus" role="status" aria-live="polite" class="fc-friendly-status"></p><p class="fc-reassurance">✓ Your passwords stay with Facebook, Instagram and LinkedIn.</p><details id="foxonConnectedTools" class="fc-optional-details" hidden><summary>Posts and activity</summary><section class="foxon-direct-publish"><h3>Approved posts</h3><div id="foxonPublishCandidates"></div></section><section class="foxon-delivery-panel"><h3>Publishing history</h3><div id="foxonDeliveryList"></div></section></details>';
  host.replaceChildren(root);
  const admin=document.createElement("section");admin.id="foxonDeveloperAdmin";admin.className="fc-admin-section";admin.hidden=true;host.append(admin);
  render();
 }
 function render(){
  const cards=$("foxonSocialCards");if(!cards)return;
  cards.innerHTML=platforms.map(p=>{
   const connected=accounts.filter(a=>a.platform===p.name&&a.connection_status==="connected");
   const ready=connected.length>0;
   const mark={Facebook:"f",Instagram:"◎",LinkedIn:"in"}[p.name];
   return '<article class="fc-account-card"><div class="fc-card-top"><span class="fc-mark fc-mark-'+p.name.toLowerCase()+'" aria-hidden="true">'+mark+'</span><span class="fc-connection-status'+(ready?' is-connected':'')+'">'+(ready?'✓ Connected':'Not connected')+'</span></div><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.help)+'</p>'+(ready?'<small>'+connected.map(a=>escapeHtml(a.display_name)).join(", ")+'</small>':'')+'<button type="button" data-fc-action="'+escapeHtml(p.name)+'">'+(ready?'View account':'Add '+escapeHtml(p.name))+'</button></article>';
  }).join("");
  cards.querySelectorAll("[data-fc-action]").forEach(button=>button.addEventListener("click",()=>accountAction(button.dataset.fcAction)));
  const admin=$("foxonDeveloperAdmin");if(admin){
   admin.hidden=role!=="admin";
   admin.innerHTML=role==="admin"?'<details id="foxonAdminDetails"><summary>FOXON platform setup</summary><p>FOXON configures the social network integrations for the service. Customers should not need developer accounts or technical setup.</p><div id="foxonAdminHelp"></div></details>':"";
  }
  const tools=$("foxonConnectedTools");if(tools)tools.hidden=!accounts.some(a=>a.connection_status==="connected");
  renderReadyPosts();
  const log=$("foxonDeliveryList");if(log)log.innerHTML=deliveries.length?'<div class="foxon-delivery-table"><table><thead><tr><th>Post</th><th>Platform</th><th>Status</th><th>Sent</th></tr></thead><tbody>'+deliveries.map(d=>{
   const account=accounts.find(a=>a.id===d.social_account_id),post=posts.find(p=>p.id===d.post_id);
   return '<tr><td>'+escapeHtml(post?.title||"Post")+'</td><td>'+escapeHtml(account?.platform||"Platform")+'</td><td>'+escapeHtml(d.status)+'</td><td>'+escapeHtml(d.published_at?new Date(d.published_at).toLocaleString("en-GB"):"Not published")+'</td></tr>';
  }).join("")+'</tbody></table></div>':'<p>No activity yet.</p>';
 }
 async function accountAction(platform){
  const existing=accounts.filter(a=>a.platform===platform&&a.connection_status==="connected");
  if(existing.length){setMessage(platform+' connected: '+existing.map(a=>a.display_name).join(', '));return;}
  if(role!=="admin"){setMessage("Account connection is not yet enabled for your access level. FOXON is working on making this a simple sign-in for every user.");return;}
  if(providerReady[platform]){await connect(platform);return;}
  setMessage("We're getting "+platform+" ready for FOXON Studio. Nothing you need to log into elsewhere just yet.");
  // Keep developer setup out of the ordinary Add account flow. The owner can open settings separately.
 }
 function renderReadyPosts(){
  const root=$("foxonPublishCandidates");if(!root)return;
  const eligible=posts.filter(p=>p.status==="approved"&&accounts.some(a=>a.platform===p.channel&&a.connection_status==="connected")&&!deliveries.some(d=>d.post_id===p.id));
  if(!eligible.length){root.innerHTML='<p class="foxon-social-empty">No posts currently qualify. Connect an account and approve individual posts before they become available here.</p>';return;}
  root.innerHTML=eligible.map(p=>{
   const choices=accounts.filter(a=>a.platform===p.channel&&a.connection_status==="connected");
   const limited=["Carousel","Reel","Video"].includes(p.format)||p.channel==="LinkedIn"&&!!p.media_id;
   return '<article class="foxon-ready-row"><div><strong>'+escapeHtml(p.title)+'</strong><small>'+escapeHtml(p.channel)+' · '+escapeHtml(p.format||"Text-led")+'</small>'+(limited?'<p>Format not yet supported by the direct publisher.</p>':'')+'</div><label>Destination<select data-destination="'+escapeHtml(p.id)+'">'+choices.map(a=>'<option value="'+escapeHtml(a.id)+'">'+escapeHtml(a.display_name)+'</option>').join("")+'</select></label><button type="button" data-publish="'+escapeHtml(p.id)+'" '+(limited?'disabled':'')+'>Publish now</button></article>';
  }).join("");
  root.querySelectorAll("[data-publish]").forEach(b=>b.addEventListener("click",()=>publishNow(b.dataset.publish)));
 }
 async function publishNow(id){
  if(role!=="admin")return;
  const post=posts.find(p=>p.id===id);
  const select=[...document.querySelectorAll("#foxonPublishCandidates [data-destination]")].find(el=>el.dataset.destination===id);
  const account=accounts.find(a=>a.id===select?.value);
  if(!post||!account||account.connection_status!=="connected")return;
  const answer=window.prompt('You are about to PUBLISH "'+post.title+'" to '+account.display_name+' NOW. Type PUBLISH to confirm. This cannot be undone automatically.');
  if(answer!=="PUBLISH"){setMessage("Publishing cancelled; no network request sent.");return;}
  setMessage("Sending approved post to "+account.display_name+"…");
  const buttons=[...document.querySelectorAll("#foxonPublishCandidates [data-publish]")];buttons.forEach(b=>b.disabled=true);
  try{
   const {data,error}=await db.functions.invoke("foxon-social-publish",{body:{action:"publish",post_id:id,social_account_id:account.id}});
   if(error||data?.error)throw Error(data?.error||error?.message||"Publisher did not confirm the post.");
   if(!data?.success||data.status!=="published"||!data.external_post_id)throw Error("No confirmed platform post ID returned.");
   await load();
   setMessage("Published successfully to "+account.display_name+". Provider post ID: "+data.external_post_id);
  }catch(e){
   await load();
   setMessage("Publishing was not confirmed: "+(e.message||String(e))+". Check the platform and delivery log before retrying to avoid duplicates.");
  }finally{buttons.forEach(b=>b.disabled=false);}
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
  if(error)throw Error(error.message||"Social authorisation unavailable.");
  if(data?.error)throw Error(data.error);
  return data;
 }
 async function connect(platform){
  if(role!=="admin"||!providerReady[platform])return;
  setMessage("Opening official "+platform+" account authorisation…");
  try{
   const data=await connectorRequest({action:"begin",platform});
   if(!data?.authorization_url)throw Error("No authorisation URL was returned.");
   const url=new URL(data.authorization_url);
   if(!["www.facebook.com","www.linkedin.com"].includes(url.hostname)||url.protocol!=="https:")throw Error("Unexpected authorisation destination.");
   window.location.assign(url.toString());
  }catch(e){setMessage("Could not start "+platform+" connection: "+(e.message||String(e)));}
 }
 async function load(){
  if(!user||!$("foxonSocialAccounts"))return;
  setMessage("Checking your accounts…");
  const [ac,delivery,post,provider]=await Promise.all([
   db.from("studio_social_accounts").select("id,platform,display_name,connection_status,last_error,connected_at").order("platform"),
   db.from("studio_publish_deliveries").select("id,post_id,social_account_id,status,published_at,last_error").order("created_at",{ascending:false}).limit(60),
   db.from("studio_posts").select("id,title,status,channel,format,caption,source_notes,media_id").limit(500),
   role==="admin"?connectorRequest({action:"status"}).catch(e=>({error:e.message})):Promise.resolve({platforms:{}})
  ]);
  providerReady=Object.fromEntries(Object.entries(provider?.platforms||{}).map(([name,config])=>[name,config.ready===true]));
  providerError=provider?.error||"";
  if(ac.error||delivery.error){setMessage("Account status unavailable: "+(ac.error||delivery.error).message);return;}
  accounts=ac.data||[];deliveries=delivery.data||[];posts=post.data||[];
  render();
  const count=accounts.filter(a=>a.connection_status==="connected").length;
  const notice=new URLSearchParams(window.location.search).get("social_connect");
  setMessage(count?count+" account"+(count===1?"":"s")+" ready to use.":notice?"Connection result: "+notice+".":"");
 }
 async function init(u){
  user=u;
  if(!u){$("foxonSocialAccounts")?.remove();$("foxonFutureConnections")?.remove();$("foxonDeveloperAdmin")?.remove();return;}
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
