/* Vuba Wiltshire Connections: beginner-first, Vuba-only social accounts.
   No imported FOXON credentials, fake connected states, or client secrets. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const config=window.VUBA_CONFIG||{};
if(config.supabaseUrl&&config.supabaseAnonKey){
 const db=createClient(config.supabaseUrl,config.supabaseAnonKey);
 const $=id=>document.getElementById(id);
 const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const providers=[
  {id:"Facebook",name:"Facebook",kind:"Vuba Wiltshire Page",symbol:"f",intro:"Share updates with local installers and customers."},
  {id:"Instagram",name:"Instagram",kind:"Vuba Wiltshire Instagram",symbol:"◎",intro:"Share finished projects, products and colour inspiration."},
  {id:"LinkedIn",name:"LinkedIn",kind:"Vuba Wiltshire Company Page",symbol:"in",intro:"Share trade news and updates with professional contacts."}
 ];
 let user=null,role="",accounts=[],busy=false,dialog=null,setupReady={Facebook:false,Instagram:false,LinkedIn:false};
 function root(){return $("vubaConnectionWorkspace");}
 function say(text){const el=$("vubaConnectionMessage");if(el)el.textContent=text;}
 function showDialog(title,content,actions=""){
  if(!dialog){dialog=document.createElement("dialog");dialog.id="vubaConnectDialog";dialog.className="vuba-connect-dialog";document.body.append(dialog);}
  dialog.innerHTML='<div class="vc-dialog-head"><h2>'+escapeHtml(title)+'</h2><button type="button" data-close aria-label="Close">×</button></div><div class="vc-dialog-content">'+content+'</div>'+actions;
  dialog.querySelector("[data-close]").onclick=()=>dialog.close();
  if(!dialog.open)dialog.showModal();
 }
 function connected(platform){return accounts.filter(a=>a.platform===platform&&a.connection_status==="connected");}
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
   (role==="admin"?'<details class="vc-owner"><summary>Studio owner settings</summary><p>Provider connections are configured once for Vuba Wiltshire. Staff will only need to choose Add account and sign in.</p><div class="vc-owner-grid">'+providers.map(p=>'<div><strong>'+p.name+'</strong><span>'+(setupReady[p.id]?"Provider setup available":"Provider setup required")+'</span></div>').join("")+'</div><p>Only Vuba-owned provider credentials belong on the server. Never enter app secrets in this browser.</p><button type="button" id="vcCheckSetup">Check setup</button></details>':'')+
   '</section>';
  host.querySelectorAll("[data-connect]").forEach(b=>b.onclick=()=>selectProvider(b.dataset.connect));
  $("vcCheckSetup")?.addEventListener("click",()=>refresh(true));
 }
 async function selectProvider(platform){
  const p=providers.find(x=>x.id===platform);if(!p)return;
  const existing=connected(platform);
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
   const {data,error}=await db.functions.invoke("vuba-social-oauth",{body:{action:"begin",platform}});
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
  // Readiness is server-derived, never based on a local toggle or browser claims.
  try{
   const {data,error}=await db.functions.invoke("vuba-social-oauth",{body:{action:"status"}});
   if(!error&&data?.providers){
    for(const p of providers)setupReady[p.id]=data.providers[p.id]===true;
    if(Array.isArray(data.accounts))accounts=data.accounts.filter(x=>providers.some(p=>p.id===x.platform)&&x.connection_status==="connected");
    else accounts=[];
   }else{setupReady={Facebook:false,Instagram:false,LinkedIn:false};accounts=[];}
  }catch{setupReady={Facebook:false,Instagram:false,LinkedIn:false};accounts=[];}
  render();
  if(notify)say('Vuba provider setup checked. '+(providers.some(p=>setupReady[p.id])?"Some connections are available.":"Initial provider setup is still required."));
 }
 async function init(next){
  user=next||null;
  if(!user){$("vubaSimpleConnections")?.remove();dialog?.close();dialog?.remove();dialog=null;return;}
  const m=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
  if(m.error||!m.data)return;
  role=m.data.role;
  for(let n=0;n<45&&!root();n++)await new Promise(resolve=>setTimeout(resolve,100));
  render();await refresh();
  window.VUBASocialAccounts={refresh};
 }
 db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>init(session?.user||null),0));
 db.auth.getSession().then(({data})=>init(data.session?.user||null));
}
