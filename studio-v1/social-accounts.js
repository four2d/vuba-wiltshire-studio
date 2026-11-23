/* VUBA direct social-account administration foundation.
   Read-only pending official Meta/LinkedIn authorisation; no credentials in browser. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const config=window.VUBA_CONFIG||{};
if(config.supabaseUrl&&config.supabaseAnonKey){
 const db=createClient(config.supabaseUrl,config.supabaseAnonKey);
 const $=id=>document.getElementById(id);
 const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const platforms=[
  {name:"Facebook",label:"VUBA Facebook Page",url:"https://developers.facebook.com/apps/",help:"Publish approved posts to your Facebook Page."},
  {name:"Instagram",label:"VUBA Instagram Professional",url:"https://developers.facebook.com/apps/",help:"Share approved graphics to a professional Instagram account."},
  {name:"LinkedIn",label:"VUBA LinkedIn Company Page",url:"https://www.linkedin.com/developers/apps",help:"Publish company updates from your LinkedIn Page."}
 ];
 let user=null,role="",accounts=[],deliveries=[],posts=[],connecting=false;
 function setMessage(message){const el=$("vubaSocialStatus");if(el)el.textContent=message;}
 function mount(){
  const host=$("vubaConnectionWorkspace");if(!host||$("vubaSocialAccounts"))return;
  const root=document.createElement("section");root.id="vubaSocialAccounts";root.className="vuba-social-accounts vuba-easy-connect";
  root.innerHTML='<header class="fc-welcome"><span class="fc-spark">✦</span><div><h2>Add your accounts</h2><p>Choose an account below. Sign in on the social network, select the Page or account you want, then review the permissions. You’ll return here to see whether it connected.</p></div></header><div id="vubaSocialCards" class="fc-primary-cards"></div><p id="vubaSocialStatus" role="status" aria-live="polite" class="fc-friendly-status"></p><p class="fc-reassurance">✓ Your passwords stay with Facebook, Instagram and LinkedIn.</p><details id="vubaConnectedTools" class="fc-optional-details" hidden><summary>Posts and activity</summary><section class="vuba-direct-publish"><h3>Approved posts</h3><div id="vubaPublishCandidates"></div></section><section class="vuba-delivery-panel"><h3>Publishing history</h3><div id="vubaDeliveryList"></div></section></details>';
  host.replaceChildren(root);
  const admin=document.createElement("section");admin.id="vubaDeveloperAdmin";admin.className="fc-admin-section";admin.hidden=true;host.append(admin);
  render();
 }
 function facebookPages(){
  return accounts.filter(account=>account.platform==="Facebook"&&account.created_by===user?.id&&["pending","connected","disconnected"].includes(account.connection_status));
 }
 function openFacebookPages(){
  if($("vubaFacebookPages"))return;
  const dialog=document.createElement("dialog");
  dialog.id="vubaFacebookPages";
  dialog.setAttribute("aria-labelledby","vubaFacebookPagesTitle");
  const pages=facebookPages();
  dialog.innerHTML='<form><h2 id="vubaFacebookPagesTitle">Facebook Pages</h2><p>Choose which Pages Studio can use. Unchecked Pages stay available here.</p><fieldset><legend>Available Pages</legend>'+pages.map(page=>'<div><label><input type="checkbox" name="facebookPage" value="'+escapeHtml(page.id)+'" '+(page.connection_status==="connected"?'checked':'')+'> '+escapeHtml(page.display_name)+'</label></div>').join('')+'</fieldset><p role="status" data-page-status></p><div class="dialogActions"><button type="button" data-find-pages>Find more Pages</button><button type="button" data-cancel-pages>Cancel</button><button type="submit">Save Pages</button></div></form>';
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
  const cards=$("vubaSocialCards");if(!cards)return;
  cards.innerHTML=platforms.map(p=>{
   const connected=accounts.filter(a=>a.platform===p.name&&a.connection_status==="connected");
   const ready=connected.length>0;
   const mark={Facebook:"f",Instagram:"◎",LinkedIn:"in"}[p.name];
   return '<article class="fc-account-card"><div class="fc-card-top"><span class="fc-mark fc-mark-'+p.name.toLowerCase()+'" aria-hidden="true">'+mark+'</span><span class="fc-connection-status'+(ready?' is-connected':'')+'">'+(ready?'✓ Connected':'Not connected')+'</span></div><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.help)+'</p>'+(ready?'<small>'+connected.map(a=>escapeHtml(a.display_name)).join(", ")+'</small>':'')+'<button type="button" data-fc-action="'+escapeHtml(p.name)+'">'+((ready||(p.name==='Facebook'&&role==='admin'&&facebookPages().length))?'View account':'Add '+escapeHtml(p.name))+'</button></article>';
  }).join("");
  cards.querySelectorAll("[data-fc-action]").forEach(button=>button.addEventListener("click",()=>accountAction(button.dataset.fcAction)));
  const admin=$("vubaDeveloperAdmin");if(admin){
   admin.hidden=role!=="admin";
   admin.innerHTML=role==="admin"?'<details id="vubaAdminDetails"><summary>VUBA platform setup</summary><p>VUBA configures the social network integrations for the service. Customers should not need developer accounts or technical setup.</p><div id="vubaAdminHelp"></div></details>':"";
  }
  const tools=$("vubaConnectedTools");if(tools)tools.hidden=!accounts.some(a=>a.connection_status==="connected");
  renderReadyPosts();
  const log=$("vubaDeliveryList");if(log)log.innerHTML=deliveries.length?'<div class="vuba-delivery-table"><table><thead><tr><th>Post</th><th>Platform</th><th>Status</th><th>Sent</th></tr></thead><tbody>'+deliveries.map(d=>{
   const account=accounts.find(a=>a.id===d.social_account_id),post=posts.find(p=>p.id===d.post_id);
   return '<tr><td>'+escapeHtml(post?.title||"Post")+'</td><td>'+escapeHtml(account?.platform||"Platform")+'</td><td>'+escapeHtml(d.status)+'</td><td>'+escapeHtml(d.published_at?new Date(d.published_at).toLocaleString("en-GB"):"Not published")+'</td></tr>';
  }).join("")+'</tbody></table></div>':'<p>No activity yet.</p>';
 }
 async function accountAction(platform){
  if(platform==="Facebook"&&role==="admin"&&facebookPages().length){openFacebookPages();return;}
  const existing=accounts.filter(a=>a.platform===platform&&a.connection_status==="connected");
  if(existing.length){setMessage(platform+' connected: '+existing.map(a=>a.display_name).join(', '));return;}
  if(role!=="admin"){setMessage("Account connection is not yet enabled for your access level. VUBA is working on making this a simple sign-in for every user.");return;}
  await connect(platform);
 }
 function renderReadyPosts(){
  const root=$("vubaPublishCandidates");if(!root)return;
  const eligible=posts.filter(p=>p.status==="approved"&&accounts.some(a=>a.platform===p.channel&&a.connection_status==="connected")&&!deliveries.some(d=>d.post_id===p.id));
  if(!eligible.length){root.innerHTML='<p class="vuba-social-empty">No posts currently qualify. Connect an account and approve individual posts before they become available here.</p>';return;}
  root.innerHTML=eligible.map(p=>{
   const choices=accounts.filter(a=>a.platform===p.channel&&a.connection_status==="connected");
   const limited=["Carousel","Reel","Video"].includes(p.format)||p.channel==="LinkedIn"&&!!p.media_id;
   return '<article class="vuba-ready-row"><div><strong>'+escapeHtml(p.title)+'</strong><small>'+escapeHtml(p.channel)+' · '+escapeHtml(p.format||"Text-led")+'</small>'+(limited?'<p>Format not yet supported by the direct publisher.</p>':'')+'</div><label>Destination<select data-destination="'+escapeHtml(p.id)+'">'+choices.map(a=>'<option value="'+escapeHtml(a.id)+'">'+escapeHtml(a.display_name)+'</option>').join("")+'</select></label><button type="button" data-publish="'+escapeHtml(p.id)+'" '+(limited?'disabled':'')+'>Publish now</button></article>';
  }).join("");
  root.querySelectorAll("[data-publish]").forEach(b=>b.addEventListener("click",()=>publishNow(b.dataset.publish)));
 }
 async function publishNow(id){
  if(role!=="admin")return;
  const post=posts.find(p=>p.id===id);
  const select=[...document.querySelectorAll("#vubaPublishCandidates [data-destination]")].find(el=>el.dataset.destination===id);
  const account=accounts.find(a=>a.id===select?.value);
  if(!post||!account||account.connection_status!=="connected")return;
  const answer=window.prompt('You are about to PUBLISH "'+post.title+'" to '+account.display_name+' NOW. Type PUBLISH to confirm. This cannot be undone automatically.');
  if(answer!=="PUBLISH"){setMessage("Publishing cancelled; no network request sent.");return;}
  setMessage("Sending approved post to "+account.display_name+"…");
  const buttons=[...document.querySelectorAll("#vubaPublishCandidates [data-publish]")];buttons.forEach(b=>b.disabled=true);
  try{
   const {data,error}=await db.functions.invoke("vuba-social-publish",{body:{action:"publish",post_id:id,social_account_id:account.id}});
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
  const details=$("vubaAdminDetails"),help=$("vubaAdminHelp");if(!details||!help)return;
  details.open=true;
  const url=platform==="LinkedIn"?"https://www.linkedin.com/developers/apps":"https://developers.facebook.com/apps/";
  help.innerHTML='<h4>'+escapeHtml(platform)+' · Administrator setup</h4><p>VUBA configures this provider once for the whole platform. Customers will sign in to their own social accounts; they will not create developer apps.</p><p><a href="'+url+'" target="_blank" rel="noopener noreferrer">Open provider setup</a></p><p><a href="https://github.com/four2d/vuba-wiltshire-studio/blob/main/vuba-studio/DIRECT-SOCIAL-CONNECTIONS.md" target="_blank" rel="noopener noreferrer">Step-by-step instructions</a></p>';
  details.scrollIntoView({block:"nearest"});
 }
 function requestAccess(platform){
  const message="Please connect "+platform+" in VUBA Studio. A Studio administrator needs to authorise this account once.";
  if(!navigator.clipboard?.writeText){setMessage(message);return;}
  navigator.clipboard.writeText(message).then(()=>setMessage("Request copied — send it to your Studio administrator.")).catch(()=>setMessage(message));
 }
 async function connectorRequest(body){
  const {data,error}=await db.functions.invoke("vuba-social-oauth",{body});
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
  if(!user||!$("vubaSocialAccounts"))return;
  if(!connecting)setMessage("Checking your accounts…");
  const [ac,delivery,post]=await Promise.all([
   db.from("studio_social_accounts").select("id,platform,display_name,connection_status,last_error,connected_at,created_by").order("platform"),
   db.from("studio_publish_deliveries").select("id,post_id,social_account_id,status,published_at,last_error").order("created_at",{ascending:false}).limit(60),
   db.from("studio_posts").select("id,title,status,channel,format,caption,source_notes,media_id").limit(500)
  ]);
  if(ac.error||delivery.error){setMessage("Account status unavailable: "+(ac.error||delivery.error).message);return;}
  accounts=ac.data||[];deliveries=delivery.data||[];posts=post.data||[];
  render();
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
  if(!u){$("vubaFacebookPages")?.close();$("vubaSocialAccounts")?.remove();$("vubaFutureConnections")?.remove();$("vubaDeveloperAdmin")?.remove();return;}
  const m=await db.from("studio_members").select("role").eq("user_id",u.id).maybeSingle();
  if(m.error||!m.data)return;
  role=m.data.role;
  for(let i=0;i<45&&!$("vubaConnectionWorkspace");i++)await new Promise(r=>setTimeout(r,100));
  mount();await load();
  window.VUBASocialAccounts={refresh:load};
 }
 db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>init(session?.user||null),0));
 db.auth.getSession().then(({data})=>init(data.session?.user||null));
}
