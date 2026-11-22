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
  const hq=$("foxonConnectionWorkspace");if(!hq||$("foxonSocialAccounts"))return;
  const root=document.createElement("section");
  root.id="foxonSocialAccounts";root.className="foxon-social-accounts";
  root.innerHTML='<div class="foxon-social-heading"><div><small>DIRECT SOCIAL CHANNELS</small><h3>Publishing accounts</h3><p>Link your business Pages with provider-authorised sign-in. Connection status is checked against FOXON’s backend.</p></div><button type="button" id="foxonSocialRefresh">Refresh connections</button></div><p id="foxonSocialStatus" role="status"></p><div id="foxonSocialCards" class="foxon-social-cards"></div><section class="foxon-direct-publish"><div class="foxon-social-heading"><div><h4>Approved posts ready for direct publishing</h4><p>Publish now only after explicit confirmation. Future-dated automated scheduling is not enabled.</p></div></div><div id="foxonPublishCandidates"></div></section><div class="foxon-delivery-panel"><div class="foxon-social-heading"><div><h4>Publishing delivery log</h4><p>Only successful network API confirmation counts as published.</p></div></div><div id="foxonDeliveryList"></div></div><p class="foxon-social-disclaimer">Social credentials are never entered or stored in this browser. The official account authorisation and server-side publishing service must be configured before live connection or posting is enabled.</p>';
  hq.prepend(root);
  const admin=document.createElement("section");admin.id="foxonDeveloperAdmin";admin.className="foxon-developer-admin";admin.hidden=true;hq.append(admin);
  const extra=document.createElement("section");extra.id="foxonFutureConnections";extra.className="foxon-future-connections";
  extra.innerHTML='<div class="foxon-social-heading"><div><small>INTEGRATION CATALOGUE</small><h3>More services</h3><p>Potential future connections for your marketing and website workflow. These are not active integrations.</p></div></div><div class="foxon-future-grid">' + [
   ["YouTube","Videos, Shorts and performance reports"],
   ["TikTok","Short-form video publishing and insights"],
   ["Pinterest","Visual campaigns and Pins"],
   ["Google Business Profile","Business updates, posts and local visibility"],
   ["Google Analytics 4","Website visits, campaigns and conversions"],
   ["WordPress","Website articles and FOXON product updates"]
  ].map(([name,description])=>'<article class="foxon-future-card"><div><strong>'+escapeHtml(name)+'</strong><span>Not yet integrated</span></div><p>'+escapeHtml(description)+'</p><small>Requires a supported API connection and account authorisation.</small></article>').join("") + "</div>";
  hq.append(extra);
  $("foxonSocialRefresh").addEventListener("click",load);
  render();
 }
 function render(){
  const cards=$("foxonSocialCards");if(!cards)return;
  cards.innerHTML=platforms.map(p=>{
   const found=accounts.filter(a=>a.platform===p.name);
   const connected=found.filter(a=>a.connection_status==="connected");
   const state=connected.length?"Connected":found.length?"Needs attention":"Not connected";
   const ready=role==="admin"&&providerReady[p.name]===true;
   const connectionAction=ready?'<button type="button" data-social-connect="'+escapeHtml(p.name)+'">Connect '+escapeHtml(p.name)+'</button>':'<button type="button" disabled aria-disabled="true" title="One-time provider setup is not complete">Connect '+escapeHtml(p.name)+'</button><span class="foxon-social-setup-note">'+(role!=="admin"?"FOXON administrator will connect this account.":providerError?"Connection service needs attention.":"FOXON app setup pending — see Administrator setup below.")+"</span>";
   const items=found.map(a=>'<li>'+escapeHtml(a.display_name)+' <span>('+escapeHtml(a.connection_status)+')</span></li>').join("");
   return '<article class="foxon-social-card"><div class="foxon-social-card-header"><strong>'+escapeHtml(p.label)+'</strong><span class="foxon-connection-state" data-state="'+escapeHtml(state)+'">'+escapeHtml(state)+'</span></div><p>'+escapeHtml(p.help)+'</p>'+(items?'<ul>'+items+'</ul>':'<p>No account connected yet.</p>')+connectionAction+'</article>';
  }).join("");
  cards.querySelectorAll("[data-social-connect]").forEach(b=>b.addEventListener("click",()=>connect(b.dataset.socialConnect)));
  const adminArea=$("foxonDeveloperAdmin");
  if(adminArea){
   adminArea.hidden=role!=="admin";
   adminArea.innerHTML=role!=="admin"?"":'<details><summary>Administrator setup · one time only</summary><p>Ordinary team members do not need developer accounts. FOXON administrators register the FOXON application with each provider and configure server-side credentials once.</p><div class="foxon-admin-provider-links"><a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">Meta developer console</a><a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer">LinkedIn developer console</a><a href="https://github.com/four2d/vuba-wiltshire-studio/blob/main/foxon-studio/DIRECT-SOCIAL-CONNECTIONS.md" target="_blank" rel="noopener noreferrer">FOXON setup instructions</a></div><p>Provider approval and secure backend configuration are required before a Connect button can become active. Do not enter passwords or app secrets here.</p></details>';
  }
  renderReadyPosts();
  const log=$("foxonDeliveryList");if(log)log.innerHTML=deliveries.length?'<div class="foxon-delivery-table"><table><thead><tr><th>Post</th><th>Platform</th><th>Status</th><th>Sent</th></tr></thead><tbody>'+deliveries.map(d=>{
    const account=accounts.find(a=>a.id===d.social_account_id),post=posts.find(p=>p.id===d.post_id);
    return '<tr><td>'+escapeHtml(post?.title||"Unknown post")+'</td><td>'+escapeHtml(account?.platform||"Unknown platform")+'</td><td>'+escapeHtml(d.status)+'</td><td>'+escapeHtml(d.published_at?new Date(d.published_at).toLocaleString("en-GB"):"Not published")+'</td></tr>';
  }).join("")+'</tbody></table></div>':'<p class="foxon-social-empty">No platform delivery records yet. Internal draft/scheduled posts are not proof of external publication.</p>';
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
  setMessage("Checking FOXON's own account records…");
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
  setMessage(count?count+" provider-verified account connection(s) recorded. Check token access and posting permissions before use.":notice?"Connection returned: "+notice+". Check the provider setup and refresh.":"No social accounts connected yet. Meta and LinkedIn developer authorisation is required before live posting.");
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
