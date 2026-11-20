import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cfg=window.VUBA_CONFIG;
const db=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const $=id=>document.getElementById(id);
const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const bucket="vuba-brain-documents";
const maxBytes=15*1024*1024;
const maxText=120000;
const allowed=["pdf","docx","txt","md"];
let user=null,role=null,documents=[],busy=false;
function ext(name){return String(name||"").split(".").pop().toLowerCase();}
function mimeFor(name){return ({pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",txt:"text/plain",md:"text/markdown"})[ext(name)]||"";}
function textLimit(s){const str=String(s||"").replace(/\u0000/g,"");return {text:str.slice(0,maxText),truncated:str.length>maxText};}
async function extract(file){
 const kind=ext(file.name);
 if(kind==="txt"||kind==="md"){
  const raw=await file.text();const result=textLimit(raw);
  return {text:result.text,status:result.truncated?"partial":"extracted",note:result.truncated?"Text truncated to 120,000 characters.":"Text indexed for search."};
 }
 if(kind==="docx"){
  try{
   const JSZip=(await import("https://esm.sh/jszip@3.10.1")).default;
   const zip=await JSZip.loadAsync(await file.arrayBuffer());
   const xml=await zip.file("word/document.xml")?.async("string");
   if(!xml)return {text:"",status:"unavailable",note:"Word text was not found. The file is safely stored."};
   const doc=new DOMParser().parseFromString(xml,"text/xml");
   const paragraphs=[...doc.getElementsByTagName("w:p")];
   const raw=paragraphs.map(p=>[...p.getElementsByTagName("w:t")].map(n=>n.textContent).join("")).filter(Boolean).join("\n");
   const result=textLimit(raw);
   return {text:result.text,status:result.truncated?"partial":"extracted",note:result.truncated?"Extracted Word text was truncated.":"Word paragraphs indexed for search."};
  }catch(e){return {text:"",status:"unavailable",note:"Word text extraction unavailable: "+String(e?.message||e).slice(0,120)};}
 }
 if(kind==="pdf"){
  try{
   const pdfjs=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
   pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
   const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
   const parts=[];
   let chars=0;
   const pages=Math.min(pdf.numPages,60);
   for(let i=1;i<=pages&&chars<maxText;i++){
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    const text=content.items.map(item=>item.str||"").join(" ");
    parts.push("[Page "+i+"] "+text);
    chars+=text.length;
   }
   const result=textLimit(parts.join("\n\n"));
   const partial=pages<pdf.numPages||result.truncated;
   return {text:result.text,status:result.text.trim()?(partial?"partial":"extracted"):"unavailable",
    note:!result.text.trim()?"Scanned/image-only PDF: original stored; add searchable notes manually.":partial?"Text extracted from first 60 pages or until text limit.":"PDF text indexed for search."};
  }catch(e){return {text:"",status:"unavailable",note:"PDF text extraction unavailable: "+String(e?.message||e).slice(0,120)};}
 }
 return {text:"",status:"unavailable",note:"Unsupported file type"};
}
function build(){
 const root=$("vubaBrain");if(!root||$("brainDocumentZone"))return;
 const section=document.createElement("section");section.id="brainDocumentZone";section.className="brain-document-zone";
 section.innerHTML=`<div class="brain-doc-heading"><div><span class="studio-kicker">SOURCE LIBRARY</span><h3>Reference documents</h3><p>Keep your product guides, brand files and team notes together. Stored privately for your team.</p></div><span id="brainDocumentTotal" class="brain-doc-total"></span></div>
 <div id="brainDropzone" class="brain-dropzone" role="button" tabindex="0" aria-label="Upload reference documents">
  <div class="brain-drop-icon">⇧</div><strong>Drop documents here</strong><span>or <button type="button" id="brainBrowseFiles">browse your files</button></span>
  <small>PDF, Word (.docx), text and Markdown · up to 15 MB each · maximum 10 at once</small>
  <input type="file" id="brainFiles" multiple hidden accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
 </div>
 <div id="brainUploadFeedback" class="brain-upload-feedback" role="status"></div>
 <div class="brain-doc-tools"><label>Find a document<input type="search" id="brainDocumentSearch" placeholder="Search filenames, notes or extracted text"></label>
 <label>Review status<select id="brainDocumentFilter"><option value="">All documents</option><option value="needs_review">Needs review</option><option value="approved">Approved</option><option value="superseded">Superseded</option></select></label>
 <label class="brain-archived-toggle"><input type="checkbox" id="brainDocsArchived"> Show archived</label></div>
 <div id="brainDocumentList" class="brain-document-list" aria-live="polite"></div>`;
 const filter=root.querySelector(".brain-filter");
 root.insertBefore(section,filter);
 const picker=$("brainFiles"),zone=$("brainDropzone");
 $("brainBrowseFiles").onclick=e=>{e.stopPropagation();picker.click();};
 zone.onclick=e=>{if(!e.target.closest("#brainBrowseFiles"))picker.click();};
 zone.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();picker.click();}};
 picker.onchange=async()=>{await uploadFiles([...picker.files]);picker.value="";};
 let dragDepth=0;
 zone.ondragenter=e=>{e.preventDefault();dragDepth++;zone.classList.add("dragging");};
 zone.ondragover=e=>e.preventDefault();
 zone.ondragleave=e=>{e.preventDefault();dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)zone.classList.remove("dragging");};
 zone.ondrop=async e=>{e.preventDefault();dragDepth=0;zone.classList.remove("dragging");await uploadFiles([...e.dataTransfer.files]);};
 $("brainDocumentSearch").oninput=render;
 $("brainDocumentFilter").onchange=render;
 $("brainDocsArchived").onchange=render;
 $("brainDocumentList").onclick=async e=>{
  const button=e.target.closest("button[data-doc-action]");if(!button)return;
  const doc=documents.find(d=>d.id===button.dataset.docId);if(!doc)return;
  const action=button.dataset.docAction;
  if(action==="open")await openDocument(doc);
  if(action==="edit")openEditor(doc);
 };
 const d=document.createElement("dialog");d.id="brainDocumentDialog";
 d.innerHTML=`<form id="brainDocumentForm"><div class="dialogHead"><h2>Document details</h2><button type="button" id="brainDocClose">×</button></div>
 <input name="id" type="hidden"><label>Document title<input name="title" maxlength="250" required></label>
 <label>Description and reference notes<textarea name="description" rows="4" maxlength="8000" placeholder="What is this document? Which claims should be checked?"></textarea></label>
 <div class="fields"><label>Review status<select name="verification"><option value="needs_review">Needs review</option><option value="approved">Approved</option><option value="superseded">Superseded</option></select></label></div>
 <label>Searchable document text<textarea name="extracted_text" rows="10" maxlength="120000" placeholder="Document text will be extracted where supported. Paste corrected text or a summary when extraction fails."></textarea></label>
 <p class="hint">Editing approved information resets its approval, requiring a separate review. The uploaded original is retained privately.</p>
 <p id="brainDocEditorMessage" role="alert"></p><div class="dialogActions"><button type="button" id="brainDocArchive" class="brain-danger-action">Archive document</button><button type="submit">Save changes</button></div></form>`;
 document.body.appendChild(d);
 $("brainDocClose").onclick=()=>d.close();
 $("brainDocumentForm").onsubmit=saveDocument;
 $("brainDocArchive").onclick=archiveDocument;
}
async function uploadFiles(files){
 if(busy)return;
 const message=$("brainUploadFeedback");
 if(files.length>10){message.textContent="Please upload up to 10 documents at a time.";return;}
 if(!files.length)return;
 busy=true;
 const errors=[];let success=0;
 try{
  for(let i=0;i<files.length;i++){
   const file=files[i],type=mimeFor(file.name);
   if(!allowed.includes(ext(file.name))||!type||!file.size||file.size>maxBytes){errors.push(file.name+": unsupported type or over 15 MB.");continue;}
   message.textContent="Processing "+(i+1)+"/"+files.length+": "+file.name;
   const extracted=await extract(file);
   const path=user.id+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-130);
   const uploaded=await db.storage.from(bucket).upload(path,file,{contentType:type,upsert:false});
   if(uploaded.error){errors.push(file.name+": "+uploaded.error.message);continue;}
   const saved=await db.from("studio_brain_documents").insert({
    filename:file.name.slice(0,255),title:file.name.replace(/\.[^.]+$/,"").slice(0,250),
    storage_path:path,mime_type:type,file_size:file.size,
    extracted_text:extracted.text,extraction_status:extracted.status,
    description:extracted.note,uploaded_by:user.id,updated_by:user.id,verification:"needs_review"
   });
   if(saved.error){
    await db.storage.from(bucket).remove([path]).catch(()=>{});
    errors.push(file.name+": "+saved.error.message);continue;
   }
   success++;
  }
  message.textContent=success+" document(s) added for review."+ (errors.length?" Issues: "+errors.join(" | ").slice(0,450):"")+" Originals stored privately; extracted text is searchable.";
  await load();
 }finally{busy=false;}
}
async function load(){
 if(!user||!$("brainDocumentList"))return;
 const {data,error}=await db.from("studio_brain_documents").select("*").order("created_at",{ascending:false}).limit(300);
 if(error){$("brainUploadFeedback").textContent="Couldn't load documents: "+error.message;return;}
 documents=data||[];render();
}
function render(){
 if(!$("brainDocumentList"))return;
 const query=$("brainDocumentSearch").value.toLowerCase().trim(),status=$("brainDocumentFilter").value,archived=$("brainDocsArchived").checked;
 const visible=documents.filter(d=>(archived||!d.archived_at)&&(!status||d.verification===status)&&(!query||[d.title,d.filename,d.description,d.extracted_text].join(" ").toLowerCase().includes(query)));
 $("brainDocumentTotal").textContent=documents.filter(d=>!d.archived_at).length+" files";
 $("brainDocumentList").innerHTML=visible.map(d=>`<article class="brain-document-row">
 <span class="brain-doc-filetype">${safe(ext(d.filename).toUpperCase())}</span>
 <div class="brain-doc-info"><strong>${safe(d.title)}</strong><small>${safe(d.filename)} · ${Math.max(1,Math.round(d.file_size/1024))} KB · ${new Date(d.created_at).toLocaleDateString("en-GB")}</small>
 <span>${safe(d.description).slice(0,165)} ${d.extraction_status==="unavailable"?"· Searchable text needs attention":""}</span></div>
 <div class="brain-doc-actions"><span class="brain-status brain-${safe(d.verification)}">${d.archived_at?"Archived":safe(d.verification.replace("_"," "))}</span><button type="button" data-doc-action="open" data-doc-id="${safe(d.id)}">Open file</button>
 ${["admin","approver"].includes(role)?'<button type="button" data-doc-action="edit" data-doc-id="'+safe(d.id)+'">Edit / archive</button>':""}</div></article>`).join("")||'<div class="brain-doc-empty">No documents found. Drop a document above to create your reference library.</div>';
}
async function openDocument(doc){
 const {data,error}=await db.storage.from(bucket).createSignedUrl(doc.storage_path,300);
 if(error||!data?.signedUrl){$("brainUploadFeedback").textContent=error?.message||"Could not open private document.";return;}
 window.open(data.signedUrl,"_blank","noopener,noreferrer");
}
function openEditor(doc){
 if(!["admin","approver"].includes(role))return;
 const form=$("brainDocumentForm");form.reset();
 for(const key of ["id","title","description","verification","extracted_text"])form.elements[key].value=doc[key]||"";
 $("brainDocEditorMessage").textContent="";
 $("brainDocArchive").hidden=false;
 $("brainDocArchive").textContent=doc.archived_at?"Restore document":"Archive document";
 $("brainDocumentDialog").showModal();
}
async function saveDocument(e){
 e.preventDefault();if(!["admin","approver"].includes(role))return;
 const form=e.currentTarget,id=form.elements.id.value;
 const payload={title:form.elements.title.value.trim(),description:form.elements.description.value.trim(),
 extracted_text:form.elements.extracted_text.value.trim(),verification:form.elements.verification.value,updated_by:user.id};
 const {error}=await db.from("studio_brain_documents").update(payload).eq("id",id);
 if(error){$("brainDocEditorMessage").textContent=error.message;return;}
 $("brainDocumentDialog").close();await load();
}
async function archiveDocument(){
 if(!["admin","approver"].includes(role))return;
 const id=$("brainDocumentForm").elements.id.value;
 const doc=documents.find(x=>x.id===id),restoring=!!doc?.archived_at;
 if(!confirm(restoring?"Restore this document to the active Brain library?":"Archive this document? It will disappear from active search, but the original remains available in Show archived."))return;
 const {error}=await db.from("studio_brain_documents").update({archived_at:restoring?null:new Date().toISOString(),updated_by:user.id}).eq("id",id);
 if(error){$("brainDocEditorMessage").textContent=error.message;return;}
 $("brainDocumentDialog").close();await load();
}
async function init(u){
 user=u;if(!u){$("brainDocumentDialog")?.remove();$("brainDocumentZone")?.remove();documents=[];return;}
 const {data}=await db.from("studio_members").select("role").eq("user_id",u.id).maybeSingle();
 if(!data)return;role=data.role;
 for(let i=0;i<25&&!$("vubaBrain");i++)await new Promise(r=>setTimeout(r,100));
 if(!$("vubaBrain"))return;
 build();await load();
}
const {data:{session}}=await db.auth.getSession();await init(session?.user||null);
db.auth.onAuthStateChange((_,session)=>setTimeout(()=>init(session?.user||null),0));
