// FOXON scheduled publishing worker. Called ONLY by Supabase Cron (pg_cron + pg_net), never by browsers.
// Deploy with --no-verify-jwt: it authenticates with the x-foxon-scheduler-secret header instead.
// Two independent off switches: FOXON_SCHEDULER_ENABLED must be "true", and the cron job must exist.
import {adminClient,constantTimeEqual} from "../_shared/foxon-publish-core.ts";
import {runOnce} from "../_shared/foxon-scheduler-core.ts";
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const expected=Deno.env.get("FOXON_SCHEDULER_SECRET")||"";
 if(!expected)return json({error:"scheduler_not_configured"},503);
 if(!constantTimeEqual(req.headers.get("x-foxon-scheduler-secret")||"",expected))return json({error:"forbidden"},403);
 if(Deno.env.get("FOXON_SCHEDULER_ENABLED")!=="true")return json({skipped:true,reason:"scheduler_disabled"});
 try{return json({ok:true,results:await runOnce(adminClient())});}
 catch{return json({error:"scheduler_run_failed"},503);}
});
