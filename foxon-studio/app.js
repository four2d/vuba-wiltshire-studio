import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const C=window.VUBA_CONFIG||{};
const $=id=>document.getElementById(id);
const pillars=["Product Education","FOXON Invoice","FOXON CIS","FOXON Miles","FOXON Gas","Trade Productivity","Behind the Software","Frequently Asked Questions","Company News","Commercial / Sales"];
const series=["","Product Spotlight","Feature Explained","Trade Workflow","Frequently Asked","Behind the Build","App Tip"];
const categories={"Product Education":"Useful trade","FOXON Invoice":"FOXON products","FOXON CIS":"FOXON products","FOXON Miles":"FOXON products","FOXON Gas":"FOXON products","Trade Productivity":"Useful trade","Behind the Software":"Company / behind the scenes","Frequently Asked Questions":"Useful trade","Company News":"Company / behind the scenes","Commercial / Sales":"Commercial"};
const targets={"Useful trade":60,"FOXON products":20,"Company / behind the scenes":10,"Commercial":10};
let db,user,role="editor",posts=[],month=new Date();month.setDate(1);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
function alertError(e,id="editorError"){ $(id).textContent=e?.message||String(e); }
function option(el,items){el.innerHTML=items.map(x=>'<option value="'+esc(x)+'">'+esc(x||"None")+"</option>").join("");}
option($("pillar"),pillars);option($("series"),series);
if(!C.supabaseUrl||!C.supabaseAnonKey){$("setup").hidden=false;}else{
 db=createClient(C.supabaseUrl,C.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
 db.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>boot(session?.user),0)});
 boot((await db.auth.getSession()).data.session?.user);
}
async function boot(u){
 user=u;$("auth").hidden=!!u;$("app").hidden=!u;$("logout").hidden=!u;
 if(!u)return;
 try{
 const {data,error}=await db.from("studio_members").select("role").eq("user_id",u.id).single();
 if(error||!data)throw Error("Your account has not been invited to the FOXON Software workspace.");
 role=data.role;$("who").textContent=u.email+" · "+role;await load();
 }catch(e){$("app").hidden=true;$("auth").hidden=false;alertError(e,"authError");}
}
$("login").onsubmit=async e=>{e.preventDefault();$("authError").textContent="";const {error}=await db.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(error)alertError(error,"authError");};
$("logout").onclick=()=>db.auth.signOut();
async function load(){
 const {data,error}=await db.from("studio_posts").select("*").order("scheduled_date",{ascending:true}).limit(500);
 if(error)throw error;posts=data||[];render();
}
function render(){
 $("month").textContent=month.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
 const f=posts.filter(p=>(!$("channel").value||p.channel===$("channel").value)&&(!$("status").value||p.status===$("status").value));
 const m=f.filter(p=>p.scheduled_date?.startsWith(iso(month).slice(0,7)));
 $("total").textContent=m.length;$("review").textContent=posts.filter(p=>p.status==="review").length;$("approved").textContent=posts.filter(p=>p.status==="approved").length;
 const last=posts.filter(p=>["approved","scheduled"].includes(p.status)).slice().sort((a,b)=>(b.updated_at||"").localeCompare(a.updated_at||"")).slice(0,20);
 const useful=last.filter(p=>categories[p.pillar]==="Useful trade").length;
 $("mix").textContent=last.length?Math.round(useful/last.length*100)+"%":"—";
 $("balance").innerHTML=Object.entries(targets).map(([k,v])=>'<div class="balanceRow"><span>'+esc(k)+'</span><strong>'+last.filter(p=>categories[p.pillar]===k).length+'/'+(v/5)+'</strong></div>').join("");
 const first=new Date(month.getFullYear(),month.getMonth(),1);const offset=(first.getDay()+6)%7;const start=new Date(first);start.setDate(start.getDate()-offset);
 const today=iso(new Date());let html="";
 for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const day=iso(d);const dayPosts=f.filter(p=>p.scheduled_date===day);
 html+='<div class="day '+(d.getMonth()!==month.getMonth()?"out ":"")+(day===today?"today":"")+'" data-date="'+day+'"><span class="daynum">'+d.getDate()+'</span>'+dayPosts.map(p=>'<button data-post="'+esc(p.id)+'" class="'+esc(p.status)+'" draggable="'+(["idea","draft"].includes(p.status)?"true":"false")+'" title="'+esc(p.channel+" · "+p.status)+'">'+esc(p.title)+'</button>').join("")+'</div>';
 }
 $("calendar").innerHTML=html;
 $("upcoming").innerHTML=f.filter(p=>p.scheduled_date>=today).slice(0,6).map(p=>'<div class="upcomingItem"><button data-post="'+esc(p.id)+'">'+esc(p.title)+'</button><div class="hint">'+esc(p.scheduled_date+" · "+p.status)+'</div></div>').join("")||'<p>No upcoming posts.</p>';
 document.querySelectorAll("[data-post]").forEach(b=>b.onclick=()=>edit(posts.find(p=>p.id===b.dataset.post)));
}
$("channel").onchange=render;$("status").onchange=render;
$("prev").onclick=()=>{month.setMonth(month.getMonth()-1);render()};
$("next").onclick=()=>{month.setMonth(month.getMonth()+1);render()};
$("new").onclick=()=>edit(null);
$("autoSuggest").onclick=()=>{edit(null);generatePost();};
$("close").onclick=()=>$("editor").close();
function edit(p){
 $("postForm").reset();$("editorError").textContent="";$("postId").value=p?.id||"";$("editorTitle").textContent=p?"Edit post":"New post";
 $("title").value=p?.title||"";$("topic").value=p?.topic||p?.title||"";$("date").value=p?.scheduled_date||iso(new Date());
 $("postChannel").value=p?.channel||"Instagram";$("pillar").value=p?.pillar||pillars[0];
 $("format").value=p?.format||"Single image";$("series").value=p?.series||"";$("caption").value=p?.caption||"";$("source").value=p?.source_notes||"";
 $("postStatus").value=p?.status||"idea";
 if($("postCampaign"))$("postCampaign").value=p?.campaign_id||"";
 if($("postMedia"))$("postMedia").value=p?.media_id||"";
 if($("reviewNote"))$("reviewNote").value=p?.review_note||"";
 for(const o of $("postStatus").options)o.disabled=(["approved","scheduled"].includes(o.value)&&!["admin","approver"].includes(role))||(p?.status==="approved"&&o.value==="review"&&role==="editor");
 $("delete").hidden=!p||role!=="admin";
 $("editor").showModal();
}
$("postForm").onsubmit=async e=>{
 e.preventDefault();$("editorError").textContent="";
 const id=$("postId").value,old=posts.find(p=>p.id===id);
 const status=$("postStatus").value;
 if(!$("title").value.trim())return alertError("Add a title or use Suggest AI post to write one.");
 if(["approved","scheduled"].includes(status)&&!["admin","approver"].includes(role))return alertError("Only an approver can approve posts.");
 if(status==="scheduled"&&!($("caption").value.trim()))return alertError("A scheduled post needs a caption.");
 if(!id&&window.FoxonArtworkAutoOnSave)await window.FoxonArtworkAutoOnSave();
 const payload={campaign_id:$("postCampaign")?.value||null,media_id:$("postMedia")?.value||null,review_note:$("reviewNote")?.value.trim()||"",topic:$("topic").value.trim()||$("title").value.trim(),title:$("title").value.trim(),scheduled_date:$("date").value,channel:$("postChannel").value,pillar:$("pillar").value,format:$("format").value,series:$("series").value||null,status,caption:$("caption").value,source_notes:$("source").value,updated_by:user.id};
 if(!id)payload.created_by=user.id;
 const q=id?db.from("studio_posts").update(payload).eq("id",id):db.from("studio_posts").insert(payload);
 const {error}=await q;if(error)return alertError(error);
 $("editor").close();window.dispatchEvent(new Event("foxon:post-saved"));await load();await window.VubaStudioPlus?.refresh?.();
};
$("delete").onclick=async()=>{if(!confirm("Delete this post permanently?"))return;const {error}=await db.from("studio_posts").delete().eq("id",$("postId").value);if(error)return alertError(error);$("editor").close();await load();};
async function generatePost(){
 $("editorError").textContent="";
 if(C.aiEnabled===false){
  const starter=window.VubaOfflineDraft?.({topic:$("topic").value.trim(),pillar:$("pillar").value,existingTitles:posts.map(p=>p.title),channel:$("postChannel").value});
  if(!starter)return alertError("Offline suggestions are not loaded. Please refresh.");
  $("topic").value=starter.topic;
  $("title").value=starter.title;
  $("caption").value=starter.caption;
  if(pillars.includes(starter.pillar))$("pillar").value=starter.pillar;
  if(starter.format)$("format").value=starter.format;
  $("series").value=starter.series||"";
  $("source").value=starter.source_notes;
  $("postStatus").value="draft";
  $("editorError").textContent="Offline editorial starter: review and improve this draft before submitting. It was not written by live AI.";
  await window.VubaMediaAssist?.chooseForBuilder?.();
  return;
 }
 const button=$("generate"),bigButton=$("autoSuggest");
 button.disabled=true; bigButton.disabled=true;
 button.textContent="Creating draft…";bigButton.textContent="Drafting…";
 try{
  const {data,error}=await db.functions.invoke(C.aiFunction||"draft-post",{body:{
    topic:$("topic").value.trim(),title:$("title").value.trim(),
    channel:$("postChannel").value,pillar:$("pillar").value,
    source:$("source").value.trim(),format:$("format").value
  }});
  if(error){
    let message=error.message||"AI request failed";
    try{const details=await error.context?.json();message=details?.error||message;}catch(_){}
    throw Error(message);
  }
  if(!data?.caption||!data?.title||!data?.topic)throw Error("AI did not return a complete post.");
  $("topic").value=data.topic;$("title").value=data.title;$("caption").value=data.caption;
  if(pillars.includes(data.pillar))$("pillar").value=data.pillar;
  if(data.source_notes)$("source").value=data.source_notes;
  $("postStatus").value="draft";
  await window.VubaMediaAssist?.chooseForBuilder?.();
 }catch(e){alertError(e)}finally{
  button.disabled=false;bigButton.disabled=false;
  button.textContent="Suggest AI post";bigButton.textContent="Suggest AI post";
 }
}
$("generate").onclick=generatePost;
window.VubaCalendarReload=load;
window.VubaOpenPost=id=>{const post=posts.find(p=>p.id===id);if(post)edit(post);};
