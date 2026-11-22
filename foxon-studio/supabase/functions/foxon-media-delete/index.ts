import {createClient} from "npm:@supabase/supabase-js@2.58.0";
const origin="https://four2d.github.io";
const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store","Vary":"Origin"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST"||req.headers.get("Origin")!==origin)return json({error:"unsupported_request"},403);
 try{
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer "))return json({error:"unauthorised"},401);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||"";
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await db.auth.getUser(auth.slice(7));
  if(authError||!user)return json({error:"unauthorised"},401);
  const member=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
  if(member.data?.role!=="admin")return json({error:"administrator_required"},403);
  const {id}=await req.json();
  if(typeof id!=="string"||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return json({error:"invalid_asset"},400);
  const prepared=await db.rpc("foxon_prepare_media_delete",{asset_id:id});
  if(prepared.error?.code==="P7022")return json({error:"media_in_use"},409);
  if(prepared.error)return json({error:"could_not_prepare_deletion"},500);
  if(prepared.data===null)return json({deleted:true});
  const removed=await db.storage.from("foxon-approved-media").remove([prepared.data]);
  if(removed.error)return json({error:"could_not_remove_file"},502);
  const finished=await db.from("studio_media").delete().eq("id",id).not("deletion_started_at","is",null);
  if(finished.error)return json({error:"could_not_complete_deletion"},500);
  return json({deleted:true});
 }catch{return json({error:"deletion_failed"},500);}
});
