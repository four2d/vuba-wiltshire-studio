// FOXON direct publisher: authenticated Studio ADMIN actions only, from the Studio web origin.
//   publish     - send an approved post now (typed PUBLISH confirmation in the UI).
//   schedule    - queue an approved post for a UK date/time (same typed PUBLISH confirmation).
//   reschedule  - change time/destination of a waiting entry, or requeue a safely failed one.
//   cancel      - remove a waiting entry before it is sent.
//   resolve     - after an unconfirmed send, record what the admin found on the platform.
// Cron never calls this function; it calls foxon-social-scheduler. Instagram scheduling is off.
import {adminClient,getAdmin,loadTarget,deliver,PublishError,isUuid,scheduleWindowError,STUDIO_ORIGIN,type Db} from "../_shared/foxon-publish-core.ts";
const cors={"Access-Control-Allow-Origin":STUDIO_ORIGIN,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{...cors,"Cache-Control":"no-store"}});
const LIVE=["scheduled","sending","published","needs_reconciliation"];

async function liveSchedule(db:Db,postId:string,accountId:string){
 const r=await db.from("studio_publish_schedules").select("id,status").eq("post_id",postId).eq("social_account_id",accountId).in("status",LIVE).maybeSingle();
 if(r.error)throw new PublishError("database_unavailable",{retryable:true,status:503});
 return r.data;
}
function requireConfirm(body:any){if(body.confirm!=="PUBLISH")throw new PublishError("typed_publish_confirmation_required",{status:400});}

async function publishNow(db:Db,body:any){
 const t=await loadTarget(db,body.post_id,body.social_account_id,{allowInstagram:true});
 if(await liveSchedule(db,t.post.id,t.account.id))throw new PublishError("post_already_scheduled_cancel_first");
 const r=await deliver(db,t);
 return json({success:true,status:"published",external_post_id:r.externalId,delivery_id:r.deliveryId});
}
async function schedule(db:Db,admin:string,body:any){
 requireConfirm(body);
 const windowError=scheduleWindowError(body.scheduled_for);if(windowError)throw new PublishError(windowError,{status:400});
 const t=await loadTarget(db,body.post_id,body.social_account_id,{allowInstagram:false});
 const when=new Date(body.scheduled_for).toISOString();
 const ins=await db.from("studio_publish_schedules").insert({post_id:t.post.id,social_account_id:t.account.id,scheduled_for:when,next_attempt_at:when,status:"scheduled",created_by:admin,updated_by:admin}).select("id,scheduled_for,status").single();
 // The partial unique index makes a second live entry for the same post + destination impossible.
 if(ins.error)return json({error:ins.error.code==="23505"?"post_already_scheduled_for_this_account":"schedule_not_saved"},409);
 return json({success:true,schedule:ins.data});
}
async function getSchedule(db:Db,id:unknown){
 if(!isUuid(id))throw new PublishError("invalid_id",{status:400});
 const r=await db.from("studio_publish_schedules").select("*").eq("id",id).maybeSingle();
 if(r.error)throw new PublishError("database_unavailable",{retryable:true,status:503});
 if(!r.data)throw new PublishError("schedule_not_found",{status:404});
 return r.data;
}
async function reschedule(db:Db,admin:string,body:any){
 requireConfirm(body);
 const row=await getSchedule(db,body.schedule_id);
 if(!["scheduled","failed"].includes(row.status))throw new PublishError(row.status==="sending"?"already_sending_cannot_edit":"schedule_cannot_be_edited_in_status_"+row.status);
 const windowError=scheduleWindowError(body.scheduled_for);if(windowError)throw new PublishError(windowError,{status:400});
 const accountId=isUuid(body.social_account_id)?body.social_account_id:row.social_account_id;
 // Re-check every rule, including that nothing was ever delivered for this post + destination.
 const t=await loadTarget(db,row.post_id,accountId,{allowInstagram:false});
 const when=new Date(body.scheduled_for).toISOString();
 const upd=await db.from("studio_publish_schedules").update({social_account_id:t.account.id,scheduled_for:when,next_attempt_at:when,status:"scheduled",attempts:0,claimed_at:null,last_error:null,updated_by:admin,updated_at:new Date().toISOString()})
  .eq("id",row.id).eq("status",row.status).select("id,scheduled_for,status").maybeSingle();
 if(upd.error)return json({error:upd.error.code==="23505"?"post_already_scheduled_for_this_account":"schedule_not_saved"},409);
 if(!upd.data)throw new PublishError("schedule_changed_meanwhile_refresh");
 return json({success:true,schedule:upd.data});
}
async function cancel(db:Db,admin:string,body:any){
 const row=await getSchedule(db,body.schedule_id);
 // Only a waiting entry can be cancelled. The status filter makes this race-free against the scheduler claim.
 const upd=await db.from("studio_publish_schedules").update({status:"cancelled",cancelled_by:admin,cancelled_at:new Date().toISOString(),updated_by:admin,updated_at:new Date().toISOString()})
  .eq("id",row.id).eq("status","scheduled").select("id,status").maybeSingle();
 if(upd.error)throw new PublishError("database_unavailable",{retryable:true,status:503});
 if(!upd.data)throw new PublishError(row.status==="sending"?"already_sending_cannot_cancel":"schedule_cannot_be_cancelled_in_status_"+row.status);
 return json({success:true,schedule:upd.data});
}
async function resolve(db:Db,admin:string,body:any){
 const row=await getSchedule(db,body.schedule_id);
 if(row.status!=="needs_reconciliation")throw new PublishError("nothing_to_reconcile");
 const now=new Date().toISOString();
 if(body.outcome==="posted"){
  const external=typeof body.external_post_id==="string"?body.external_post_id.trim().slice(0,200):"";
  if(row.delivery_id)await db.from("studio_publish_deliveries").update({status:"published",published_at:now,updated_at:now,...(external?{external_post_id:external}:{})}).eq("id",row.delivery_id);
  const upd=await db.from("studio_publish_schedules").update({status:"published",published_at:now,external_post_id:external||row.external_post_id,last_error:"Confirmed posted by an admin after checking the platform.",updated_by:admin,updated_at:now}).eq("id",row.id).eq("status","needs_reconciliation").select("id,status").maybeSingle();
  if(!upd.data)throw new PublishError("schedule_changed_meanwhile_refresh");
  return json({success:true,schedule:upd.data});
 }
 if(body.outcome==="not_posted"){
  // The delivery row stays as the idempotency record, so this post + destination cannot be sent again
  // from Studio. Duplicate the post to try again: that is deliberate, it rules out double posting.
  const upd=await db.from("studio_publish_schedules").update({status:"cancelled",cancelled_by:admin,cancelled_at:now,last_error:"Admin confirmed it did not post. Duplicate the post to try again.",updated_by:admin,updated_at:now}).eq("id",row.id).eq("status","needs_reconciliation").select("id,status").maybeSingle();
  if(!upd.data)throw new PublishError("schedule_changed_meanwhile_refresh");
  return json({success:true,schedule:upd.data});
 }
 throw new PublishError("outcome_must_be_posted_or_not_posted",{status:400});
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 if(req.headers.get("Origin")!==STUDIO_ORIGIN)return json({error:"origin_not_allowed"},403);
 try{
  const db=adminClient();
  const admin=await getAdmin(req,db);
  if(!admin)return json({error:"admin_required"},403);
  const body=await req.json().catch(()=>({}));
  switch(body.action){
   case "publish":return await publishNow(db,body);
   case "schedule":return await schedule(db,admin,body);
   case "reschedule":return await reschedule(db,admin,body);
   case "cancel":return await cancel(db,admin,body);
   case "resolve":return await resolve(db,admin,body);
   default:return json({error:"invalid_request"},400);
  }
 }catch(e){
  if(e instanceof PublishError)return json({error:e.code,delivery_id:e.deliveryId,safe:e.safe},e.status);
  return json({error:"publishing_unavailable"},503);
 }
});
