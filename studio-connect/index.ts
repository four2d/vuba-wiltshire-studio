// Shared Studio social connections, operator-owned OAuth app and tenant-isolated accounts.
// Does not publish posts. Provider credentials and encrypted tokens never leave this function.
import {createClient} from "npm:@supabase/supabase-js@2.58.0";
type Tenant="vuba"|"foxon";
type Platform="Facebook"|"Instagram"|"LinkedIn";
const env=(n:string)=>Deno.env.get(n)||"";
const centralUrl=env("SUPABASE_URL");
const centralSecret=env("SUPABASE_SERVICE_ROLE_KEY")||(JSON.parse(env("SUPABASE_SECRET_KEYS")||"{}").default||"");
const site="https://four2d.github.io";
const tenantConfigs={
 vuba:{url:"https://iwituhhojivokiueekdb.supabase.co",key:"sb_publishable_f7Bdh8sMtoBaqUFix-7zfg_MAGjTQsZ",redirect:"https://four2d.github.io/vuba-wiltshire-studio/studio-v1/?studio_connect=done#connections"},
 foxon:{url:"https://mpmcxxfowxohghhxrmgm.supabase.co",key:"sb_publishable_U5UrSWNwRw0Hw5tPnbmMFA_4MHVmfMU",redirect:"https://four2d.github.io/vuba-wiltshire-studio/foxon-studio/?studio_connect=done#connections"}
} as const;
const platforms={
 Facebook:{client:env("STUDIO_META_APP_ID"),secret:env("STUDIO_META_APP_SECRET"),auth:"https://www.facebook.com/v24.0/dialog/oauth",scope:"pages_show_list,pages_read_engagement,pages_manage_posts"},
 Instagram:{client:env("STUDIO_META_APP_ID"),secret:env("STUDIO_META_APP_SECRET"),auth:"https://www.facebook.com/v24.0/dialog/oauth",scope:"pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish"},
 LinkedIn:{client:env("STUDIO_LINKEDIN_CLIENT_ID"),secret:env("STUDIO_LINKEDIN_CLIENT_SECRET"),auth:"https://www.linkedin.com/oauth/v2/authorization",scope:"w_organization_social r_organization_social rw_organization_admin"}
} as const;
const endpoint=centralUrl+"/functions/v1/studio-connect";
const cors={"Access-Control-Allow-Origin":site,"Access-Control-Allow-Headers":"authorization,content-type,apikey,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store","Vary":"Origin"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const hash=async (s:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))].map(v=>v.toString(16).padStart(2,"0")).join("");
function keyBytes(){try{const k=unb64(env("STUDIO_SOCIAL_TOKEN_KEY_B64"));return k.length===32?k:null}catch{return null}}
function ready(p:Platform){return Boolean(platforms[p].client&&platforms[p].secret&&keyBytes())}
async function encrypt(value:string){
 const raw=keyBytes();if(!raw)throw Error("token_key_missing");
 const key=await crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt"]);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value)));
 return {token_ciphertext:b64(data),token_iv:b64(iv)};
}
function admin(){
 if(!centralUrl||!centralSecret)throw Error("service_unconfigured");
 return createClient(centralUrl,centralSecret,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function member(req:Request,tenant:Tenant){
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return null;
 const {url,key}=tenantConfigs[tenant];
 const token=auth.slice(7);
 // Token validation MUST occur against the tenant's own Supabase Auth issuer.
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}});
 const {data,error}=await client.auth.getUser(token);
 if(error||!data.user)return null;
 const membership=await client.from("studio_members").select("role").eq("user_id",data.user.id).maybeSingle();
 if(membership.error||!membership.data)return null;
 return {id:data.user.id,role:membership.data.role as string};
}
const isTenant=(s:unknown):s is Tenant=>s==="vuba"||s==="foxon";
const isPlatform=(s:unknown):s is Platform=>s==="Facebook"||s==="Instagram"||s==="LinkedIn";
const providerFetch=async (url:string,headers:Record<string,string>={})=>{
 const r=await fetch(url,{headers,redirect:"error",signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error("provider_request_failed");
 return r.json();
};
type Candidate={id:string;name:string;token:string;expires:number|null};
async function metaCandidates(code:string,p:"Facebook"|"Instagram"):Promise<Candidate[]>{
 const cfg=platforms[p];
 const u=new URL("https://graph.facebook.com/v24.0/oauth/access_token");
 u.search=new URLSearchParams({client_id:cfg.client,client_secret:cfg.secret,redirect_uri:endpoint,code}).toString();
 const first=await providerFetch(u.toString());
 if(!first.access_token)throw Error("meta_access_denied");
 const x=new URL("https://graph.facebook.com/v24.0/oauth/access_token");
 x.search=new URLSearchParams({grant_type:"fb_exchange_token",client_id:cfg.client,client_secret:cfg.secret,fb_exchange_token:first.access_token}).toString();
 const long=await providerFetch(x.toString());
 const token=long.access_token||first.access_token;
 const pages=new URL("https://graph.facebook.com/v24.0/me/accounts");
 pages.search=new URLSearchParams({fields:"id,name,access_token,instagram_business_account{id,username}",limit:"100",access_token:token}).toString();
 let next=pages.toString();const seen=new Set<string>(),result:Candidate[]=[];
 while(next&&seen.size<20){
  const link=new URL(next);
  if(link.origin!=="https://graph.facebook.com"||seen.has(next))throw Error("unsafe_meta_pagination");
  seen.add(next);const data=await providerFetch(next);
  for(const page of data.data||[]){
   if(!page.id||!page.access_token)continue;
   if(p==="Facebook"&&page.name)result.push({id:String(page.id),name:String(page.name),token:page.access_token,expires:null});
   if(p==="Instagram"&&page.instagram_business_account?.id)
    result.push({id:String(page.instagram_business_account.id),name:String(page.instagram_business_account.username||"Instagram account"),token:page.access_token,expires:null});
  }
  next=typeof data.paging?.next==="string"?data.paging.next:"";
 }
 return result;
}
async function linkedInCandidates(code:string):Promise<Candidate[]>{
 const cfg=platforms.LinkedIn;
 const body=new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:endpoint,client_id:cfg.client,client_secret:cfg.secret});
 const response=await fetch("https://www.linkedin.com/oauth/v2/accessToken",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,redirect:"error",signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error("linkedin_access_denied");
 const token=await response.json();
 if(!token.access_token)throw Error("linkedin_token_missing");
 const headers={Authorization:"Bearer "+token.access_token,"Linkedin-Version":"202609","X-Restli-Protocol-Version":"2.0.0"};
 const acl=await providerFetch("https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",headers);
 const ids=[...new Set((acl.elements||[]).map((e:any)=>String(e.organizationTarget||e.organization||"").match(/urn:li:organization:(\d+)/)?.[1]).filter(Boolean))];
 const found:Candidate[]=[];
 for(const id of ids){
  const org=await providerFetch("https://api.linkedin.com/rest/organizations/"+id,headers);
  const name=org.localizedName||org.name;
  if(name)found.push({id:String(id),name:String(name),token:token.access_token,expires:token.expires_in||null});
 }
 return found;
}
function finish(tenant:Tenant,status:string){
 const url=new URL(tenantConfigs[tenant].redirect);
 url.searchParams.set("studio_connect",status);
 return Response.redirect(url.href,302);
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 const url=new URL(req.url);
 try{
  const db=admin();
  if(req.method==="GET"){
   // This callback is intentionally not JWT-gated: provider redirects lack our Auth header.
   // A random, expiring and one-use state binds it to a verified Studio member and tenant.
   const state=url.searchParams.get("state")||"";
   if(!state||state.length>200)return reply({error:"invalid_state"},400);
   const stateHash=await hash(state);
   const {data:record,error}=await db.from("studio_connect_states").select("*").eq("state_hash",stateHash).maybeSingle();
   if(error||!record||!isTenant(record.tenant))return reply({error:"expired_state"},400);
   const tenant=record.tenant as Tenant;
   if(record.consumed_at||new Date(record.expires_at).getTime()<Date.now())return finish(tenant,"expired");
   const consumed=await db.from("studio_connect_states").update({consumed_at:new Date().toISOString()}).eq("state_hash",stateHash).is("consumed_at",null).select("state_hash").maybeSingle();
   if(consumed.error||!consumed.data)return finish(tenant,"expired");
   if(url.searchParams.has("error")||!url.searchParams.get("code"))return finish(tenant,"cancelled");
   if(!isPlatform(record.platform)||!ready(record.platform))return finish(tenant,"unavailable");
   try{
    const code=url.searchParams.get("code")!;
    const choices=record.platform==="LinkedIn"?await linkedInCandidates(code):await metaCandidates(code,record.platform);
    if(!choices.length)return finish(tenant,"no_pages");
    for(const c of choices.slice(0,100)){
     const encrypted=await encrypt(c.token);
     const result=await db.from("studio_connect_candidates").upsert({
      tenant,user_id:record.user_id,platform:record.platform,provider_id:c.id,display_name:c.name,...encrypted,
      token_expires_at:c.expires?new Date(Date.now()+c.expires*1000).toISOString():null,
      expires_at:new Date(Date.now()+15*60*1000).toISOString()
     },{onConflict:"tenant,user_id,platform,provider_id"});
     if(result.error)throw Error("candidate_storage_error");
    }
    return finish(tenant,"select_pages");
   }catch{return finish(tenant,"connection_failed")}
  }
  if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
  if(req.headers.get("Origin")!==site)return reply({error:"origin_denied"},403);
  const input=await req.json().catch(()=>({}));
  if(!isTenant(input.tenant))return reply({error:"invalid_workspace"},400);
  const identity=await member(req,input.tenant);
  if(!identity)return reply({error:"not_authorised"},403);
  const key={tenant:input.tenant,user_id:identity.id};
  if(input.action==="status"){
   const [connected,pending]=await Promise.all([
    db.from("studio_connect_accounts").select("id,platform,provider_id,display_name,status").match(key).eq("status","connected"),
    db.from("studio_connect_candidates").select("id,platform,provider_id,display_name,expires_at").match(key).gt("expires_at",new Date().toISOString())
   ]);
   if(connected.error||pending.error)return reply({error:"read_failed"},500);
   return reply({providers:Object.fromEntries(Object.keys(platforms).map(p=>[p,ready(p as Platform)])),accounts:connected.data||[],candidates:pending.data||[]});
  }
  if(input.action==="begin"){
   if(!isPlatform(input.platform))return reply({error:"invalid_platform"},400);
   if(!ready(input.platform))return reply({error:"provider_setup_pending"},409);
   // Fresh selection replaces only uncommitted candidates for this user/provider.
   await db.from("studio_connect_candidates").delete().match({...key,platform:input.platform});
   const raw=b64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
   const stored=await db.from("studio_connect_states").insert({state_hash:await hash(raw),...key,platform:input.platform,expires_at:new Date(Date.now()+600000).toISOString()});
   if(stored.error)return reply({error:"oauth_state_failed"},503);
   const cfg=platforms[input.platform];
   const link=new URL(cfg.auth);
   link.search=new URLSearchParams({client_id:cfg.client,response_type:"code",redirect_uri:endpoint,state:raw,scope:cfg.scope}).toString();
   return reply({authorization_url:link.toString()});
  }
  if(input.action==="select"){
   if(!isPlatform(input.platform)||!Array.isArray(input.ids)||!input.ids.length||input.ids.length>100||input.ids.some((id:unknown)=>typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id)))return reply({error:"invalid_selection"},400);
   const selected=[...new Set(input.ids)] as string[];
   const pending=await db.from("studio_connect_candidates").select("*").match({...key,platform:input.platform}).in("id",selected).gt("expires_at",new Date().toISOString());
   if(pending.error||pending.data?.length!==selected.length)return reply({error:"selection_expired"},409);
   for(const c of pending.data){
    const saved=await db.from("studio_connect_accounts").upsert({
     ...key,platform:input.platform,provider_id:c.provider_id,display_name:c.display_name,status:"connected",
     token_ciphertext:c.token_ciphertext,token_iv:c.token_iv,token_expires_at:c.token_expires_at,updated_at:new Date().toISOString()
    },{onConflict:"tenant,user_id,platform,provider_id"});
    if(saved.error)return reply({error:"save_failed"},500);
   }
   await db.from("studio_connect_candidates").delete().match({...key,platform:input.platform});
   return reply({connected:selected.length});
  }
  if(input.action==="disconnect"){
   if(typeof input.id!=="string"||!/^[0-9a-f-]{36}$/i.test(input.id))return reply({error:"invalid_id"},400);
   const result=await db.from("studio_connect_accounts").delete().match({...key,id:input.id}).select("id");
   if(result.error||result.data?.length!==1)return reply({error:"disconnect_failed"},409);
   return reply({disconnected:true});
  }
  return reply({error:"unknown_action"},400);
 }catch{return reply({error:"service_unavailable"},503)}
});
