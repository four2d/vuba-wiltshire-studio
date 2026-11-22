// FOXON direct social OAuth, server-only. No social credentials in GitHub Pages.
// Not a publishing endpoint. Accounts are connected only after provider verification.
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
const site="https://four2d.github.io";
const returnUrl="https://four2d.github.io/vuba-wiltshire-studio/foxon-studio/?social_connect=done#home";
const env=(key:string)=>Deno.env.get(key)||"";
const base=env("SUPABASE_URL");
const endpoint=base+"/functions/v1/foxon-social-oauth";
const config={
 Facebook:{client:env("FOXON_META_APP_ID"),secret:env("FOXON_META_APP_SECRET"),auth:"https://www.facebook.com/v24.0/dialog/oauth",scope:"pages_show_list,pages_read_engagement,pages_manage_posts"},
 Instagram:{client:env("FOXON_META_APP_ID"),secret:env("FOXON_META_APP_SECRET"),auth:"https://www.facebook.com/v24.0/dialog/oauth",scope:"pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish"},
 LinkedIn:{client:env("FOXON_LINKEDIN_CLIENT_ID"),secret:env("FOXON_LINKEDIN_CLIENT_SECRET"),auth:"https://www.linkedin.com/oauth/v2/authorization",scope:"w_organization_social r_organization_social"}
};
const cors={ "Access-Control-Allow-Origin":site,"Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin" };
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const redirect=(status:string)=>Response.redirect(returnUrl.replace("social_connect=done","social_connect="+encodeURIComponent(status)),302);
const toBase64=(arr:Uint8Array)=>btoa(String.fromCharCode(...arr));
const fromBase64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function sha256(v:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function encrypt(token:string){
 const b64=env("FOXON_SOCIAL_TOKEN_KEY_B64");
 const raw=fromBase64(b64);if(raw.length!==32)throw Error("encryption_setup_missing");
 const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt"]);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const enc=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(token)));
 return {token_ciphertext:toBase64(enc),token_iv:toBase64(iv)};
}
function secretsConfigured(p:"Facebook"|"Instagram"|"LinkedIn"){return Boolean(config[p].client&&config[p].secret&&env("FOXON_SOCIAL_TOKEN_KEY_B64"));}
function adminClient(){
 const secret=env("SUPABASE_SERVICE_ROLE_KEY")||(JSON.parse(env("SUPABASE_SECRET_KEYS")||"{}").default||"");
 if(!base||!secret)throw Error("backend_not_ready");
 return createClient(base,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function checkedAdmin(req:Request,db:ReturnType<typeof createClient>){
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return null;
 const {data:{user},error}=await db.auth.getUser(auth.slice(7));
 if(error||!user)return null;
 const member=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
 if(member.error||member.data?.role!=="admin")return null;
 return user.id;
}
async function saveVerified(db:ReturnType<typeof createClient>,platform:string,id:string,name:string,owner:string,token:string,expires:number|null){
 if(!id||!name||!token)return false;
 const enc=await encrypt(token);
 const info={platform,external_account_id:id,display_name:name,connection_status:"connected",connected_at:new Date().toISOString(),last_checked_at:new Date().toISOString(),last_error:null,created_by:owner,updated_at:new Date().toISOString()};
 const result=await db.from("studio_social_accounts").upsert(info,{onConflict:"platform,external_account_id"}).select("id").single();
 if(result.error||!result.data?.id)throw Error("account_save_failed");
 const meta=await db.from("_foxon_social_tokens").upsert({social_account_id:result.data.id,...enc,token_expires_at:expires?new Date(Date.now()+expires*1000).toISOString():null,updated_at:new Date().toISOString()},{onConflict:"social_account_id"});
 if(meta.error){await db.from("studio_social_accounts").update({connection_status:"error",last_error:"Token storage failed"}).eq("id",result.data.id);throw Error("credential_save_failed");}
 return true;
}
async function fetchJson(url:string,headers:Record<string,string>={}){
 const res=await fetch(url,{headers});
 if(!res.ok)throw Error("provider_api_denied");
 return await res.json();
}
async function exchangeMeta(code:string,platform:"Facebook"|"Instagram",db:ReturnType<typeof createClient>,owner:string){
 const c=config[platform],url=new URL("https://graph.facebook.com/v24.0/oauth/access_token");
 url.search=new URLSearchParams({client_id:c.client,client_secret:c.secret,redirect_uri:endpoint,code}).toString();
 const tokenResult=await fetchJson(url.toString());
 if(!tokenResult.access_token)throw Error("meta_token_missing");
 // Long-lived user token is exchanged server-side. Page tokens are stored encrypted.
 const longUrl=new URL("https://graph.facebook.com/v24.0/oauth/access_token");
 longUrl.search=new URLSearchParams({grant_type:"fb_exchange_token",client_id:c.client,client_secret:c.secret,fb_exchange_token:tokenResult.access_token}).toString();
 const long=await fetchJson(longUrl.toString());
 const userToken=long.access_token||tokenResult.access_token;
 const pages=new URL("https://graph.facebook.com/v24.0/me/accounts");
 pages.search=new URLSearchParams({fields:"id,name,tasks,access_token,instagram_business_account{id,username}",access_token:userToken}).toString();
 const pageResult=await fetchJson(pages.toString());
 let total=0;
 for(const page of pageResult.data||[]){
  if(!page.access_token)continue;
  if(platform==="Facebook"&&page.id&&page.name){
   await saveVerified(db,"Facebook",page.id,page.name,owner,page.access_token,null);total++;
  }
  if(platform==="Instagram"&&page.instagram_business_account?.id){
   const ig=page.instagram_business_account;
   await saveVerified(db,"Instagram",ig.id,ig.username||"Instagram "+ig.id,owner,page.access_token,null);total++;
  }
 }
 if(!total)throw Error("no_eligible_meta_pages");
 return total;
}
async function exchangeLinkedIn(code:string,db:ReturnType<typeof createClient>,owner:string){
 const c=config.LinkedIn;
 const body=new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:endpoint,client_id:c.client,client_secret:c.secret});
 const res=await fetch("https://www.linkedin.com/oauth/v2/accessToken",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
 if(!res.ok)throw Error("linkedin_token_exchange_denied");
 const token=await res.json();if(!token.access_token)throw Error("linkedin_token_missing");
 const headers={Authorization:"Bearer "+token.access_token,"Linkedin-Version":"202606","X-Restli-Protocol-Version":"2.0.0"};
 const acl=await fetchJson("https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",headers);
 const ids=[...new Set((acl.elements||[]).map((v:any)=>String(v.organization||"").match(/urn:li:organization:(\d+)/)?.[1]).filter(Boolean))];
 let count=0;
 for(const id of ids){
  const org=await fetchJson("https://api.linkedin.com/rest/organizations/"+id,headers);
  const name=org.localizedName||org.name;
  if(!name)continue;
  await saveVerified(db,"LinkedIn",id,String(name),owner,token.access_token,token.expires_in||null);count++;
 }
 if(!count)throw Error("linkedin_organisation_access_required");
 return count;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 const url=new URL(req.url);
 try{
  const db=adminClient();
  if(req.method==="GET"&&url.searchParams.has("state")){
   const state=url.searchParams.get("state")||"",code=url.searchParams.get("code")||"";
   if(!state||!code)return redirect("cancelled");
   const hash=await sha256(state);
   const record=await db.from("_foxon_social_oauth_state").select("platform,requester,expires_at,consumed_at").eq("state_hash",hash).maybeSingle();
   const r=record.data;
   if(record.error||!r||r.consumed_at||new Date(r.expires_at).getTime()<Date.now())return redirect("expired");
   const used=await db.from("_foxon_social_oauth_state").update({consumed_at:new Date().toISOString()}).eq("state_hash",hash).is("consumed_at",null).select("state_hash").maybeSingle();
   if(used.error||!used.data)return redirect("expired");
   if(!secretsConfigured(r.platform as "Facebook"|"Instagram"|"LinkedIn"))return redirect("not_configured");
   try{
    if(r.platform==="LinkedIn")await exchangeLinkedIn(code,db,r.requester);
    else await exchangeMeta(code,r.platform as "Facebook"|"Instagram",db,r.requester);
    return redirect("connected");
   }catch(e){return redirect(String(e instanceof Error?e.message:"provider_error").slice(0,70));}
  }
  if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
  if(req.headers.get("Origin")!==site)return respond({error:"origin_not_allowed"},403);
  const userId=await checkedAdmin(req,db);
  if(!userId)return respond({error:"admin_authorisation_required"},403);
  const input=await req.json().catch(()=>({}));
  if(input.action==="status")return respond({platforms:Object.fromEntries(Object.keys(config).map(k=>[k,{ready:secretsConfigured(k as keyof typeof config),redirect_uri:endpoint}]))});
  if(input.action!=="begin")return respond({error:"unknown_action"},400);
  const platform=input.platform;
  if(!Object.hasOwn(config,platform))return respond({error:"unknown_platform"},400);
  if(!secretsConfigured(platform as "Facebook"|"Instagram"|"LinkedIn"))return respond({error:"developer_app_setup_required"},409);
  const raw=toBase64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
  const hash=await sha256(raw);
  const stored=await db.from("_foxon_social_oauth_state").insert({state_hash:hash,requester:userId,platform,expires_at:new Date(Date.now()+600000).toISOString()});
  if(stored.error)return respond({error:"oauth_state_setup_failed"},500);
  const c=config[platform as keyof typeof config];
  const auth=new URL(c.auth);auth.search=new URLSearchParams({response_type:"code",client_id:c.client,redirect_uri:endpoint,state:raw,scope:c.scope}).toString();
  return respond({authorization_url:auth.toString()});
 }catch(_e){return respond({error:"social_connector_unavailable"},503);}
});
