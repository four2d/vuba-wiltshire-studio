import {createStudioClient,getStudioUser,onStudioAuth} from "./staff-auth.js";
const db=createStudioClient();
const $=id=>document.getElementById(id);
const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let signedIn=null,media=[],signedUrls={},selectedMedia="",renderTicket=0,batchOffset=0;
const imageSynonyms={
 "driveway":["driveway","drive","resin","surface","finish","paving"],
 "blend":["blend","sample","aggregate","stone","gravel","colour","color"],
 "colour":["colour","color","blend","sample","aggregate"],
 "winter":["winter","weather","rain","cold","site","conditions"],
 "forecast":["weather","rain","winter","site","conditions"],
 "planning":["plan","planning","site","installer","team","work"],
 "handover":["team","meeting","planning","site","contractor"],
 "depot":["depot","warehouse","trade","pallet","stock"],
 "installer":["installer","installation","trowel","tool","site","work"],
 "question":["question","faq","graphic","advice","guide"],
 "faq":["question","faq","graphic","guide"]
};

const maxFile=10*1024*1024;
const permitted=new Set(["image/jpeg","image/png","image/webp"]);
function imageWords(str){
 const ignore=new Set(["about","from","with","their","before","after","would","should","could","have","that","this","what","your","resin","bound","vuba","wiltshire","image","images","photo","photos","post","stock"]);
 return String(str||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w.length>3&&!ignore.has(w));
}
function ranking(m,words){
 const text=[m.filename,m.description,m.usage_rights].join(" ").toLowerCase();
 return words.reduce((score,w)=>score+(text.includes(w)?3:0),0);
}
function currentTopic(){return [$("title")?.value,$("topic")?.value,$("caption")?.value,$("pillar")?.value].filter(Boolean).join(" ");}
function bestForText(input){
 const words=[...new Set(imageWords(input))];
 const expanded=[...new Set(words.flatMap(w=>[w,...(imageSynonyms[w]||[])]))];
 const ranked=media.filter(x=>x.approved&&signedUrls[x.id]).map(m=>({m,score:ranking(m,expanded)})).sort((a,b)=>b.score-a.score);
 // A real, descriptive keyword match is required; never silently pick the first photo.
 return ranked[0]?.score>=3?{...ranked[0].m,score:ranked[0].score,url:signedUrls[ranked[0].m.id]}:null;
}
async function chooseForBuilder(input,{attach=true,force=false}={}){
 await loadMedia();
 const match=bestForText(input||currentTopic());
 if(!attach)return match;
 if(!$("postMedia"))return match;
 if($("postMedia").value&&!force){showAutoMessage("A photo is already selected. Keeping your choice.");return match;}
 if(!match){
  showAutoMessage("Image needed — no relevant approved photo found. Import Vuba photos or use Prepare image brief.");
  return null;
 }
 const select=$("postMedia");
 if(![...select.options].some(o=>o.value===match.id))select.add(new Option(match.description||match.filename,match.id));
 select.value=match.id;
 updateSelected();
 showAutoMessage("Suggested approved photo: "+(match.description||match.filename)+". Check it suits the post before publishing.");
 return match;
}
function showAutoMessage(message){
 const e=$("autoImageStatus");if(e)e.textContent=message;
}

function currentPost(){return {title:$("title")?.value?.trim()||"Vuba Wiltshire editorial post",topic:$("topic")?.value?.trim()||"",caption:$("caption")?.value?.trim()||"",pillar:$("pillar")?.value||"",channel:$("postChannel")?.value||"Instagram",format:$("format")?.value||"Single image"};}
function promptForPost(){
 const p=currentPost();
 const ratio=p.channel==="LinkedIn"?"wide landscape 1.91:1":p.channel==="Instagram"?"portrait 4:5":"square 1:1";
 return "Create a photorealistic social-media image for Vuba Wiltshire, a UK trade supplier for resin-bound installers and landscapers.\n"+
 "Post headline: "+p.title+"\nTopic: "+p.topic+"\nEditorial pillar: "+p.pillar+"\nPlatform: "+p.channel+"; preferred composition: "+ratio+".\n"+
 "Visual treatment: authentic British resin-bound trade photography, natural lighting, credible materials, professional editorial composition, clear space for optional headline overlay. Brand colours: Vuba blue #035b80 and red #821732 used only as subtle graphic accents.\n"+
 "Avoid: invented product packaging, fake Vuba logos, inaccurate installation techniques, stock or delivery claims, identifiable fabricated staff or premises, other brand marks, embedded text, phone numbers, watermarks.\n"+
 "Treat image as an illustration/concept until verified by the Vuba team; do not present a synthetic installation as a documented customer job.\n"+
 "Caption context (do not typeset): "+p.caption.slice(0,800);
}
function install(){
 if($("mediaStudioTools")||!$("postMedia")||!$("assetUploadForm"))return;
 const mediaLabel=$("postMedia").closest("label");
 mediaLabel.insertAdjacentHTML("afterend",`<div id="mediaStudioTools" class="media-tools">
 <div class="editor-extras"><button type="button" id="choosePostImage">Choose photo from library</button><button type="button" id="imageBrief">Prepare image brief</button></div>
 <div id="selectedPostPhoto" class="post-image-status">No approved image selected yet.</div><p id="autoImageStatus" class="hint" role="status">The builder will suggest an approved photo when preparing a draft.</p></div>`);
 const assetForm=$("assetUploadForm");
 assetForm.insertAdjacentHTML("afterend",`<div class="folder-import">
 <h3>Import a photo folder from your Mac</h3>
 <p class="hint">Choose the local <strong>OneDrive_1_19-11-2026</strong> folder, or a subfolder. Images are copied privately into the Studio. The original folder is left untouched. Files require approval before use.</p>
 <label>Confirm usage rights for the selected photos<input id="folderUsageRights" type="text" maxlength="300" placeholder="e.g. Vuba-owned photos, checked for subject permissions"></label>
 <label>Choose folder<input id="folderPicker" type="file" accept="image/jpeg,image/png,image/webp" webkitdirectory directory multiple></label>
 <div class="folder-import-actions"><button type="button" id="importFolder">Import selected photos</button><span class="hint" id="folderFileCount">No folder selected</span></div>
 <p id="folderImportStatus" role="status"></p>
 <p class="hint">10MB per image, 40 files per batch; for larger folders click Import next batch until complete. Other file types are skipped.</p>
 </div>`);
 const chooser=document.createElement("dialog");chooser.id="postImagePicker";
 chooser.innerHTML=`<div class="dialogHead"><h2>Choose a genuine Vuba image</h2><button id="closeImagePicker" type="button" aria-label="Close">×</button></div>
 <p class="hint">Suggested images are matched by filenames and descriptions, not AI analysis. Please inspect the photo before attaching it.</p>
 <label>Search approved photos<input id="imagePickerSearch" type="search" placeholder="blend, driveway, depot, installer…"></label>
 <div id="imagePickerGrid" class="image-picker-grid"></div>
 <div class="dialogActions"><button type="button" id="clearPostImage">Remove selected photo</button></div><p id="imagePickerMessage" role="status"></p>`;
 document.body.appendChild(chooser);
 const brief=document.createElement("dialog");brief.id="imageBriefDialog";
 brief.innerHTML=`<div class="dialogHead"><h2>Image brief for this post</h2><button type="button" id="closeImageBrief" aria-label="Close">×</button></div>
 <p>Generate a new visual here in ChatGPT using the brief below, then save and upload it to the private Creative library for approval.</p>
 <textarea id="imageBriefText" rows="15" readonly></textarea>
 <div class="dialogActions"><button type="button" id="copyImageBrief">Copy image brief</button></div><p id="briefFeedback" class="hint" role="status"></p>`;
 document.body.appendChild(brief);
 $("choosePostImage").onclick=async()=>{await loadMedia();selectedMedia=$("postMedia").value;chooser.showModal();drawPicker();};
 $("imageBrief").onclick=()=>{$("imageBriefText").value=promptForPost();$("briefFeedback").textContent="";brief.showModal();};
 $("copyImageBrief").onclick=async()=>{try{await navigator.clipboard.writeText($("imageBriefText").value);$("briefFeedback").textContent="Copied. Paste it in ChatGPT to generate a visual; return here to upload it for approval.";}catch{$("briefFeedback").textContent="Copy unavailable. Select the text in the box instead.";}}; 
 $("closeImagePicker").onclick=()=>chooser.close();
 $("closeImageBrief").onclick=()=>brief.close();
 $("imagePickerSearch").oninput=drawPicker;
 $("imagePickerGrid").onclick=e=>{
  const button=e.target.closest("button[data-media-id]");if(!button)return;
  const id=button.dataset.mediaId;
  const mediaSelect=$("postMedia");
  if(![...mediaSelect.options].some(o=>o.value===id)){
    const m=media.find(m=>m.id===id);mediaSelect.add(new Option(m?.description||m?.filename||"Selected photo",id));
  }
  mediaSelect.value=id;selectedMedia=id;updateSelected();chooser.close();
 };
 $("clearPostImage").onclick=()=>{$("postMedia").value="";selectedMedia="";updateSelected();chooser.close();};
 $("postMedia").onchange=()=>{updateSelected();showAutoMessage($("postMedia").value?"Photo selected manually. It will not be replaced automatically.":"No photo selected.");};
 $("folderPicker").onchange=()=>{batchOffset=0;$("folderFileCount").textContent=$("folderPicker").files.length+" selected files";$("importFolder").textContent="Import selected photos";};
 $("importFolder").onclick=importFolder;
 document.addEventListener("vuba-media-updated",loadMedia);
 updateSelected();
}
function updateSelected(){
 if(!$("selectedPostPhoto"))return;
 const id=$("postMedia")?.value;
 const m=media.find(x=>x.id===id);
 $("selectedPostPhoto").innerHTML=m&&signedUrls[id]?
  '<img src="'+safe(signedUrls[id])+'" alt="Selected approved photo"><span>'+safe(m.description||m.filename)+'</span>':
  'No approved image selected yet.';
}
async function loadMedia(){
 if(!signedIn)return;
 const ticket=++renderTicket;
 const {data,error}=await db.from("studio_media").select("id,filename,description,usage_rights,approved,file_path").eq("approved",true).is("archived_at",null).like("mime_type","image/%").order("created_at",{ascending:false}).limit(400);
 if(error){if($("imagePickerMessage"))$("imagePickerMessage").textContent=error.message;return;}
 const urls={};
 await Promise.all((data||[]).map(async m=>{
  const signed=await db.storage.from("vuba-approved-media").createSignedUrl(m.file_path,3600);
  if(signed.data?.signedUrl)urls[m.id]=signed.data.signedUrl;
 }));
 if(ticket!==renderTicket)return;
 media=data||[];signedUrls=urls;
 updateSelected();
}
function drawPicker(){
 const grid=$("imagePickerGrid");if(!grid)return;
 const term=$("imagePickerSearch").value.toLowerCase().trim();
 const words=imageWords(currentTopic());
 const matches=media.map(m=>({...m,score:ranking(m,words)})).filter(m=>!term||[m.filename,m.description,m.usage_rights].join(" ").toLowerCase().includes(term)).sort((a,b)=>b.score-a.score);
 grid.innerHTML=matches.map((m,i)=>`<button type="button" data-media-id="${safe(m.id)}" class="image-choice">
  <span class="image-choice-frame">${signedUrls[m.id]?'<img loading="lazy" src="'+safe(signedUrls[m.id])+'" alt="'+safe(m.description)+'">':"Photo unavailable"}</span>
  <span class="image-choice-copy"><strong>${safe(m.description||m.filename)}</strong><small>${i<3&&m.score>0?"Relevant filename match · ":""}${safe(m.filename)}</small></span></button>`).join("")||"<p>No approved photos match. Import your Mac folder and approve its images first.</p>";
}
async function importFolder(){
 const files=[...($("folderPicker").files||[])];
 const rights=$("folderUsageRights").value.trim();
 const out=$("folderImportStatus"),button=$("importFolder");
 if(!files.length){out.textContent="Choose your OneDrive photo folder first.";return;}
 if(!rights){out.textContent="Please confirm usage rights and any required subject permissions before importing.";return;}
 const images=files.filter(f=>permitted.has(f.type)||/\.(jpe?g|png|webp)$/i.test(f.name)).filter(f=>f.size>0&&f.size<=maxFile);
 if(!images.length){out.textContent="No JPEG, PNG or WebP files under 10MB were selected.";return;}
 // Explicit per-click upper limit prevents browser freeze and uncontrolled writes.
 const batch=images.slice(batchOffset,batchOffset+40);
 if(!batch.length){batchOffset=0;out.textContent="Import completed. Select another folder to continue.";return;}
 button.disabled=true;
 let uploaded=0,errors=[],skipped=files.length-images.length;
 for(let i=0;i<batch.length;i++){
  const file=batch[i],name=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100);
  const original=(file.webkitRelativePath||file.name).slice(0,500);
  out.textContent="Importing "+(batchOffset+i+1)+"/"+images.length+" · "+file.name;
  const path=signedIn.id+"/"+crypto.randomUUID()+"-"+name;
  const mime=file.type||(/\.png$/i.test(name)?"image/png":/\.webp$/i.test(name)?"image/webp":"image/jpeg");
  const {error:storageError}=await db.storage.from("vuba-approved-media").upload(path,file,{upsert:false,contentType:mime});
  if(storageError){errors.push(name+": "+storageError.message);continue;}
  const {error:metaError}=await db.from("studio_media").insert({file_path:path,filename:name,description:original,usage_rights:rights+" · Imported from "+original,mime_type:mime,uploaded_by:signedIn.id,approved:false});
  if(metaError){
   errors.push(name+": "+metaError.message);
   // Best-effort clean-up for an orphaned upload in the user's own folder.
   await db.storage.from("vuba-approved-media").remove([path]);
  }else uploaded++;
 }
 batchOffset+=batch.length;
 const remain=images.length-batchOffset;
 out.textContent=uploaded+" photo(s) imported in this batch, "+skipped+" unsupported/oversized skipped, "+errors.length+" failed. All imported photos await approval."+(errors.length?" First error: "+errors[0]:"")+(remain?" "+remain+" remaining. Click Import next batch.":" Folder import complete.");
 button.disabled=false;
 if(remain){button.textContent="Import next batch ("+Math.min(40,remain)+")";$("folderFileCount").textContent=batchOffset+" of "+images.length+" eligible images processed";}
 else{$("folderPicker").value="";$("folderFileCount").textContent="No folder selected";button.textContent="Import selected photos";batchOffset=0;}
 await window.VubaStudioPlus?.refresh?.();
}
async function start(u){
 signedIn=u;
 if(!u){$("postImagePicker")?.remove();$("imageBriefDialog")?.remove();$("mediaStudioTools")?.remove();return;}
 // workspace.js is a parallel ESM module. It creates the editor controls during its own init.
 for(let i=0;i<12&&!$("postMedia");i++)await new Promise(resolve=>setTimeout(resolve,120));
 if(!$("postMedia"))return;
 install();
 await loadMedia();
}
window.VubaMediaAssist={chooseForBuilder,bestForText,refresh:loadMedia};
await start(await getStudioUser());
onStudioAuth((user)=>{setTimeout(()=>start(user||null),0)});
