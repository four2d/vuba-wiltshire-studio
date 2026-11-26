// FOXON Studio publishing core, shared by foxon-social-publish (admin, browser) and
// foxon-social-scheduler (cron). Server-only. Never import this from browser code.
//
// Idempotency model (nothing may double-post):
//  1. Everything that can fail WITHOUT making anything public happens first ("prepare"):
//     validation, token decryption, image download, LinkedIn image upload, Instagram container.
//     A failure here is "safe": the caller may retry.
//  2. Then one row is inserted into studio_publish_deliveries. Its unique (post, account)
//     constraint is the final gate: a second attempt for the same pair can never get past it.
//  3. Only then is the single irreversible provider call made ("commit"). Any failure from this
//     point is "unsafe": the provider may have posted, so it is never retried automatically.
import {createClient,type SupabaseClient} from "npm:@supabase/supabase-js@2.58.0";

export const STUDIO_ORIGIN="https://four2d.github.io";
export const LINKEDIN_VERSION="202606";
export const LINKEDIN_IMAGE_TYPES=["image/jpeg","image/png","image/gif"];
export type Db=SupabaseClient;
export type Platform="Facebook"|"Instagram"|"LinkedIn";

/** safe: nothing reached the public feed. retryable: worth trying again later (transient). */
export class PublishError extends Error{
 code:string;safe:boolean;retryable:boolean;deliveryId:string|null;status:number;
 constructor(code:string,opts:{safe?:boolean;retryable?:boolean;deliveryId?:string|null;status?:number}={}){
  super(code);this.code=code;this.safe=opts.safe??true;this.retryable=opts.retryable??false;
  this.deliveryId=opts.deliveryId??null;this.status=opts.status??409;
 }
}
const safeTransient=(code:string)=>new PublishError(code,{safe:true,retryable:true,status:503});
const safeFinal=(code:string,status=409)=>new PublishError(code,{safe:true,retryable:false,status});

export function adminClient():Db{
 const url=Deno.env.get("SUPABASE_URL")||"";
 const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||"";
 if(!url||!secret)throw safeTransient("server_not_configured");
 return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function getAdmin(req:Request,db:Db):Promise<string|null>{
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return null;
 const {data:{user},error}=await db.auth.getUser(auth.slice(7));if(error||!user)return null;
 const {data:member}=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
 return member?.role==="admin"?user.id:null;
}
const b64bytes=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function decrypt(cipher:string,iv:string){
 const raw=b64bytes(Deno.env.get("FOXON_SOCIAL_TOKEN_KEY_B64")||"");
 if(raw.length!==32)throw safeTransient("token_key_not_configured");
 const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"]);
 const bytes=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64bytes(iv)},key,b64bytes(cipher));
 return new TextDecoder().decode(bytes);
}
export const isUuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export type Target={post:any;account:any;media:any|null};

/** Load post, destination and media and apply every publishing rule. Throws safe PublishErrors. */
export async function loadTarget(db:Db,postId:string,accountId:string,opts:{allowInstagram:boolean}):Promise<Target>{
 if(!isUuid(postId)||!isUuid(accountId))throw safeFinal("invalid_id",400);
 const [p,a,prior]=await Promise.all([
  db.from("studio_posts").select("id,title,caption,status,format,channel,media_id,source_notes").eq("id",postId).maybeSingle(),
  db.from("studio_social_accounts").select("id,platform,external_account_id,display_name,connection_status").eq("id",accountId).maybeSingle(),
  db.from("studio_publish_deliveries").select("id,status").eq("post_id",postId).eq("social_account_id",accountId).maybeSingle()
 ]);
 if(p.error||a.error||prior.error)throw safeTransient("database_unavailable");
 if(!p.data||!a.data)throw safeFinal("post_or_account_not_found",404);
 if(prior.data)throw safeFinal("delivery_exists_reconcile_before_retry");
 const post=p.data,account=a.data;
 if(account.platform==="Instagram"&&!opts.allowInstagram)throw safeFinal("instagram_scheduling_disabled");
 if(post.channel!==account.platform)throw safeFinal("channel_does_not_match_destination");
 if(account.connection_status!=="connected")throw safeFinal("account_not_connected_reconnect");
 if(post.status!=="approved")throw safeFinal("post_requires_approved_status");
 if(!post.caption?.trim()||!post.source_notes?.trim())throw safeFinal("caption_and_sources_required");
 const review=await db.from("studio_review_events").select("id").eq("post_id",post.id).eq("action","approved").limit(1);
 if(review.error)throw safeTransient("database_unavailable");
 if(!review.data?.length)throw safeFinal("recorded_human_approval_required");
 if(["Carousel","Reel","Video"].includes(post.format||""))throw safeFinal("this_media_format_requires_separate_integration");
 let media:any=null;
 if(post.media_id){
  const result=await db.from("studio_media").select("id,approved,archived_at,mime_type,file_path,filename,description").eq("id",post.media_id).maybeSingle();
  if(result.error)throw safeTransient("database_unavailable");
  media=result.data;
  // Uploads no longer carry a rights field (simplified Media Library, PR #1); approval + not archived is the gate.
  if(!media||!media.approved||media.archived_at)throw safeFinal("approved_image_required");
  if(!media.mime_type?.startsWith("image/"))throw safeFinal("video_not_yet_supported");
  if(account.platform==="LinkedIn"&&!LINKEDIN_IMAGE_TYPES.includes(media.mime_type))throw safeFinal("linkedin_image_must_be_jpeg_png_or_gif");
 }else if(post.format!=="Text-led")throw safeFinal("post_requires_approved_image");
 if(account.platform==="Instagram"&&!media)throw safeFinal("instagram_requires_image");
 return {post,account,media};
}

async function accountToken(db:Db,account:any){
 const row=await db.from("_foxon_social_tokens").select("token_ciphertext,token_iv,token_expires_at").eq("social_account_id",account.id).maybeSingle();
 if(row.error)throw safeTransient("database_unavailable");
 if(!row.data)throw safeFinal("account_token_unavailable");
 if(row.data.token_expires_at&&new Date(row.data.token_expires_at).getTime()<Date.now()){
  await db.from("studio_social_accounts").update({connection_status:"expired"}).eq("id",account.id);
  throw safeFinal("account_token_expired_reconnect");
 }
 try{return await decrypt(row.data.token_ciphertext,row.data.token_iv);}
 catch(e){if(e instanceof PublishError)throw e;throw safeFinal("account_token_unreadable_reconnect");}
}
async function downloadApproved(db:Db,media:any):Promise<Blob>{
 const file=await db.storage.from("foxon-approved-media").download(media.file_path);
 if(file.error||!file.data)throw safeTransient("approved_image_download_failed");
 return file.data;
}

// ---------- Meta ----------
async function graph(url:string,method="GET",body?:URLSearchParams|FormData,stage:"prepare"|"commit"="commit"){
 let response:Response;
 try{response=await fetch(url,{method,body,signal:AbortSignal.timeout(30000)});}
 catch{if(stage==="prepare")throw safeTransient("meta_unreachable");throw new PublishError("meta_no_response_check_platform",{safe:false});}
 const result=await response.json().catch(()=>({}));
 if(!response.ok||result.error){
  if(stage==="prepare")throw new PublishError("meta_rejected_request",{safe:true,retryable:response.status>=500||response.status===429});
  throw new PublishError("facebook_or_instagram_rejected_post",{safe:false});
 }
 return result;
}
type Commit=()=>Promise<string>;
async function prepareFacebook(db:Db,t:Target,token:string):Promise<Commit>{
 const id=encodeURIComponent(t.account.external_account_id);
 if(!t.media)return async()=>{
  const r=await graph("https://graph.facebook.com/v24.0/"+id+"/feed","POST",new URLSearchParams({message:t.post.caption,access_token:token}));
  if(!r.id)throw new PublishError("facebook_unconfirmed_response",{safe:false});
  return String(r.id);
 };
 const blob=await downloadApproved(db,t.media);
 return async()=>{
  const form=new FormData();
  form.append("source",blob,t.media.filename||"foxon-image.png");
  form.append("caption",t.post.caption);
  form.append("access_token",token);
  const r=await graph("https://graph.facebook.com/v24.0/"+id+"/photos","POST",form);
  if(!r.id)throw new PublishError("facebook_unconfirmed_response",{safe:false});
  return String(r.id);
 };
}
async function prepareInstagram(db:Db,t:Target,token:string):Promise<Commit>{
 const id=encodeURIComponent(t.account.external_account_id);
 const signed=await db.storage.from("foxon-approved-media").createSignedUrl(t.media.file_path,3600);
 if(signed.error||!signed.data?.signedUrl)throw safeTransient("instagram_image_unavailable");
 // An unpublished media container is not visible to anyone, so this is still the safe stage.
 const created=await graph("https://graph.facebook.com/v24.0/"+id+"/media","POST",new URLSearchParams({image_url:signed.data.signedUrl,caption:t.post.caption,access_token:token}),"prepare");
 if(!created.id)throw safeTransient("instagram_container_not_created");
 let ready=false;
 for(let i=0;i<12;i++){
  await new Promise(r=>setTimeout(r,1400));
  const u=new URL("https://graph.facebook.com/v24.0/"+encodeURIComponent(String(created.id)));
  u.search=new URLSearchParams({fields:"status_code",access_token:token}).toString();
  const result=await graph(u.toString(),"GET",undefined,"prepare");
  if(result.status_code==="FINISHED"){ready=true;break;}
  if(result.status_code==="ERROR"||result.status_code==="EXPIRED")throw safeFinal("instagram_media_processing_failed");
 }
 if(!ready)throw safeTransient("instagram_media_still_processing");
 return async()=>{
  const published=await graph("https://graph.facebook.com/v24.0/"+id+"/media_publish","POST",new URLSearchParams({creation_id:String(created.id),access_token:token}));
  if(!published.id)throw new PublishError("instagram_publish_not_confirmed_check_platform",{safe:false});
  return String(published.id);
 };
}

// ---------- LinkedIn ----------
const liHeaders=(token:string)=>({"Authorization":"Bearer "+token,"Linkedin-Version":LINKEDIN_VERSION,"X-Restli-Protocol-Version":"2.0.0"});
/** LinkedIn "little text": these characters are reserved in Posts API commentary and must be escaped,
    otherwise text after them can be dropped. A # directly followed by a letter or digit is left alone so
    hashtags keep working. */
export function escapeLinkedInCommentary(text:string){
 return String(text).replace(/[\\|{}@\[\]()<>*_~#]/g,(c,offset:number,all:string)=>c==="#"&&/[\p{L}\p{N}]/u.test(all[offset+1]||"")?c:"\\"+c);
}
export function isLinkedInUploadUrl(value:string){
 try{const u=new URL(value);return u.protocol==="https:"&&/(^|\.)(linkedin\.com|licdn\.com)$/i.test(u.hostname);}catch{return false;}
}
/** Images API: initializeUpload, then PUT the bytes, then wait until LinkedIn has processed it.
    An uploaded image is private until a post references it, so all of this is the safe stage. */
export async function uploadLinkedInImage(orgId:string,token:string,blob:Blob,fetcher:typeof fetch=fetch,sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))):Promise<string>{
 let init:Response;
 try{
  init=await fetcher("https://api.linkedin.com/rest/images?action=initializeUpload",{method:"POST",headers:{...liHeaders(token),"Content-Type":"application/json"},
   body:JSON.stringify({initializeUploadRequest:{owner:"urn:li:organization:"+orgId}})});
 }catch{throw safeTransient("linkedin_unreachable");}
 if(!init.ok)throw new PublishError(init.status===401||init.status===403?"linkedin_image_upload_denied_check_page_permissions":"linkedin_image_upload_not_started",{safe:true,retryable:init.status>=500||init.status===429});
 const value=(await init.json().catch(()=>({})))?.value||{};
 const uploadUrl=String(value.uploadUrl||""),image=String(value.image||"");
 if(!image.startsWith("urn:li:image:")||!isLinkedInUploadUrl(uploadUrl))throw safeTransient("linkedin_image_upload_response_invalid");
 let put:Response;
 try{put=await fetcher(uploadUrl,{method:"PUT",headers:{"Authorization":"Bearer "+token,"Content-Type":blob.type||"application/octet-stream"},body:blob});}
 catch{throw safeTransient("linkedin_image_upload_interrupted");}
 if(!put.ok)throw new PublishError("linkedin_image_upload_failed",{safe:true,retryable:put.status>=500||put.status===429});
 for(let i=0;i<10;i++){
  let status="";
  try{
   const check=await fetcher("https://api.linkedin.com/rest/images/"+encodeURIComponent(image),{headers:liHeaders(token)});
   if(check.ok)status=String((await check.json().catch(()=>({})))?.status||"");
  }catch{/* keep polling */}
  if(status==="AVAILABLE")return image;
  if(status==="PROCESSING_FAILED")throw safeFinal("linkedin_image_processing_failed");
  await sleep(1500);
 }
 throw safeTransient("linkedin_image_still_processing");
}
export function linkedInPostBody(orgId:string,caption:string,image?:{urn:string;altText:string}){
 const body:Record<string,unknown>={author:"urn:li:organization:"+orgId,commentary:escapeLinkedInCommentary(caption),visibility:"PUBLIC",
  distribution:{feedDistribution:"MAIN_FEED",targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:"PUBLISHED",isReshareDisabledByAuthor:false};
 if(image)body.content={media:{id:image.urn,altText:image.altText.slice(0,4000)}};
 return body;
}
async function prepareLinkedIn(db:Db,t:Target,token:string,fetcher:typeof fetch=fetch):Promise<Commit>{
 const orgId=String(t.account.external_account_id);
 if(!/^\d+$/.test(orgId))throw safeFinal("linkedin_organization_id_invalid");
 let image:{urn:string;altText:string}|undefined;
 if(t.media){
  const blob=await downloadApproved(db,t.media);
  image={urn:await uploadLinkedInImage(orgId,token,blob,fetcher),altText:String(t.media.description||t.post.title||"FOXON Software")};
 }
 return async()=>{
  let res:Response;
  try{res=await fetcher("https://api.linkedin.com/rest/posts",{method:"POST",headers:{...liHeaders(token),"Content-Type":"application/json"},body:JSON.stringify(linkedInPostBody(orgId,t.post.caption,image))});}
  catch{throw new PublishError("linkedin_no_response_check_platform",{safe:false});}
  if(!res.ok)throw new PublishError("linkedin_api_denied_check_company_page_permissions",{safe:false});
  const id=res.headers.get("x-restli-id");
  if(!id)throw new PublishError("linkedin_publish_response_not_confirmed_check_platform",{safe:false});
  return id;
 };
}

/** Run one delivery end to end. onDelivery runs after the idempotency row exists and BEFORE the
    provider call, so callers can link it (the scheduler stores it on the schedule row). */
export async function deliver(db:Db,t:Target,onDelivery?:(deliveryId:string)=>Promise<void>):Promise<{deliveryId:string;externalId:string}>{
 const token=await accountToken(db,t.account);
 let commit:Commit;
 if(t.account.platform==="Facebook")commit=await prepareFacebook(db,t,token);
 else if(t.account.platform==="Instagram")commit=await prepareInstagram(db,t,token);
 else if(t.account.platform==="LinkedIn")commit=await prepareLinkedIn(db,t,token);
 else throw safeFinal("unsupported_platform");
 const inserted=await db.from("studio_publish_deliveries").insert({post_id:t.post.id,social_account_id:t.account.id,status:"sending"}).select("id").single();
 if(inserted.error||!inserted.data?.id)throw new PublishError("publishing_attempt_already_exists",{safe:false});
 const deliveryId=String(inserted.data.id);
 const fail=async(code:string)=>{await db.from("studio_publish_deliveries").update({status:"failed",last_error:code.slice(0,160),updated_at:new Date().toISOString()}).eq("id",deliveryId);};
 try{if(onDelivery)await onDelivery(deliveryId);}
 catch{await fail("not_sent_link_failed");throw new PublishError("delivery_link_failed_nothing_sent",{safe:false,deliveryId});}
 let externalId="";
 try{externalId=await commit();}
 catch(e){
  const code=e instanceof PublishError?e.code:"provider_call_failed_check_platform";
  await fail(code);
  throw new PublishError(code,{safe:false,deliveryId,status:502});
 }
 if(!externalId){await fail("external_post_id_missing");throw new PublishError("external_post_id_missing",{safe:false,deliveryId,status:502});}
 const now=new Date().toISOString();
 const updated=await db.from("studio_publish_deliveries").update({status:"published",published_at:now,external_post_id:externalId,updated_at:now,last_error:null}).eq("id",deliveryId).select("id").maybeSingle();
 if(updated.error||!updated.data)throw new PublishError("published_but_log_not_confirmed_check_platform",{safe:false,deliveryId,status:502});
 return {deliveryId,externalId};
}

// ---------- Scheduling rules (mirrors foxon-studio/schedule-time.js) ----------
export const MIN_LEAD_MINUTES=5,MAX_DAYS_AHEAD=90,MISSED_WINDOW_HOURS=6;
export const RETRY_BACKOFF_MINUTES=[5,15,45];
export function scheduleWindowError(iso:string,nowMs=Date.now()){
 const ms=Date.parse(iso||"");
 if(!Number.isFinite(ms))return "invalid_time";
 if(ms<nowMs+MIN_LEAD_MINUTES*60000)return "time_must_be_in_future";
 if(ms>nowMs+MAX_DAYS_AHEAD*86400000)return "time_too_far_ahead";
 return null;
}
export function nextAttemptAt(attempts:number,nowMs=Date.now()){
 const minutes=RETRY_BACKOFF_MINUTES[Math.min(Math.max(attempts,1),RETRY_BACKOFF_MINUTES.length)-1];
 return new Date(nowMs+minutes*60000).toISOString();
}
export function constantTimeEqual(a:string,b:string){
 const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
 let diff=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]??0)^(y[i]??0);
 return diff===0&&x.length>0;
}
