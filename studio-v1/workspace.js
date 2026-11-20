import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const C=window.VUBA_CONFIG;
const db=createClient(C.supabaseUrl,C.supabaseAnonKey);
const $=id=>document.getElementById(id);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={user:null,role:null,campaigns:[],media:[],posts:[],urls:{},currentPost:null};
const channels=["Instagram","Facebook","LinkedIn"];
async function auth(u){
 state.user=u;if(!u){$("workspacePlus")?.remove();return;}
 const {data}=await db.from("studio_members").select("role").eq("user_id",u.id).maybeSingle();
 if(!data)return;state.role=data.role;
 if(!$("workspacePlus"))build();
 await refresh();
}
function build(){
 const root=document.createElement("section");root.id="workspacePlus";
 root.innerHTML=`
 <nav class="workspace-tabs"><button data-section="campaigns" class="active">Campaigns</button><button data-section="assets">Creative library</button><button data-section="reviews">Review queue</button></nav>
 <section id="campaignsPanel" class="panel">
  <div class="strategy-head"><div><h2>Marketing campaigns</h2><p>Turn your strategy into timed campaigns with audiences, messages and measurable outcomes.</p></div><button id="newCampaign">+ New campaign</button></div>
  <div id="campaignGrid" class="workspace-grid"></div><p class="hint">Campaign objectives and targets are planning inputs, not verified performance reports.</p>
 </section>
 <section id="assetsPanel" class="panel" hidden>
  <div class="strategy-head"><div><h2>Creative library</h2><p>Upload genuine photographs and approved branded graphics. All uploads are private until reviewed.</p></div><button id="refreshAssets">Refresh images</button></div>
  <form id="assetUploadForm" class="asset-upload"><label>Upload photo (JPEG, PNG or WebP; max 10 MB)<input type="file" id="assetFile" accept="image/jpeg,image/png,image/webp" required></label><label>Description / usage context<input id="assetDescription" maxlength="300" placeholder="e.g. Genuine depot photograph, staff permission confirmed"></label><label>Usage rights / permissions<input id="assetRights" maxlength="300" placeholder="Confirm photographer and subject permissions" required></label><button type="submit">Upload for approval</button></form>
  <p id="assetMessage" role="status"></p><div id="assetGrid" class="workspace-grid"></div>
 </section>
 <section id="reviewsPanel" class="panel" hidden><div class="strategy-head"><div><h2>Review queue</h2><p>Approve content or return it with specific changes. Review actions are recorded against the post.</p></div><button id="refreshReview">Refresh queue</button></div><div id="reviewGrid" class="workspace-grid"></div></section>`;
 $("app").insertBefore(root,$("strategyArea")||$("app").querySelector(".metrics"));
 const campaignDialog=document.createElement("dialog");campaignDialog.id="campaignDialog";
 campaignDialog.innerHTML=`<form id="campaignForm"><div class="dialogHead"><h2>Campaign plan</h2><button type="button" id="closeCampaign">×</button></div><input type="hidden" name="id">
 <label>Campaign name<input name="name" required maxlength="140"></label>
 <label>Objective<textarea name="objective" rows="2" required placeholder="What should change as a result of this campaign?"></textarea></label>
 <label>Target audience<textarea name="audience" rows="2" required></textarea></label>
 <label>Key messages<textarea name="key_messages" rows="3"></textarea></label>
 <label>How we'll measure success<textarea name="success_metrics" rows="2" placeholder="e.g. enquiry count, installer visits; define measurement source"></textarea></label>
 <div class="fields"><label>Start date<input type="date" name="start_date"></label><label>End date<input type="date" name="end_date"></label><label>Status<select name="status"><option value="planning">Planning</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label><label>Owner<input name="owner_name" maxlength="140"></label></div><p id="campaignError" role="alert"></p><div class="dialogActions"><button type="submit">Save campaign</button></div></form>`;
 document.body.appendChild(campaignDialog);
 const preview=document.createElement("dialog");preview.id="platformPreview";
 preview.innerHTML=`<div class="dialogHead"><h2>Platform preview</h2><button id="closePlatform" type="button">×</button></div><p class="hint">A visual approximation of feed presentation; final layouts can differ by platform and device.</p>
 <div class="workspace-tabs" id="previewPlatforms"><button data-channel="Instagram" class="active">Instagram</button><button data-channel="Facebook">Facebook</button><button data-channel="LinkedIn">LinkedIn</button></div>
 <div class="social-mock"><div class="mock-head"><div class="mock-avatar">VW</div><div><strong>Vuba Wiltshire</strong><small id="mockPlatform">Instagram · Preview</small></div></div><div id="mockImage" class="mock-image"></div><div class="mock-copy"><h3 id="mockTitle"></h3><p id="mockCaption"></p></div><div class="mock-actions">♡ &nbsp; ◌ &nbsp; ↗</div></div>
 <div id="previewStatus" class="hint"></div>`;
 document.body.appendChild(preview);
 document.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>section(b.dataset.section));
 $("newCampaign").onclick=()=>campaignForm();
 $("closeCampaign").onclick=()=>campaignDialog.close();
 $("campaignForm").onsubmit=saveCampaign;
 $("campaignGrid").onclick=e=>{const b=e.target.closest("[data-campaign]");if(b)campaignForm(state.campaigns.find(c=>c.id===b.dataset.campaign));};
 $("assetUploadForm").onsubmit=uploadAsset;
 $("refreshAssets").onclick=refresh;
 $("refreshReview").onclick=refresh;
 $("assetGrid").onclick=e=>{const b=e.target.closest("[data-approve-media]");if(b)approveMedia(b.dataset.approveMedia,b);};
 $("reviewGrid").onclick=e=>{const b=e.target.closest("[data-open-review]");if(b)reviewPost(b.dataset.openReview);};
 $("closePlatform").onclick=()=>preview.close();
 $("previewPlatforms").onclick=e=>{const b=e.target.closest("[data-channel]");if(b)showPlatform(b.dataset.channel);};
 // Attach extra editor controls without altering the original form lifecycle.
 const format=$("format").closest("label");
 format.insertAdjacentHTML("afterend",`<label>Campaign<select id="postCampaign"><option value="">No campaign</option></select></label><label>Approved photo<select id="postMedia"><option value="">No image selected</option></select></label>`);
 $("caption").closest("label").insertAdjacentHTML("afterend",`<div class="editor-extras"><button id="showPreview" type="button">Preview Facebook / Instagram / LinkedIn</button><button id="openReviewHistory" type="button">Review history</button></div><label>Reviewer notes<input id="reviewNote" placeholder="Changes requested or reviewer guidance"></label><div class="review-actions"><button id="submitReview" type="button">Submit for review</button><button id="requestChanges" type="button">Request changes</button><button id="approvePost" type="button">Approve post</button></div><div id="reviewHistory" class="review-history" hidden></div>`);
 $("showPreview").onclick=()=>openPlatformPreview();
 $("openReviewHistory").onclick=showHistory;
 $("submitReview").onclick=()=>changeReviewStatus("review","submitted");
 $("requestChanges").onclick=()=>changeReviewStatus("changes_requested","changes_requested");
 $("approvePost").onclick=()=>changeReviewStatus("approved","approved");
 $("postStatus").insertAdjacentHTML("beforeend",'<option value="changes_requested">Changes requested</option>');
 // Original app's save handler includes a separate payload, so this module
 // persists campaign and media on its own follow-up save with RLS enforced.
 const originalSubmit=$("postForm").onsubmit;
 $("postForm").onsubmit=async e=>{
  e.preventDefault();
  const postId=$("postId").value;
  if(!postId){
   await originalSubmit(e);
   // The original handler closes dialog after saving. Match the newly inserted row.
   if(!$("editor").open)await assignNewPost();
  }else{
   const campaignId=$("postCampaign").value||null,mediaId=$("postMedia").value||null,note=$("reviewNote").value.trim();
   await originalSubmit(e);
   if(!$("editor").open){
    const {error}=await db.from("studio_posts").update({campaign_id:campaignId,media_id:mediaId,review_note:note,updated_by:state.user.id}).eq("id",postId);
    if(error)alert(error.message);
    await refresh();
   }
  }
 };
 const originalEditor=$("new").onclick;
 $("new").onclick=()=>{originalEditor();fillEditorExtras();};
 $("autoSuggest").onclick=()=>{originalEditor();fillEditorExtras();$("generate").click();};
 const observer=new MutationObserver(()=>{if($("editor").open){fillEditorExtras();}});
 observer.observe($("editor"),{attributes:true,attributeFilter:["open"]});
}
async function assignNewPost(){
 // Newly created item can be found by its exact editor fields and current user.
 const {data}=await db.from("studio_posts").select("id").eq("created_by",state.user.id).eq("title",$("title").value.trim()).order("created_at",{ascending:false}).limit(1);
 const id=data?.[0]?.id;if(!id)return;
 const {error}=await db.from("studio_posts").update({campaign_id:$("postCampaign").value||null,media_id:$("postMedia").value||null,review_note:$("reviewNote").value.trim(),updated_by:state.user.id}).eq("id",id);
 if(error)console.warn("Post added but media/campaign not saved:",error.message);
 await refresh();
}
function section(name){
 document.querySelectorAll("[data-section]").forEach(b=>b.classList.toggle("active",b.dataset.section===name));
 for(const n of ["campaigns","assets","reviews"])$(n+"Panel").hidden=n!==name;
}
async function refresh(){
 if(!state.user)return;
 const [campaigns,media,posts]=await Promise.all([
  db.from("studio_campaigns").select("*").order("created_at",{ascending:false}),
  db.from("studio_media").select("*").order("created_at",{ascending:false}),
  db.from("studio_posts").select("id,title,topic,channel,caption,pillar,status,media_id,campaign_id,review_note,scheduled_date,created_at").order("created_at",{ascending:false}).limit(250)
 ]);
 for(const [name,result] of [["campaigns",campaigns],["media",media],["posts",posts]])if(result.error){$(name==="media"?"assetMessage":"campaignError")?.replaceChildren(document.createTextNode(result.error.message));return;}
 state.campaigns=campaigns.data||[];state.media=media.data||[];state.posts=posts.data||[];
 state.urls={};
 await Promise.all(state.media.map(async m=>{
  const {data}=await db.storage.from("vuba-approved-media").createSignedUrl(m.file_path,3600);
  if(data?.signedUrl)state.urls[m.id]=data.signedUrl;
 }));
 renderCampaigns();renderMedia();renderReviews();
 const c=$("postCampaign"),m=$("postMedia");
 if(c){const old=c.value;c.innerHTML='<option value="">No campaign</option>'+state.campaigns.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+'</option>').join("");c.value=old;}
 if(m){const old=m.value;m.innerHTML='<option value="">No image selected</option>'+state.media.filter(x=>x.approved).map(x=>'<option value="'+safe(x.id)+'">'+safe(x.description||x.filename)+'</option>').join("");m.value=old;}
}
function renderCampaigns(){
 $("newCampaign").hidden=!["admin","approver"].includes(state.role);
 $("campaignGrid").innerHTML=state.campaigns.map(c=>`<article class="workspace-card"><span class="suggestion-pill">${safe(c.status)} · ${safe(c.start_date||"Date TBC")}</span><h3>${safe(c.name)}</h3><p>${safe(c.objective)}</p><small><b>Audience:</b> ${safe(c.audience)}<br><b>Measure:</b> ${safe(c.success_metrics||"Not defined")}</small><div><button data-campaign="${safe(c.id)}" ${["admin","approver"].includes(state.role)?"":"disabled"}>View / edit campaign</button></div></article>`).join("")||'<p>No campaigns yet. Create one to connect planned posts to marketing objectives.</p>';
}
function campaignForm(c){
 const f=$("campaignForm");f.reset();
 for(const k of ["id","name","objective","audience","key_messages","success_metrics","start_date","end_date","status","owner_name"]){const x=f.elements[k];if(x)x.value=c?.[k]||((k==="status")?"planning":"");}
 $("campaignError").textContent="";$("campaignDialog").showModal();
}
async function saveCampaign(e){
 e.preventDefault();if(!["admin","approver"].includes(state.role))return;
 const f=e.target,p={};for(const k of ["name","objective","audience","key_messages","success_metrics","start_date","end_date","status","owner_name"])p[k]=f.elements[k].value.trim();
 p.start_date ||=null;p.end_date ||=null;
 const id=f.elements.id.value;if(!id)p.created_by=state.user.id;
 const {error}=id?await db.from("studio_campaigns").update(p).eq("id",id):await db.from("studio_campaigns").insert(p);
 if(error){$("campaignError").textContent=error.message;return;}
 $("campaignDialog").close();await refresh();
}
function renderMedia(){
 $("assetGrid").innerHTML=state.media.map(m=>`<article class="workspace-card"><div class="asset-thumb">${state.urls[m.id]?'<img loading="lazy" src="'+safe(state.urls[m.id])+'" alt="'+safe(m.description)+'">':"Private image"}</div><h3>${safe(m.description||m.filename)}</h3><p class="hint">${safe(m.usage_rights||"No usage note")}</p><span class="suggestion-pill">${m.approved?"Approved for use":"Awaiting image approval"}</span>${!m.approved&&["admin","approver"].includes(state.role)?'<button data-approve-media="'+safe(m.id)+'">Approve image</button>':""}</article>`).join("")||"<p>No images yet. Upload real project or depot photographs with permission.</p>";
}
async function uploadAsset(e){
 e.preventDefault();
 const file=$("assetFile").files?.[0];
 if(!file)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10485760){$("assetMessage").textContent="Choose a JPEG, PNG or WebP under 10MB.";return;}
 const rights=$("assetRights").value.trim();
 if(!rights){$("assetMessage").textContent="Document image permissions before uploading.";return;}
 const filename=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100);
 const path=state.user.id+"/"+crypto.randomUUID()+"-"+filename;
 $("assetMessage").textContent="Uploading private image…";
 const {error}=await db.storage.from("vuba-approved-media").upload(path,file,{upsert:false,contentType:file.type});
 if(error){$("assetMessage").textContent=error.message;return;}
 const result=await db.from("studio_media").insert({file_path:path,filename,description:$("assetDescription").value.trim(),usage_rights:rights,mime_type:file.type,uploaded_by:state.user.id});
 $("assetMessage").textContent=result.error?result.error.message:"Image uploaded privately for approval.";
 if(!result.error){$("assetUploadForm").reset();await refresh();}
}
async function approveMedia(id,button){
 if(!confirm("Confirm you have checked image accuracy and usage permission?"))return;
 button.disabled=true;
 const {error}=await db.from("studio_media").update({approved:true}).eq("id",id);
 if(error)alert(error.message);
 await refresh();
}
function renderReviews(){
 const selected=state.posts.filter(p=>["review","changes_requested","approved"].includes(p.status));
 $("reviewGrid").innerHTML=selected.map(p=>`<article class="workspace-card"><span class="suggestion-pill">${safe(p.status.replaceAll("_"," "))}</span><h3>${safe(p.title)}</h3><p>${safe(p.caption).slice(0,220)}${p.caption.length>220?"…":""}</p><small>${safe(p.channel)} · ${safe(p.scheduled_date)}</small><div><button data-open-review="${safe(p.id)}">Open for review</button></div></article>`).join("")||"<p>No posts awaiting review.</p>";
}
function fillEditorExtras(){
 const id=$("postId").value,p=state.posts.find(x=>x.id===id);
 $("postCampaign").value=p?.campaign_id||"";
 $("postMedia").value=p?.media_id||"";
 $("reviewNote").value=p?.review_note||"";
 $("reviewHistory").hidden=true;
 $("reviewHistory").textContent="";
 $("submitReview").hidden=!id||!["idea","draft","changes_requested"].includes(p?.status||"idea");
 $("requestChanges").hidden=!id||p?.status!=="review"||!["admin","approver"].includes(state.role);
 $("approvePost").hidden=!id||p?.status!=="review"||!["admin","approver"].includes(state.role);
}
function reviewPost(id){
 const p=state.posts.find(x=>x.id===id);if(!p)return;
 const day=document.querySelector('[data-post="'+id+'"]');
 if(day){day.click();fillEditorExtras();return;}
 // When the post is outside the current visible month, populate the original editor directly.
 $("new").click();
 for(const [key,val] of [["postId",p.id],["topic",p.topic],["title",p.title],["date",p.scheduled_date],["caption",p.caption],["postChannel",p.channel],["pillar",p.pillar],["postStatus",p.status]])$(key).value=val||"";
 fillEditorExtras();
}
async function showHistory(){
 const id=$("postId").value;if(!id){$("reviewHistory").textContent="Save this post before recording review actions."; $("reviewHistory").hidden=false;return;}
 const {data,error}=await db.from("studio_review_events").select("action,note,created_at").eq("post_id",id).order("created_at",{ascending:false}).limit(20);
 $("reviewHistory").hidden=false;
 $("reviewHistory").innerHTML=error?safe(error.message):(data||[]).map(x=>'<p><strong>'+safe(x.action.replaceAll("_"," "))+'</strong> · '+safe(new Date(x.created_at).toLocaleString("en-GB"))+'<br>'+safe(x.note)+'</p>').join("")||"No review events recorded yet.";
}
function currentEditorPost(){
 return {
  id:$("postId").value,channel:$("postChannel").value,title:$("title").value,
  caption:$("caption").value,media_id:$("postMedia").value
 };
}
async function openPlatformPreview(){
 state.currentPost=currentEditorPost();
 $("platformPreview").showModal();await showPlatform(state.currentPost.channel);
}
async function showPlatform(channel){
 if(!state.currentPost)return;
 document.querySelectorAll("[data-channel]").forEach(b=>b.classList.toggle("active",b.dataset.channel===channel));
 $("mockPlatform").textContent=channel+" · Preview";
 $("mockTitle").textContent=state.currentPost.title||"Working headline";
 $("mockCaption").textContent=state.currentPost.caption||"No caption yet. Add a caption or generate one when AI credits are available.";
 const url=state.urls[state.currentPost.media_id];
 $("mockImage").innerHTML=url?'<img src="'+safe(url)+'" alt="Selected approved image">':'<div class="mock-placeholder">No approved photo selected</div>';
 $("previewStatus").textContent="This is a layout preview, not a live post. No content has been published.";
}
async function changeReviewStatus(status,action){
 const id=$("postId").value;if(!id)return;
 const post=state.posts.find(p=>p.id===id);
 if(!post)return;
 const note=$("reviewNote").value.trim();
 if(action==="changes_requested"&&!note){$("editorError").textContent="Please explain what needs changing in Reviewer notes.";return;}
 if(status==="approved"&&!post.caption.trim()){ $("editorError").textContent="The post needs a saved caption before approval.";return;}
 const {error}=await db.from("studio_posts").update({status,review_note:note,updated_by:state.user.id}).eq("id",id);
 if(error){$("editorError").textContent=error.message;return;}
 await recordReview(id,action,note);
 $("editor").close();await refresh();
 // The calendar is owned by the main app and needs a reload to reflect review action.
 $("reviewGrid").scrollIntoView({block:"nearest"});
}
async function recordReview(postId,action,note){
 const {error}=await db.from("studio_review_events").insert({post_id:postId,action,note,actor_id:state.user.id});
 if(error)console.warn("Review audit unavailable",error.message);
}
window.VubaStudioPlus={recordReview,refresh};
const {data:{session}}=await db.auth.getSession();
await auth(session?.user||null);
db.auth.onAuthStateChange((_,session)=>setTimeout(()=>auth(session?.user||null),0));
