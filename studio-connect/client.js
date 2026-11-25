/* Shared account connections pilot; keeps current edition-specific connections intact. */
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.VUBA_CONFIG||{};
if(cfg.supabaseUrl&&cfg.supabaseAnonKey){
 const tenant=location.pathname.includes("/foxon-studio/")?"foxon":"vuba";
 const db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
 const endpoint="https://iwituhhojivokiueekdb.supabase.co/functions/v1/studio-connect";
 const services=[["Facebook","f"],["Instagram","◎"],["LinkedIn","in"]];
 let user=null,details=null,accountState={providers:{},accounts:[],candidates:[]},loading=false,active=false;
 const safe=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const note=message=>{const el=document.getElementById("scNote");if(el)el.textContent=message;};
 async function api(action,params={}){
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw Error("Sign in to Studio first");
  const response=await fetch(endpoint,{
   method:"POST",mode:"cors",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},
   body:JSON.stringify({tenant,action,...params})
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok||json.error)throw Error(json.error||"Connection unavailable");
  return json;
 }
 function mount(){
  const parent=document.getElementById(tenant==="foxon"?"foxonConnectionWorkspace":"vubaConnectionWorkspace");
  if(!parent||!user)return;
  if(!details){details=document.createElement("details");details.id="studioConnectShared";details.className="sc-preview";
   details.innerHTML='<summary>Shared account connections <span class="sc-beta">Preview</span></summary><div id="scContent"></div>';
   details.addEventListener("toggle",()=>{if(details.open){active=true;refresh()}else active=false});
  }
  if(!parent.contains(details))parent.append(details);
  if(!parent.dataset.sharedConnectObserver){
   const observer=new MutationObserver(()=>{if(user&&details&&!parent.contains(details))parent.append(details)});
   observer.observe(parent,{childList:true});
   parent.dataset.sharedConnectObserver="yes";
  }
 }
 function render(){
  if(!details)return;
  const box=document.getElementById("scContent");if(!box)return;
  const lists=accountState.accounts||[],candidates=accountState.candidates||[],ready=accountState.providers||{};
  box.innerHTML='<header class="sc-head"><h3>Choose the Pages you want to work with</h3><p>Connect once, select your Pages, and return here to manage them. Your accounts stay separate from other Studio workspaces.</p></header>'+
   '<div class="sc-cards">'+services.map(([name,glyph])=>{
    const group=lists.filter(x=>x.platform===name),available=Boolean(ready[name]),pending=candidates.filter(x=>x.platform===name);
    return '<section class="sc-card"><header><span class="sc-glyph">'+glyph+'</span><strong>'+name+'</strong></header>'+
    (group.length?group.map(x=>'<div class="sc-page"><span>'+safe(x.display_name)+'</span><button type="button" data-disconnect="'+safe(x.id)+'">Remove</button></div>').join(""):'<p>No Pages selected</p>')+
    (pending.length?'<fieldset><legend>Select the Pages you want</legend>'+pending.map(x=>'<label class="sc-option"><input type="checkbox" name="sc-page-'+name+'" value="'+safe(x.id)+'"><span>'+safe(x.display_name)+'</span></label>').join("")+'</fieldset><button type="button" class="sc-primary" data-save="'+name+'">Connect selected Pages</button>':
    '<button type="button" class="sc-primary" data-begin="'+name+'" '+(!available?'disabled title="Provider authorisation is not configured yet"':'')+'>'+(group.length?"Add more Pages":"Add "+name)+'</button>')+
    (!available?'<p class="sc-unavailable">Studio-wide provider approval pending. No developer setup needed from you.</p>':'')+'</section>';
   }).join("")+'</div><p id="scNote" role="status" aria-live="polite"></p><p class="sc-help">Your sign-in happens on the social network. Studio does not see your password. No posts are published when you connect a Page.</p>';
  box.querySelectorAll("[data-begin]").forEach(button=>button.onclick=async()=>{
   if(loading)return;loading=true;button.disabled=true;note("Opening the provider sign-in…");
   try{
    const result=await api("begin",{platform:button.dataset.begin});
    const url=new URL(result.authorization_url);
    if(url.protocol!=="https:"||!["www.facebook.com","www.linkedin.com"].includes(url.hostname))throw Error("Unsafe provider sign-in address");
    location.assign(url.href);
   }catch(e){note(e.message);loading=false;button.disabled=false}
  });
  box.querySelectorAll("[data-save]").forEach(button=>button.onclick=async()=>{
   const platform=button.dataset.save;
   const ids=[...box.querySelectorAll('input[name="sc-page-'+platform+'"]:checked')].map(el=>el.value);
   if(!ids.length){note("Select at least one Page first.");return}
   if(loading)return;loading=true;button.disabled=true;
   try{await api("select",{platform,ids});await refresh(true)}catch(e){note(e.message)}finally{loading=false;button.disabled=false}
  });
  box.querySelectorAll("[data-disconnect]").forEach(button=>button.onclick=async()=>{
   if(!confirm("Remove this Page from this Studio workspace? It will not delete the Page on the social network."))return;
   if(loading)return;loading=true;button.disabled=true;
   try{await api("disconnect",{id:button.dataset.disconnect});await refresh(true)}catch(e){note(e.message)}finally{loading=false;button.disabled=false}
  });
 }
 async function refresh(announce=false){
  if(!active||!user)return;
  try{
   accountState=await api("status");
   render();
   if(announce){
    note("Page selections updated.");
    if(tenant==="vuba")await window.VUBASocialAccounts?.refresh();
   }
   const value=new URL(location.href).searchParams.get("studio_connect");
   if(value==="select_pages")note("Sign-in complete. Tick the Pages you want, then choose Connect selected Pages.");
   else if(value&&value!=="done")note("The social network returned: "+value.replace(/_/g," ")+".");
  }catch(e){note("The shared connection service is unavailable. Your existing Studio connections are unchanged.");}
 }
 async function init(u){user=u||null;if(!user){details?.remove();details=null;active=false;return}
  for(let i=0;i<45&&!document.getElementById(tenant==="foxon"?"foxonConnectionWorkspace":"vubaConnectionWorkspace");i++)await new Promise(r=>setTimeout(r,100));
  mount();
  if(new URL(location.href).searchParams.get("studio_connect")==="select_pages"&&details)details.open=true;
  if(details?.open){active=true;refresh()}
 }
 window.StudioSharedConnect={refresh:()=>{mount();return refresh()}};
 db.auth.getSession().then(({data})=>init(data.session?.user||null));
 db.auth.onAuthStateChange((_,session)=>setTimeout(()=>init(session?.user||null),0));
}
