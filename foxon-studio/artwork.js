import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const c=window.VUBA_CONFIG;
const db=createClient(c.supabaseUrl,c.supabaseAnonKey);
const $=id=>document.getElementById(id);
let busy=false;
let lastGenerated=null;
const stillPost=()=>JSON.stringify([$("postId")?.value,readPost()]);
function readPost(){
 return {title:$("title")?.value.trim()||"",topic:$("topic")?.value.trim()||"",caption:$("caption")?.value.trim()||"",channel:$("postChannel")?.value||"Instagram"};
}
function insertControls(){
 if($("generateFOXONArt")||!$("mediaStudioTools"))return false;
 $("mediaStudioTools").insertAdjacentHTML("beforeend",`<section id="foxonArtworkSection" class="foxon-art-generator">
 <h3>Artwork for this post</h3>
 <p class="hint">Create a relevant FOXON image. Generated images are saved privately to the Media Library.</p>
 <label>Art direction<select id="foxonArtStyle"><option value="photography">Realistic trade photography</option><option value="branded">Bold branded artwork</option><option value="phone">Smartphone mockup (screen placeholder)</option></select></label>
 <label class="foxon-art-checkbox"><input id="foxonAutoArt" type="checkbox" checked> Automatically create artwork when saving a new post without an image</label>
 <button id="generateFOXONArt" type="button">Generate / regenerate artwork</button>
 <div id="foxonArtStatus" role="status" aria-live="polite">No artwork generated for this draft yet.</div>
 <div id="foxonArtPreview" hidden></div>
 </section>`);
 $("generateFOXONArt").onclick=()=>generate();
 $("postMedia")?.addEventListener("change",()=>{
  const preview=$("foxonArtPreview");
  if(preview&&$("postMedia").value!==lastGenerated)preview.hidden=true;
 });
 return true;
}
function notify(message){if($("foxonArtStatus"))$("foxonArtStatus").textContent=message;}
async function makeArtwork(post,style="photography"){
  const {data:{session},error:sessionError}=await db.auth.getSession();
  if(sessionError||!session?.user)throw Error("Please sign in again.");
  const {data,error}=await db.functions.invoke("foxon-generate-artwork",{
   body:{...post,style}
  });
  if(error){
   const details=await error.context?.json?.().catch(()=>null);
   throw Object.assign(Error(details?.code==="NOT_CONFIGURED"?"AI artwork is not configured for this Studio. You can still choose an image from the Media Library.":details?.error||error.message),{code:details?.code});
  }
  if(data?.error)throw Error(data.error);
  if(!data?.image)throw Error("No artwork returned by the image generator.");
  const blob=base64Blob(data.image,"image/png");
  if(blob.size>10*1024*1024)throw Error("Generated image exceeds the 10 MB media limit.");
  const path=session.user.id+"/generated/"+crypto.randomUUID()+".png";
  const uploaded=await db.storage.from("foxon-approved-media").upload(path,blob,{contentType:"image/png",upsert:false});
  if(uploaded.error)throw Error("Image storage failed: "+uploaded.error.message);
  const record=await db.from("studio_media").insert({
   file_path:path,filename:"foxon-generated-"+post.channel.toLowerCase()+".png",
   description:"Generated "+post.channel+" artwork — "+(post.title||post.topic).slice(0,160),
   usage_rights:"AI-generated for FOXON; check brand accuracy and approve before use",
   mime_type:"image/png",uploaded_by:session.user.id,approved:false
  }).select("id,filename,description").single();
  if(record.error){
   await db.storage.from("foxon-approved-media").remove([path]);
   throw Error("Image record failed: "+record.error.message);
  }
 return {record:record.data,path};
}
window.FoxonGenerateArtworkForPost=async post=>{
 if(post.format==="Text-led")return false;
 const {record}=await makeArtwork(post,post.format==="Branded graphic"?"branded":"photography");
 const result=await db.from("studio_posts").update({media_id:record.id}).eq("id",post.id).eq("status","draft").is("media_id",null).select("id").maybeSingle();
 if(result.error)throw result.error;
 return Boolean(result.data);
};
function base64Blob(encoded,mime){
 const raw=atob(encoded), bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return new Blob([bytes],{type:mime});
}
async function generate(){
 if(busy)return null;
 if(!insertControls()&&!$("foxonArtStatus"))return null;
 const post=readPost();
 if(!post.title&&!post.topic&&!post.caption){notify("Add a headline, topic or caption before generating artwork.");return null;}
 const postAtStart=stillPost(),imageAtStart=$("postMedia")?.value;
 busy=true;
 const button=$("generateFOXONArt");button.disabled=true;button.textContent="Generating artwork…";
 notify("Creating FOXON artwork. It will be saved privately.");
 try{
  const asset=await makeArtwork(post,$("foxonArtStyle")?.value||"photography");
  if(!$("editor")?.open||stillPost()!==postAtStart||$("postMedia")?.value!==imageAtStart){notify("Artwork saved to the Media Library. The current post was left as edited.");return null;}
  const select=$("postMedia");
  const option=new Option(asset.record.description,asset.record.id);
  select.add(option);select.value=asset.record.id;
  lastGenerated=asset.record.id;
  select.dispatchEvent(new Event("change"));
  const signed=await db.storage.from("foxon-approved-media").createSignedUrl(asset.path,3600);
  if(signed.data?.signedUrl){
   const frame=$("foxonArtPreview");frame.hidden=false;
   frame.replaceChildren();
   const img=document.createElement("img");img.src=signed.data.signedUrl;img.alt="New generated FOXON artwork";
   frame.append(img);
  }
  notify("Generated artwork saved privately and attached to this draft.");
  document.dispatchEvent(new Event("vuba-media-updated"));
  return asset.record.id;
 }catch(e){
  notify("Artwork unavailable: "+(e?.message||String(e)));
  return null;
 }finally{
  busy=false;button.disabled=false;button.textContent="Generate / regenerate artwork";
 }
}
window.FoxonArtworkGenerate=generate;
window.FoxonArtworkAutoOnSave=async()=>{
 if(!$("foxonAutoArt")?.checked||$("postMedia")?.value||$("format")?.value==="Text-led")return;
 const result=await generate();
 if(!result&&$("editorError"))$("editorError").textContent="Post will be saved without new artwork. "+$("foxonArtStatus")?.textContent;
};
const observer=new MutationObserver(()=>{if($("mediaStudioTools"))insertControls();});
observer.observe(document.body,{childList:true,subtree:true});
insertControls();
