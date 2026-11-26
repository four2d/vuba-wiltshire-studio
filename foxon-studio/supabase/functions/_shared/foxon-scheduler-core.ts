// FOXON scheduler loop, shared so it can be unit-tested without starting a server.
import {loadTarget,deliver,PublishError,nextAttemptAt,MISSED_WINDOW_HOURS,type Db} from "./foxon-publish-core.ts";
async function finish(db:Db,id:string,patch:Record<string,unknown>){
 // Only the run that claimed the row (status 'sending') may close it.
 await db.from("studio_publish_schedules").update({...patch,claimed_at:null,updated_at:new Date().toISOString()}).eq("id",id).eq("status","sending");
}
export async function runOnce(db:Db,nowMs=Date.now()){
 const claimed=await db.rpc("foxon_claim_due_schedules",{batch_size:10});
 if(claimed.error)throw Error("claim_failed");
 const results:{id:string;outcome:string;error?:string}[]=[];
 for(const row of claimed.data||[]){
  try{
   if(nowMs-Date.parse(row.scheduled_for)>MISSED_WINDOW_HOURS*3600000){
    await finish(db,row.id,{status:"failed",last_error:"Missed its slot by more than "+MISSED_WINDOW_HOURS+" hours (scheduler was off). Nothing was posted; pick a new time."});
    results.push({id:row.id,outcome:"failed",error:"missed_window"});continue;
   }
   const t=await loadTarget(db,row.post_id,row.social_account_id,{allowInstagram:false});
   const r=await deliver(db,t,async deliveryId=>{
    const link=await db.from("studio_publish_schedules").update({delivery_id:deliveryId,updated_at:new Date().toISOString()}).eq("id",row.id).eq("status","sending").select("id").maybeSingle();
    if(link.error||!link.data)throw Error("link_failed");
   });
   await finish(db,row.id,{status:"published",published_at:new Date().toISOString(),external_post_id:r.externalId,delivery_id:r.deliveryId,last_error:null});
   results.push({id:row.id,outcome:"published"});
  }catch(e){
   const err=e instanceof PublishError?e:new PublishError("scheduler_error",{safe:false});
   if(!err.safe){
    await finish(db,row.id,{status:"needs_reconciliation",delivery_id:err.deliveryId,last_error:"Not confirmed ("+err.code+"). Check the platform before doing anything else."});
    results.push({id:row.id,outcome:"needs_reconciliation",error:err.code});
   }else if(err.retryable&&row.attempts<row.max_attempts){
    await finish(db,row.id,{status:"scheduled",next_attempt_at:nextAttemptAt(row.attempts,nowMs),last_error:"Attempt "+row.attempts+" of "+row.max_attempts+" failed safely ("+err.code+"); retrying automatically. Nothing was posted."});
    results.push({id:row.id,outcome:"retry",error:err.code});
   }else{
    await finish(db,row.id,{status:"failed",last_error:"Not posted ("+err.code+"). Fix the issue, then edit the time to requeue."});
    results.push({id:row.id,outcome:"failed",error:err.code});
   }
  }
 }
 return results;
}
