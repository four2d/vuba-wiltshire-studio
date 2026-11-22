/* FOXON direct social-account administration foundation.
   Read-only pending official Meta/LinkedIn authorisation; no credentials in browser. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const config=window.VUBA_CONFIG||{};
if(config.supabaseUrl&&config.supabaseAnonKey){
 const db=createClient(config.supabaseUrl,config.supabaseAnonKey);
 const $=id=>document.getElementById(id);
 const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const platforms=[
  {name:"Facebook",label:"FOXON Facebook Page",url:"https://developers.facebook.com/apps/",help:"Meta app, Pages access, official login authorisation"},
  {name:"Instagram",label:"FOXON Instagram Professional",url:"https://developers.facebook.com/apps/",help:"Professional Instagram account and appropriate Meta permissions"},
  {name:"LinkedIn",label:"FOXON LinkedIn Company Page",url:"https://www.linkedin.com/developers/apps",help:"LinkedIn developer app and approved Community Management access"}
 ];
 let user=null,role="",accounts=[],deliveries=[],posts=[],providerReady={},providerError="";
 function setMessage(message){const el=$("foxonSocialStatus");if(el)el.textContent=message;}
 function mount(){
  const hq=$("hqPublishing");if(!hq||$("foxonSocialAccounts"))return;
  const root=document.createElement("section");
  root.id="foxonSocialAccounts";root.className="foxon-social-accounts";
  root.innerHTML='<div class="foxon-social-heading"><div><small>DIRECT NETWORK CONNECTIONS</small><h3>FOXON accounts</h3><p>Manage all three channels from FOXON Studio. No third-party scheduler subscription.</p></div><button type="button" id="foxonSocialRefresh">Refresh connections</button></div><p id="foxonSocialStatus" role="status"></p><div id="foxonSocialCards" class="foxon-social-cards"></div><div class="foxon-delivery-panel"><div class="foxon-social-heading"><div><h4>Publishing delivery log</h4><p>Only successful network API confirmation counts as published.</p></div></div><div id="foxonDeliveryList"></div></div><p class="foxon-social-disclaimer">Social credentials are never entered or stored in this browser. The official account authorisation and server-side publishing service must be configured before live connection or posting is enabled.</p>';
  hq.insertAdjacentElement("afterbegin",root);
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
   const connectionAction=ready?'<button type="button" data-social-connect="'+escapeHtml(p.name)+'">Connect '+escapeHtml(p.name)+' securely</button>':'<span class="foxon-social-setup-note">'+(role!=="admin"?"An admin must connect this account.":providerError?"Authorisation service needs attention.":"Developer authorisation needs setting up first.")+"</span>";
   const items=found.map(a=>'<li>'+escapeHtml(a.display_name)+' <span>('+escapeHtml(a.connection_status)+')</span></li>').join("");
   return '<article class="foxon-social-card"><div class="foxon-social-card-header"><strong>'+escapeHtml(p.label)+'</strong><span class="foxon-connection-state" data-state="'+escapeHtml(state)+'">'+escapeHtml(state)+'</span></div><p>'+escapeHtml(p.help)+'</p>'+(items?'<ul>'+items+'</ul>':'<p>Account authorisation has not been completed.</p>')+'<a href="'+p.url+'" target="_blank" rel="noopener noreferrer">Set up '+escapeHtml(p.name)+' developer access</a>'+connectionAction+'</article>';
  }).join("");
  cards.querySelectorAll("[data-social-connect]").forEach(b=>b.addEventListener("click",()=>connect(b.dataset.socialConnect)));
  const log=$("foxonDeliveryList");if(log)log.innerHTML=deliveries.length?'<div class="foxon-delivery-table"><table><thead><tr><th>Post</th><th>Platform</th><th>Status</th><th>Sent</th></tr></thead><tbody>'+deliveries.map(d=>{
    const account=accounts.find(a=>a.id===d.social_account_id),post=posts.find(p=>p.id===d.post_id);
    return '<tr><td>'+escapeHtml(post?.title||"Unknown post")+'</td><td>'+escapeHtml(account?.platform||"Unknown platform")+'</td><td>'+escapeHtml(d.status)+'</td><td>'+escapeHtml(d.published_at?new Date(d.published_at).toLocaleString("en-GB"):"Not published")+'</td></tr>';
  }).join("")+'</tbody></table></div>':'<p class="foxon-social-empty">No platform delivery records yet. Internal draft/scheduled posts are not proof of external publication.</p>';
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
   db.from("studio_posts").select("id,title").limit(500),
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
  if(!u){$("foxonSocialAccounts")?.remove();return;}
  const m=await db.from("studio_members").select("role").eq("user_id",u.id).maybeSingle();
  if(m.error||!m.data)return;
  role=m.data.role;
  for(let i=0;i<45&&!$("hqPublishing");i++)await new Promise(r=>setTimeout(r,100));
  mount();await load();
 }
 db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>init(session?.user||null),0));
 db.auth.getSession().then(({data})=>init(data.session?.user||null));
}
