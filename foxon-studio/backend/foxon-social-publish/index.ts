// FOXON direct publisher. Explicit, authenticated manual posting ONLY.
// Refuses drafts and posts without approved review events. No scheduled automation.
import {createClient} from "npm:@supabase/supabase-js@2.58.0";
const origin="https://four2d.github.io";
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{...cors,"Cache-Control":"no-store"}});
function adminClient(){
 const url=Deno.env.get("SUPABASE_URL")||"";
 const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||"";
 if(!url||!secret)throw Error("server_not_configured");
 return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function getAdmin(req:Request,db:ReturnType<typeof createClient>){
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return null;
 const {data:{user},error}=await db.auth.getUser(auth.slice(7));if(error||!user)return null;
 const {data:member}=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
 return member?.role==="admin"?user.id:null;
}
const b64bytes=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function decrypt(cipher:string,iv:string){
 const raw=b64bytes(Deno.env.get("FOXON_SOCIAL_TOKEN_KEY_B64")||"");
 if(raw.length!==32)throw Error("token_key_not_configured");
 const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"]);
 const bytes=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64bytes(iv)},key,b64bytes(cipher));
 return new TextDecoder().decode(bytes);
}
async function graph(url:string,method="GET",body?:URLSearchParams|FormData){
 const response=await fetch(url,{method,body});
 if(!response.ok)throw Error("facebook_or_instagram_rejected_post");
 const result=await response.json();
 if(result.error)throw Error("facebook_or_instagram_rejected_post");
 return result;
}
async function facebook(accountId:string,token:string,caption:string,media:any,db:ReturnType<typeof createClient>){
 if(!media){
  const body=new URLSearchParams({message:caption,access_token:token});
  const r=await graph("https://graph.facebook.com/v24.0/"+encodeURIComponent(accountId)+"/feed","POST",body);
  if(!r.id)throw Error("facebook_unconfirmed_response");
  return String(r.id);
 }
 if(!media.mime_type?.startsWith("image/"))throw Error("facebook_video_not_yet_supported");
 const file=await db.storage.from("foxon-approved-media").download(media.file_path);
 if(file.error||!file.data)throw Error("approved_image_download_failed");
 const form=new FormData();
 form.append("source",file.data,media.filename||"foxon-image.png");
 form.append("caption",caption);
 form.append("access_token",token);
 const r=await graph("https://graph.facebook.com/v24.0/"+encodeURIComponent(accountId)+"/photos","POST",form);
 if(!r.id)throw Error("facebook_unconfirmed_response");
 return String(r.id);
}
async function instagram(accountId:string,token:string,caption:string,media:any,db:ReturnType<typeof createClient>){
 if(!media||!media.mime_type?.startsWith("image/"))throw Error("instagram_requires_approved_image");
 const signed=await db.storage.from("foxon-approved-media").createSignedUrl(media.file_path,3600);
 if(signed.error||!signed.data?.signedUrl)throw Error("instagram_image_unavailable");
 const created=await graph("https://graph.facebook.com/v24.0/"+encodeURIComponent(accountId)+"/media","POST",new URLSearchParams({
  image_url:signed.data.signedUrl,caption,access_token:token
 }));
 if(!created.id)throw Error("instagram_container_not_created");
 let ready=false;
 for(let i=0;i<12;i++){
  await new Promise(r=>setTimeout(r,1400));
  const u=new URL("https://graph.facebook.com/v24.0/"+encodeURIComponent(String(created.id)));
  u.search=new URLSearchParams({fields:"status_code",access_token:token}).toString();
  const result=await graph(u.toString());
  if(result.status_code==="FINISHED"){ready=true;break;}
  if(result.status_code==="ERROR"||result.status_code==="EXPIRED")throw Error("instagram_media_processing_failed");
 }
 if(!ready)throw Error("instagram_processing_not_confirmed_check_platform_before_retry");
 const published=await graph("https://graph.facebook.com/v24.0/"+encodeURIComponent(accountId)+"/media_publish","POST",new URLSearchParams({
  creation_id:String(created.id),access_token:token
 }));
 if(!published.id)throw Error("instagram_publish_not_confirmed_check_platform");
 return String(published.id);
}
async function linkedin(accountId:string,token:string,caption:string,media:any){
 if(media)throw Error("linkedin_image_publishing_not_yet_enabled");
 const res=await fetch("https://api.linkedin.com/rest/posts",{
  method:"POST",
  headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","Linkedin-Version":"202606","X-Restli-Protocol-Version":"2.0.0"},
  body:JSON.stringify({author:"urn:li:organization:"+accountId,commentary:caption,visibility:"PUBLIC",distribution:{feedDistribution:"MAIN_FEED",targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:"PUBLISHED",isReshareDisabledByAuthor:false})
 });
 if(!res.ok)throw Error("linkedin_api_denied_check_company_page_permissions");
 const id=res.headers.get("x-restli-id");
 if(!id)throw Error("linkedin_publish_response_not_confirmed_check_platform");
 return id;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 if(req.headers.get("Origin")!==origin)return json({error:"origin_not_allowed"},403);
 let deliveryId:string|null=null;
 let db:ReturnType<typeof createClient>|null=null;
 try{
  db=adminClient();
  const admin=await getAdmin(req,db);
  if(!admin)return json({error:"admin_required"},403);
  const body=await req.json().catch(()=>({}));
  if(body.action!=="publish"||typeof body.post_id!=="string"||typeof body.social_account_id!=="string")return json({error:"invalid_request"},400);
  if(!/^[0-9a-f-]{36}$/i.test(body.post_id)||!/^[0-9a-f-]{36}$/i.test(body.social_account_id))return json({error:"invalid_id"},400);
  const [p,a,prior]=await Promise.all([
   db.from("studio_posts").select("id,title,caption,status,format,channel,media_id,source_notes").eq("id",body.post_id).maybeSingle(),
   db.from("studio_social_accounts").select("id,platform,external_account_id,connection_status").eq("id",body.social_account_id).maybeSingle(),
   db.from("studio_publish_deliveries").select("id,status").eq("post_id",body.post_id).eq("social_account_id",body.social_account_id).maybeSingle()
  ]);
  if(p.error||!p.data||a.error||!a.data)return json({error:"post_or_account_not_found"},404);
  if(prior.error||prior.data)return json({error:"delivery_exists_reconcile_before_retry"},409);
  const post=p.data,account=a.data;
  if(post.channel!==account.platform||account.connection_status!=="connected")return json({error:"channel_or_connection_not_ready"},409);
  if(post.status!=="approved")return json({error:"post_requires_approved_status"},409);
  if(!post.caption?.trim()||!post.source_notes?.trim())return json({error:"caption_and_sources_required"},409);
  const review=await db.from("studio_review_events").select("id").eq("post_id",post.id).eq("action","approved").limit(1);
  if(review.error||!review.data?.length)return json({error:"recorded_human_approval_required"},409);
  let media:any=null;
  if(post.media_id){
   const result=await db.from("studio_media").select("id,approved,archived_at,usage_rights,mime_type,file_path,filename").eq("id",post.media_id).maybeSingle();
   media=result.data;
   if(result.error||!media||!media.approved||media.archived_at||!media.usage_rights?.trim())return json({error:"approved_rights_checked_image_required"},409);
  }else if(post.format!=="Text-led")return json({error:"post_requires_approved_image"},409);
  if(["Carousel","Reel","Video"].includes(post.format||""))return json({error:"this_media_format_requires_separate_integration"},409);
  if(account.platform==="Instagram"&&!media)return json({error:"instagram_requires_image"},409);
  if(account.platform==="LinkedIn"&&media)return json({error:"linkedin_image_not_yet_supported"},409);
  if(media&&!media.mime_type?.startsWith("image/"))return json({error:"video_not_yet_supported"},409);
  const tokenRow=await db.from("_foxon_social_tokens").select("token_ciphertext,token_iv,token_expires_at").eq("social_account_id",account.id).maybeSingle();
  if(tokenRow.error||!tokenRow.data)return json({error:"account_token_unavailable"},409);
  if(tokenRow.data.token_expires_at&&new Date(tokenRow.data.token_expires_at).getTime()<Date.now()){
   await db.from("studio_social_accounts").update({connection_status:"expired"}).eq("id",account.id);
   return json({error:"account_token_expired_reconnect"},409);
  }
  const token=await decrypt(tokenRow.data.token_ciphertext,tokenRow.data.token_iv);
  // Unique database constraint is an idempotency gate. Re-attempts require manual reconciliation.
  const inserted=await db.from("studio_publish_deliveries").insert({post_id:post.id,social_account_id:account.id,status:"sending"}).select("id").single();
  if(inserted.error||!inserted.data?.id)return json({error:"publishing_attempt_already_exists"},409);
  deliveryId=inserted.data.id;
  let externalId="";
  if(account.platform==="Facebook")externalId=await facebook(account.external_account_id,token,post.caption,media,db);
  else if(account.platform==="Instagram")externalId=await instagram(account.external_account_id,token,post.caption,media,db);
  else if(account.platform==="LinkedIn")externalId=await linkedin(account.external_account_id,token,post.caption,media);
  else throw Error("unsupported_platform");
  if(!externalId)throw Error("external_post_id_missing");
  const updated=await db.from("studio_publish_deliveries").update({status:"published",published_at:new Date().toISOString(),external_post_id:externalId,updated_at:new Date().toISOString(),last_error:null}).eq("id",deliveryId).select("id").maybeSingle();
  if(updated.error||!updated.data)throw Error("published_but_log_not_confirmed_check_platform");
  return json({success:true,status:"published",external_post_id:externalId,delivery_id:deliveryId});
 }catch(e){
  const message=String(e instanceof Error?e.message:"publishing_unavailable").slice(0,160);
  if(db&&deliveryId)await db.from("studio_publish_deliveries").update({status:"failed",last_error:message,updated_at:new Date().toISOString()}).eq("id",deliveryId);
  return json({error:message,delivery_id:deliveryId},deliveryId?502:503);
 }
});
