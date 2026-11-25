/* Vuba Wiltshire Connections: beginner-first, Vuba-only social accounts.
   No imported another brand credentials, fake connected states, or client secrets. */
import {createStudioClient,getStudioUser,onStudioAuth} from "./staff-auth.js";
const config=window.VUBA_CONFIG||{};
if(config.supabaseUrl&&config.supabaseAnonKey){
 const db=createStudioClient();
 const $=id=>document.getElementById(id);
 const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const providers=[
  {id:"Facebook",name:"Facebook",kind:"Vuba Wiltshire Page",symbol:"f",intro:"Share updates with local installers and customers."},
  {id:"Instagram",name:"Instagram",kind:"Vuba Wiltshire Instagram",symbol:"◎",intro:"Share finished projects, products and colour inspiration."},
  {id:"LinkedIn",name:"LinkedIn",kind:"Vuba Wiltshire Company Page",symbol:"in",intro:"Share trade news and updates with professional contacts."}
 ];
 let user=null,role="",accounts=[],busy=false,dialog=null,setupReady={Facebook:false,Instagram:false,LinkedIn:false};
 let sharedProviders={},sharedAccounts=[];
 function root(){return $("vubaConnectionWorkspace");}
 function say(text){const el=$("vubaConnectionMessage");if(el)el.textContent=text;}
 function showDialog(title,content,actions=""){
  if(!dialog){dialog=document.createElement("dialog");dialog.id="vubaConnectDialog";dialog.className="vuba-connect-dialog";document.body.append(dialog);}
  dialog.innerHTML='<div class="vc-dialog-head"><h2>'+escapeHtml(title)+'</h2><button type="button" data-close aria-label="Close">×</button></div><div class="vc-dialog-content">'+content+'</div>'+actions;
  dialog.querySelector("[data-close]").onclick=()=>dialog.close();
  if(!dialog.open)dialog.showModal();
 }
 function connected(platform){return [...accounts,...sharedAccounts].filter(a=>a.platform===platform);}
 function render(){
  const host=root();if(!host||!user)return;
  const count=providers.reduce((n,p)=>n+Number(connected(p.id).length>0),0);
  host.innerHTML='<section class="vc-layout" id="vubaSimpleConnections">'+
   '<header class="vc-intro"><div class="vc-kicker">VUBA WILTSHIRE · SOCIAL ACCOUNTS</div><h2>Your social accounts</h2><p>Connect once, then manage your Vuba pages here. No developer setup for your team.</p>'+
   '<div class="vc-summary" aria-label="Connection summary"><span class="vc-summary-dot"></span><strong>'+count+' of 3</strong> social networks connected</div></header>'+
   '<div class="vc-cards">'+providers.map(p=>{
    const list=connected(p.id),isConnected=list.length>0;
    const name=list.length?list.map(a=>escapeHtml(a.display_name||p.kind)).join(", "):"Not connected";
    return '<article class="vc-card" data-provider="'+p.id+'">'+
     '<div class="vc-card-head"><span class="vc-provider-mark vc-'+p.id.toLowerCase()+'" aria-hidden="true">'+p.symbol+'</span>'+
     '<span class="vc-status'+(isConnected?" vc-connected":"")+'">'+(isConnected?"Connected":"Not connected")+'</span></div>'+
     '<h3>'+p.name+'</h3><p class="vc-account-kind">'+escapeHtml(p.kind)+'</p><p>'+escapeHtml(p.intro)+'</p>'+
     (isConnected?'<p class="vc-account-name">'+name+'</p>':'')+
     '<button type="button" data-connect="'+p.id+'" class="vc-connect-button">'+(isConnected?"View account":"Add "+p.name)+'</button></article>';
   }).join("")+'</div>'+
   '<p id="vubaConnectionMessage" class="vc-message" role="status" aria-live="polite"></p>'+
   '<p class="vc-footnote">Your passwords stay with Facebook, Instagram and LinkedIn. Nothing publishes without an approved connection and a publishing action.</p>'+
   (role==="admin"?'<details class="vc-owner"><summary>Studio owner settings</summary><p>Provider connections are configured once for Vuba Wiltshire. Staff will only need to choose Add account and sign in.</p><div class="vc-owner-grid">'+providers.map(p=>'<div><strong>'+p.name+'</strong><span>'+(setupReady[p.id]?"Ready to connect":"Provider setup required")+'</span></div>').join("")+'</div><p>Availability is checked with the Studio connection service.</p><button type="button" id="vcCheckSetup">Check setup</button></details>':'')+
   '</section>';
  host.querySelectorAll("[data-connect]").forEach(b=>b.onclick=()=>selectProvider(b.dataset.connect));
  $("vcCheckSetup")?.addEventListener("click",()=>refresh(true));
 }
 async function selectProvider(platform){
  const p=providers.find(x=>x.id===platform);if(!p)return;
  const existing=connected(platform);
  if(sharedAccounts.some(a=>a.platform===platform)){
   const panel=$("studioConnectShared");
   if(panel){panel.open=true;panel.scrollIntoView({block:"nearest"});return;}
  }
  if(existing.length){
   showDialog(p.name+' account','<p><strong>Connected:</strong> '+existing.map(x=>escapeHtml(x.display_name||p.kind)).join(", ")+'</p><p>You can return here to check the connection. Disconnecting or publishing needs an authorised server action.</p>');
   return;
  }
  if(!setupReady[platform]){
   showDialog('Add '+p.name,
    '<p>Vuba Wiltshire is not yet authorised to connect '+p.name+' accounts.</p>'+
    '<p>Once the one-off Vuba owner setup is completed, everyone will simply choose <strong>Add '+p.name+'</strong>, sign in and select the right Page or account.</p>'+
    (role==="admin"?'<p>The account connection cannot be enabled until Vuba’s own provider credentials and secure OAuth backend are configured.</p>':'<p>Your Studio owner needs to finish the initial connection setup.</p>'));
   return;
  }
  if(busy)return;
  busy=true;say('Opening '+p.name+' sign-in…');
  try{
   const useShared=sharedProviders[platform]===true;
   const {data,error}=await db.functions.invoke(useShared?"studio-connect":"vuba-social-oauth",{
    body:useShared?{tenant:"vuba",action:"begin",platform}:{action:"begin",platform}
   });
   if(error||data?.error)throw Error(data?.error||error?.message||"Connection unavailable");
   const u=new URL(data.authorization_url);
   if(u.protocol!=="https:"||!["www.facebook.com","www.linkedin.com"].includes(u.hostname))throw Error("Invalid authorisation address");
   window.location.assign(u.href);
  }catch{
   say(p.name+' connection is not ready yet. Your existing Vuba posts are unaffected.');
  }finally{busy=false;}
 }
 async function refresh(notify=false){
  if(!user)return;
  const currentUser=user;
  const [legacy,shared]=await Promise.allSettled([
   db.functions.invoke("vuba-social-oauth",{body:{action:"status"}}),
   db.functions.invoke("studio-connect",{body:{tenant:"vuba",action:"status"}})
  ]);
  if(user!==currentUser)return;
  const data=result=>result.status==="fulfilled"&&!result.value.error?result.value.data:null;
  const legacyStatus=data(legacy),sharedStatus=data(shared);
  accounts=(legacyStatus?.accounts||[]).filter(a=>a.connection_status==="connected");
  sharedAccounts=(sharedStatus?.accounts||[]).filter(a=>a.status==="connected");
  sharedProviders=sharedStatus?.providers||{};
  for(const p of providers)setupReady[p.id]=sharedProviders[p.id]===true||legacyStatus?.providers?.[p.id]===true;
  render();
  if(notify)say('Vuba provider setup checked. '+(providers.some(p=>setupReady[p.id])?"Some connections are available.":"Initial provider setup is still required."));
 }
 async function init(next){
  if(user?.id!==next?.id){
   sharedAccounts=[];sharedProviders={};accounts=[];setupReady={};
  }
  user=next||null;
  if(!user){$("vubaSimpleConnections")?.remove();dialog?.close();dialog?.remove();dialog=null;return;}
  const m=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
  if(m.error||!m.data)return;
  role=m.data.role;
  for(let n=0;n<45&&!root();n++)await new Promise(resolve=>setTimeout(resolve,100));
  render();await refresh();
  window.VUBASocialAccounts={refresh};
 }
 onStudioAuth((user)=>setTimeout(()=>init(user||null),0));
 getStudioUser().then((user)=>init(user||null));
}
