import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.VUBA_CONFIG,db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const $=id=>document.getElementById(id);
const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const types={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm"};
const limit=45*1024*1024;
let user=null,role="",current="",items=[],folders=[],urls={},typeFilter="all",search="",queue=null,busy=false;
const lead=()=>role==="admin"||role==="approver";
const ext=name=>String(name||"").split(".").pop().toLowerCase();
function clean(path){
 return String(path||"").replace(/\\/g,"/").split("/").map(x=>x.trim()).filter(x=>x&&x!=="."&&x!=="..").join("/").slice(0,500);
}
function parents(path){
 const parts=clean(path).split("/").filter(Boolean);
 return parts.map((_,i)=>parts.slice(0,i+1).join("/"));
}
function build(){
 if(!$("assetsPanel")||$("mediaManager"))return;
 const panel=$("assetsPanel");
 const manager=document.createElement("div");manager.id="mediaManager";
 manager.innerHTML=`<div class="mm-header"><div><span class="studio-kicker">VISUAL ASSET WORKSPACE</span><h2>Everything worth sharing.</h2><p>A home for your best photography, video and branded content.</p></div><div class="mm-actions"><button type="button" id="mmNewFolder">＋ New folder</button><button type="button" id="mmSelectFolder">⇧ Import folder</button><button type="button" id="mmSelectFiles" class="mm-main">＋ Upload media</button></div></div>
 <div class="mm-import">
  <div id="mmDrop" class="mm-drop" tabindex="0" role="button"><span class="mm-drop-icon">⇧</span><strong>Drop photos, videos or folders</strong><span>Keep folder structure intact, even with nested folders</span><small>JPG · PNG · WebP · MP4 · MOV · WebM · maximum 45 MB per file</small></div>
  <label>Usage rights confirmation<input id="mmRights" maxlength="300" placeholder="e.g. FOXON-owned material, subject permissions checked"></label>
  <input id="mmFileInput" type="file" multiple hidden accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm">
  <input id="mmFolderInput" type="file" webkitdirectory directory multiple hidden>
  <p id="mmStatus" role="status"></p><button id="mmContinue" type="button" hidden>Import next batch →</button>
 </div>
 <div class="mm-toolbar"><div id="mmBreadcrumb" class="mm-breadcrumb"></div><div class="mm-controls"><input id="mmSearch" type="search" placeholder="Search media, tags or folder"><select id="mmType"><option value="all">All media</option><option value="photo">Photos</option><option value="video">Videos</option><option value="pending">Needs review</option><option value="approved">Approved</option></select><button id="mmRefresh" type="button">↻</button></div></div>
 <div class="mm-totals"><span id="mmTotal"></span><span id="mmPending"></span></div><div id="mmFolders" class="mm-folder-grid"></div><div id="mmGrid" class="mm-asset-grid"></div>`;
 panel.prepend(manager);
 const dialog=document.createElement("dialog");dialog.id="mmDialog";
 dialog.innerHTML=`<form id="mmForm"><div class="dialogHead"><h2>Asset details</h2><button type="button" id="mmClose">×</button></div>
 <input name="id" type="hidden"><label>Filename<input name="filename" readonly></label>
 <label>Description<input name="description" maxlength="300"></label><label>Folder<select name="folder_path"></select></label>
 <label>Tags<input name="tags" placeholder="invoice, cis, miles, gas"></label>
 <label>Usage rights<input name="usage_rights" maxlength="300"></label>
 <p class="hint">Organising an asset never changes the original private file.</p><p id="mmError" role="alert"></p>
 <div class="dialogActions"><button id="mmArchive" type="button" class="brain-danger-action">Archive asset</button><button type="submit">Save changes</button></div></form>`;
 document.body.appendChild(dialog);
 $("mmSelectFiles").onclick=()=>$("mmFileInput").click();
 $("mmSelectFolder").onclick=()=>$("mmFolderInput").click();
 $("mmFileInput").onchange=async()=>{await begin([...$("mmFileInput").files],false);$("mmFileInput").value="";};
 $("mmFolderInput").onchange=async()=>{await begin([...$("mmFolderInput").files],true);$("mmFolderInput").value="";};
 $("mmNewFolder").onclick=createFolder;
 $("mmContinue").onclick=processBatch;
 $("mmRefresh").onclick=load;
 $("mmSearch").oninput=e=>{search=e.target.value.toLowerCase();render();};
 $("mmType").onchange=e=>{typeFilter=e.target.value;render();};
 $("mmBreadcrumb").onclick=e=>{const b=e.target.closest("[data-path]");if(b)navigate(b.dataset.path);};
 $("mmFolders").onclick=e=>{const b=e.target.closest("[data-folder]");if(b)navigate(b.dataset.folder);};
 $("mmGrid").onclick=async e=>{
  const b=e.target.closest("[data-asset-action]");if(!b)return;
  const item=items.find(x=>x.id===b.dataset.id);if(!item)return;
  if(b.dataset.assetAction==="edit")edit(item);
  if(b.dataset.assetAction==="approve")await approve(item);
  if(b.dataset.assetAction==="open")await openAsset(item);
 };
 $("mmClose").onclick=()=>dialog.close();
 $("mmForm").onsubmit=save;
 $("mmArchive").onclick=archive;
 const zone=$("mmDrop");let depth=0;
 zone.ondragenter=e=>{e.preventDefault();depth++;zone.classList.add("dragging");};
 zone.ondragover=e=>e.preventDefault();
 zone.ondragleave=e=>{e.preventDefault();depth=Math.max(0,depth-1);if(!depth)zone.classList.remove("dragging");};
 zone.ondrop=async e=>{e.preventDefault();depth=0;zone.classList.remove("dragging");await dropped(e.dataTransfer);};
 zone.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("mmFileInput").click();}};
 zone.onclick=()=>$("mmFileInput").click();
}
async function walk(entry,prefix,out){
 if(entry.isFile){
  const file=await new Promise((res,rej)=>entry.file(res,rej));
  out.push({file,relative:clean(prefix+file.name)});
 }else if(entry.isDirectory){
  const reader=entry.createReader(),next=prefix+entry.name+"/";
  while(true){
   const group=await new Promise((res,rej)=>reader.readEntries(res,rej));
   if(!group.length)break;
   for(const child of group)await walk(child,next,out);
  }
 }
}
async function dropped(dt){
 const entries=[...(dt.items||[])].map(x=>x.webkitGetAsEntry?.()).filter(Boolean);
 if(entries.some(e=>e.isDirectory)){
  const out=[];
  try{for(const entry of entries)await walk(entry,"",out);}
  catch(e){$("mmStatus").textContent="Could not read folder: "+e.message;return;}
  await begin(out,true);
 }else await begin([...(dt.files||[])],false);
}
async function ensureFolder(path){
 for(const p of parents(path)){
  if(folders.some(x=>x.path===p))continue;
  const {error}=await db.from("studio_media_folders").insert({path:p,created_by:user.id});
  if(error&&error.code!=="23505")throw Error("Could not create folder "+p+": "+error.message);
  folders.push({path:p});
 }
}
async function begin(input,withFolders){
 if(busy)return;
 const rights=$("mmRights").value.trim();
 if(!rights){$("mmStatus").textContent="Confirm usage rights before importing.";return;}
 const records=input.map(x=>{
  const file=x.file||x,relative=clean(x.relative||file.webkitRelativePath||file.name),parts=relative.split("/");
  parts.pop();
  return {file,folder:withFolders?clean([current,...parts].filter(Boolean).join("/")):current};
 }).filter(x=>types[ext(x.file.name)]&&x.file.size>0);
 if(!records.length){$("mmStatus").textContent="No supported files were found.";return;}
 queue={records:records.filter(x=>x.file.size<=limit),skipped:records.filter(x=>x.file.size>limit).length,offset:0,success:0,errors:[],rights};
 if(!queue.records.length){$("mmStatus").textContent="Files exceed the current 45 MB upload limit.";return;}
 await processBatch();
}
async function processBatch(){
 if(!queue||busy)return;
 busy=true;$("mmContinue").hidden=true;
 const group=queue.records.slice(queue.offset,queue.offset+12);
 try{
  for(let i=0;i<group.length;i++){
   const {file,folder}=group[i],name=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-110);
   $("mmStatus").textContent="Importing "+(queue.offset+i+1)+" of "+queue.records.length+" · "+file.name;
   try{
    if(folder)await ensureFolder(folder);
    const path=user.id+"/"+crypto.randomUUID()+"-"+name;
    const upload=await db.storage.from("foxon-approved-media").upload(path,file,{contentType:types[ext(file.name)],upsert:false});
    if(upload.error)throw Error(upload.error.message);
    const added=await db.from("studio_media").insert({file_path:path,filename:file.name.slice(0,255),description:file.name,usage_rights:queue.rights,mime_type:types[ext(file.name)],folder_path:folder,tags:[],approved:false,uploaded_by:user.id});
    if(added.error){
     await db.storage.from("foxon-approved-media").remove([path]).catch(()=>{});
     throw Error(added.error.message);
    }
    queue.success++;
   }catch(e){queue.errors.push(file.name+": "+e.message);}
  }
  queue.offset+=group.length;
  const more=queue.offset<queue.records.length;
  $("mmStatus").textContent=queue.success+" uploaded · "+queue.skipped+" oversized skipped · "+queue.errors.length+" errors"+
   (queue.errors.length?" ("+queue.errors[0].slice(0,100)+")":"")+(more?" · "+(queue.records.length-queue.offset)+" remaining":" · Finished");
  $("mmContinue").hidden=!more;
  if(!more)queue=null;
  await load();
 }finally{busy=false;}
}
async function createFolder(){
 if(!user)return;
 const name=prompt("New folder name (use / for nested folders):");
 if(!name)return;
 const path=clean([current,name].filter(Boolean).join("/"));
 if(!path)return;
 try{await ensureFolder(path);navigate(path);await load();}
 catch(e){$("mmStatus").textContent=e.message;}
}
function navigate(path){current=clean(path);render();}
async function load(){
 if(!user||!$("mmGrid"))return;
 const [a,b]=await Promise.all([
  db.from("studio_media").select("*").order("created_at",{ascending:false}).limit(1000),
  db.from("studio_media_folders").select("path").order("path").limit(1000)
 ]);
 if(a.error||b.error){$("mmStatus").textContent=(a.error||b.error).message;return;}
 items=a.data||[];folders=b.data||[];urls={};
 await Promise.all(items.filter(x=>!x.archived_at).map(async m=>{
  const {data}=await db.storage.from("foxon-approved-media").createSignedUrl(m.file_path,1800);
  if(data?.signedUrl)urls[m.id]=data.signedUrl;
 }));
 render();
}
function render(){
 if(!$("mmGrid"))return;
 const crumb=[{path:"",name:"All media"}];
 current.split("/").filter(Boolean).forEach((part,i,all)=>crumb.push({path:all.slice(0,i+1).join("/"),name:part}));
 $("mmBreadcrumb").innerHTML=crumb.map((x,i)=>'<button type="button" data-path="'+safe(x.path)+'" '+(i===crumb.length-1?'disabled':'')+'>'+safe(x.name)+'</button>').join('<span>›</span>');
 const paths=[...new Set([...folders.map(x=>x.path),...items.flatMap(x=>parents(x.folder_path))])];
 const children=paths.filter(p=>p.startsWith(current?current+"/":"")&&p!==current&&p.slice(current?current.length+1:0).indexOf("/")<0);
 $("mmFolders").innerHTML=children.map(path=>'<button class="mm-folder" data-folder="'+safe(path)+'" type="button"><span>▰</span><strong>'+safe(path.split("/").pop())+'</strong><small>'+items.filter(m=>m.folder_path===path&&!m.archived_at).length+' items</small></button>').join("");
 const visible=items.filter(m=>!m.archived_at&&m.folder_path===current&&(!search||[m.filename,m.description,...(m.tags||[])].join(" ").toLowerCase().includes(search))&&
 (typeFilter==="all"||typeFilter==="photo"&&m.mime_type.startsWith("image/")||typeFilter==="video"&&m.mime_type.startsWith("video/")||typeFilter==="pending"&&!m.approved||typeFilter==="approved"&&m.approved));
 $("mmTotal").textContent=items.filter(x=>!x.archived_at).length+" total assets";
 $("mmPending").textContent=items.filter(x=>!x.approved&&!x.archived_at).length+" awaiting review";
 $("mmGrid").innerHTML=visible.map(m=>{
  const isVideo=m.mime_type.startsWith("video/"),url=urls[m.id]||"";
  const thumb=url?(isVideo?'<video preload="metadata" muted playsinline src="'+safe(url)+'#t=0.1"></video>':'<img loading="lazy" src="'+safe(url)+'" alt="'+safe(m.description)+'">'):'<div class="mm-placeholder">Private asset</div>';
  return '<article class="mm-asset"><div class="mm-thumb">'+thumb+(isVideo?'<span class="mm-video-badge">▶ VIDEO</span>':'')+'</div><div class="mm-asset-body"><span class="mm-state '+(m.approved?'ok':'pending')+'">'+(m.approved?'✓ Approved':'● Needs review')+'</span><strong>'+safe(m.description||m.filename)+'</strong><small>'+safe(m.filename)+'</small><div class="mm-asset-buttons"><button type="button" data-asset-action="open" data-id="'+safe(m.id)+'">View</button>'+(lead()?'<button type="button" data-asset-action="edit" data-id="'+safe(m.id)+'">Organise</button>'+(!m.approved?'<button type="button" data-asset-action="approve" data-id="'+safe(m.id)+'">Approve</button>':''):'')+'</div></div></article>';
 }).join("")||'<p class="mm-empty">No assets here yet. Drop files above or choose a folder to explore.</p>';
}
async function openAsset(m){
 const {data,error}=await db.storage.from("foxon-approved-media").createSignedUrl(m.file_path,300);
 if(error||!data?.signedUrl){$("mmStatus").textContent=error?.message||"Cannot open file.";return;}
 window.open(data.signedUrl,"_blank","noopener,noreferrer");
}
async function approve(m){
 if(!lead()||!confirm("Confirm this media is accurate and you have checked usage rights?"))return;
 const {error}=await db.from("studio_media").update({approved:true}).eq("id",m.id);
 if(error){$("mmStatus").textContent=error.message;return;}await load();await window.VubaStudioPlus?.refresh?.();
}
function edit(m){
 if(!lead())return;
 const f=$("mmForm");f.reset();
 f.elements.id.value=m.id;f.elements.filename.value=m.filename;
 f.elements.description.value=m.description;
 f.elements.usage_rights.value=m.usage_rights;
 f.elements.tags.value=(m.tags||[]).join(", ");
 f.elements.folder_path.innerHTML='<option value="">All media / Unsorted</option>'+[...new Set([...folders.map(x=>x.path),...items.flatMap(x=>parents(x.folder_path))])].sort().map(p=>'<option value="'+safe(p)+'">'+safe(p)+'</option>').join("");
 f.elements.folder_path.value=m.folder_path||"";
 $("mmError").textContent="";$("mmDialog").showModal();
}
async function save(e){
 e.preventDefault();if(!lead())return;
 const f=e.currentTarget,p={description:f.elements.description.value.trim(),usage_rights:f.elements.usage_rights.value.trim(),
 folder_path:f.elements.folder_path.value,tags:f.elements.tags.value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,20)};
 const {error}=await db.from("studio_media").update(p).eq("id",f.elements.id.value);
 if(error){$("mmError").textContent=error.message;return;}
 $("mmDialog").close();await load();await window.VubaStudioPlus?.refresh?.();
}
async function archive(){
 if(!lead())return;
 if(!confirm("Archive this media? It will be hidden from the active library. The original file is preserved."))return;
 const id=$("mmForm").elements.id.value;
 const {error}=await db.from("studio_media").update({archived_at:new Date().toISOString()}).eq("id",id);
 if(error){$("mmError").textContent=error.message;return;}
 $("mmDialog").close();await load();await window.VubaStudioPlus?.refresh?.();
}
async function init(u){
 user=u;
 if(!u){$("mediaManager")?.remove();$("mmDialog")?.remove();return;}
 const {data}=await db.from("studio_members").select("role").eq("user_id",u.id).maybeSingle();
 if(!data)return;role=data.role;
 for(let i=0;i<30&&!$("assetsPanel");i++)await new Promise(resolve=>setTimeout(resolve,100));
 build();await load();
}
const {data:{session}}=await db.auth.getSession();await init(session?.user||null);
db.auth.onAuthStateChange((_,session)=>setTimeout(()=>init(session?.user||null),0));
