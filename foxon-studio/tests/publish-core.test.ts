// Deno unit tests for the FOXON publishing core. Run: deno test --allow-env foxon-studio/tests/publish-core.test.ts
// No network: fetch and the database are faked. Nothing here talks to Meta, LinkedIn or Supabase.
import {assert,assertEquals,assertRejects} from "jsr:@std/assert@1";
import {escapeLinkedInCommentary,isLinkedInUploadUrl,uploadLinkedInImage,linkedInPostBody,deliver,loadTarget,PublishError,
 scheduleWindowError,nextAttemptAt,constantTimeEqual} from "../supabase/functions/_shared/foxon-publish-core.ts";
import {runOnce} from "../supabase/functions/_shared/foxon-scheduler-core.ts";

const KEY=new Uint8Array(32).fill(7);
const b64=(u:Uint8Array)=>btoa(String.fromCharCode(...u));
async function encryptToken(token:string){
 const key=await crypto.subtle.importKey("raw",KEY,"AES-GCM",false,["encrypt"]);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const c=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(token)));
 return {token_ciphertext:b64(c),token_iv:b64(iv)};
}
Deno.env.set("FOXON_SOCIAL_TOKEN_KEY_B64",b64(KEY));

/** Minimal chainable fake of the supabase-js query builder, enough for the core's queries. */
function fakeDb(tables:Record<string,any[]>,log:string[],opts:{failDeliveryInsert?:boolean}={}){
 const db:any={
  from(table:string){
   let rows=[...(tables[table]||[])];let op="select";let payload:any=null;const filters:[string,any][]=[];
   const q:any={
    select(){return q;},eq(k:string,v:any){filters.push([k,v]);return q;},in(){return q;},limit(){return q;},order(){return q;},
    insert(p:any){op="insert";payload=p;return q;},update(p:any){op="update";payload=p;return q;},
    async maybeSingle(){return q.run(true);},async single(){return q.run(true);},
    then(res:any,rej:any){return Promise.resolve(q.run(false)).then(res,rej);},
    run(single:boolean){
     const match=(r:any)=>filters.every(([k,v])=>r[k]===v);
     if(op==="insert"){
      log.push("insert:"+table);
      if(table==="studio_publish_deliveries"&&(opts.failDeliveryInsert||(tables[table]||[]).some(r=>r.post_id===payload.post_id&&r.social_account_id===payload.social_account_id)))
       return {data:null,error:{code:"23505"}};
      const row={id:crypto.randomUUID(),...payload};(tables[table]=tables[table]||[]).push(row);return {data:row,error:null};
     }
     if(op==="update"){
      log.push("update:"+table+":"+(payload.status||Object.keys(payload).join(",")));
      const hit=(tables[table]||[]).filter(match);hit.forEach(r=>Object.assign(r,payload));
      return {data:single?(hit[0]||null):hit,error:null};
     }
     rows=rows.filter(match);
     return {data:single?(rows[0]||null):rows,error:null};
    }
   };
   return q;
  },
  async rpc(name:string){log.push("rpc:"+name);const due=(tables.studio_publish_schedules||[]).filter(r=>r.status==="scheduled");due.forEach(r=>{r.status="sending";r.attempts++;});return {data:due.map(r=>({...r})),error:null};},
  storage:{from(){return {async download(){log.push("download");return {data:new Blob([new Uint8Array([137,80,78,71])],{type:"image/png"}),error:null};}};}}
 };
 return db;
}
const POST="11111111-1111-4111-8111-111111111111",ACC="22222222-2222-4222-8222-222222222222",MEDIA="33333333-3333-4333-8333-333333333333";
async function fixture(platform:"LinkedIn"|"Facebook",withImage:boolean){
 return {
  studio_posts:[{id:POST,title:"Who owes you?",caption:"Who owes you? (free) #ToolsThatGraft",status:"approved",format:withImage?"Single image":"Text-led",channel:platform,media_id:withImage?MEDIA:null,source_notes:"invoice.html"}],
  studio_social_accounts:[{id:ACC,platform,external_account_id:"12345",display_name:"FOXON",connection_status:"connected"}],
  studio_publish_deliveries:[] as any[],
  studio_review_events:[{id:"r1",post_id:POST,action:"approved"}],
  studio_media:[{id:MEDIA,approved:true,archived_at:null,mime_type:"image/png",file_path:"u/x.png",filename:"x.png",description:"Invoice reports screen"}],
  _foxon_social_tokens:[{social_account_id:ACC,...await encryptToken("tok"),token_expires_at:null}]
 };
}
function fakeFetch(log:string[],overrides:Partial<Record<"init"|"put"|"status"|"post",()=>Response>>={}):typeof fetch{
 return (async (input:any,init?:any)=>{
  const url=String(input),method=init?.method||"GET";
  if(url.includes("/rest/images?action=initializeUpload")){log.push("li:init");
   assertEquals(JSON.parse(init.body).initializeUploadRequest.owner,"urn:li:organization:12345");
   return overrides.init?.()??Response.json({value:{uploadUrl:"https://www.linkedin.com/dms-uploads/abc",image:"urn:li:image:C4E"}});}
  if(method==="PUT"){log.push("li:put");return overrides.put?.()??new Response(null,{status:201});}
  if(url.includes("/rest/images/")){log.push("li:status");return overrides.status?.()??Response.json({status:"AVAILABLE"});}
  if(url.endsWith("/rest/posts")){log.push("li:post");log.push("body:"+init.body);
   return overrides.post?.()??new Response(null,{status:201,headers:{"x-restli-id":"urn:li:share:999"}});}
  throw Error("unexpected fetch "+url);
 }) as typeof fetch;
}

Deno.test("LinkedIn commentary escapes reserved characters but keeps hashtags",()=>{
 assertEquals(escapeLinkedInCommentary("Free (for good) #ToolsThatGraft @ 5_ #"),"Free \\(for good\\) #ToolsThatGraft \\@ 5\\_ \\#");
});
Deno.test("LinkedIn upload URL must be an https LinkedIn host",()=>{
 assert(isLinkedInUploadUrl("https://www.linkedin.com/dms-uploads/x"));
 assert(isLinkedInUploadUrl("https://api.linkedin.com/mediaUpload/x"));
 assert(!isLinkedInUploadUrl("http://www.linkedin.com/x"));
 assert(!isLinkedInUploadUrl("https://linkedin.com.evil.example/x"));
});
Deno.test("Image post body references the uploaded image; text body has no content",()=>{
 const withImage:any=linkedInPostBody("12345","Hi",{urn:"urn:li:image:C4E",altText:"Alt"});
 assertEquals(withImage.content,{media:{id:"urn:li:image:C4E",altText:"Alt"}});
 assertEquals(withImage.author,"urn:li:organization:12345");
 assertEquals((linkedInPostBody("12345","Hi") as any).content,undefined);
});
Deno.test("uploadLinkedInImage: initializeUpload, PUT, wait for AVAILABLE",async()=>{
 const log:string[]=[];let n=0;
 const urn=await uploadLinkedInImage("12345","tok",new Blob(["x"],{type:"image/png"}),fakeFetch(log,{status:()=>Response.json({status:n++?"AVAILABLE":"PROCESSING"})}),async()=>{});
 assertEquals(urn,"urn:li:image:C4E");
 assertEquals(log,["li:init","li:put","li:status","li:status"]);
});
Deno.test("uploadLinkedInImage rejects a non-LinkedIn upload URL (safe, nothing posted)",async()=>{
 const e=await assertRejects(()=>uploadLinkedInImage("12345","tok",new Blob(["x"]),fakeFetch([],{init:()=>Response.json({value:{uploadUrl:"https://evil.example/u",image:"urn:li:image:1"}})}),async()=>{}),PublishError);
 assert(e.safe);
});
Deno.test("uploadLinkedInImage: 403 is safe and not retryable; 503 is safe and retryable",async()=>{
 const denied=await assertRejects(()=>uploadLinkedInImage("12345","t",new Blob(["x"]),fakeFetch([],{init:()=>new Response("",{status:403})}),async()=>{}),PublishError);
 assert(denied.safe&&!denied.retryable);
 const busy=await assertRejects(()=>uploadLinkedInImage("12345","t",new Blob(["x"]),fakeFetch([],{put:()=>new Response("",{status:503})}),async()=>{}),PublishError);
 assert(busy.safe&&busy.retryable);
});

Deno.test("deliver LinkedIn image: upload happens BEFORE the idempotency row, post AFTER it",async()=>{
 const log:string[]=[];const tables=await fixture("LinkedIn",true);const db=fakeDb(tables,log);
 const realFetch=globalThis.fetch;globalThis.fetch=fakeFetch(log);
 try{
  const t=await loadTarget(db,POST,ACC,{allowInstagram:false});
  const r=await deliver(db,t,async()=>{log.push("linked");});
  assertEquals(r.externalId,"urn:li:share:999");
  const order=log.filter(x=>!x.startsWith("body:"));
  assertEquals(order,["download","li:init","li:put","li:status","insert:studio_publish_deliveries","linked","li:post","update:studio_publish_deliveries:published"]);
  const body=JSON.parse(log.find(x=>x.startsWith("body:"))!.slice(5));
  assertEquals(body.content.media.id,"urn:li:image:C4E");
  assertEquals(body.content.media.altText,"Invoice reports screen");
  assertEquals(body.commentary,"Who owes you? \\(free\\) #ToolsThatGraft");
 }finally{globalThis.fetch=realFetch;}
});
Deno.test("deliver LinkedIn text-only still works (no image calls)",async()=>{
 const log:string[]=[];const db=fakeDb(await fixture("LinkedIn",false),log);
 const realFetch=globalThis.fetch;globalThis.fetch=fakeFetch(log);
 try{
  const r=await deliver(db,await loadTarget(db,POST,ACC,{allowInstagram:false}));
  assertEquals(r.externalId,"urn:li:share:999");
  assert(!log.includes("li:init")&&!log.includes("download"));
  assertEquals(JSON.parse(log.find(x=>x.startsWith("body:"))!.slice(5)).content,undefined);
 }finally{globalThis.fetch=realFetch;}
});
Deno.test("A failed image upload is SAFE: no delivery row, no post call",async()=>{
 const log:string[]=[];const tables=await fixture("LinkedIn",true);const db=fakeDb(tables,log);
 const realFetch=globalThis.fetch;globalThis.fetch=fakeFetch(log,{put:()=>new Response("",{status:500})});
 try{
  const e=await assertRejects(()=>loadTarget(db,POST,ACC,{allowInstagram:false}).then(t=>deliver(db,t)),PublishError);
  assert(e.safe&&e.retryable);
  assert(!log.includes("insert:studio_publish_deliveries")&&!log.includes("li:post"));
  assertEquals(tables.studio_publish_deliveries.length,0);
 }finally{globalThis.fetch=realFetch;}
});
Deno.test("A provider error AFTER the post call is UNSAFE and recorded as failed",async()=>{
 const log:string[]=[];const tables=await fixture("LinkedIn",false);const db=fakeDb(tables,log);
 const realFetch=globalThis.fetch;globalThis.fetch=fakeFetch(log,{post:()=>new Response("",{status:500})});
 try{
  const e=await assertRejects(()=>loadTarget(db,POST,ACC,{allowInstagram:false}).then(t=>deliver(db,t)),PublishError);
  assert(!e.safe);assert(e.deliveryId);
  assertEquals(tables.studio_publish_deliveries[0].status,"failed");
 }finally{globalThis.fetch=realFetch;}
});
Deno.test("Second delivery for the same post + account is refused before any network call",async()=>{
 const log:string[]=[];const tables=await fixture("LinkedIn",false);
 tables.studio_publish_deliveries.push({id:"d1",post_id:POST,social_account_id:ACC,status:"published"});
 const db=fakeDb(tables,log);
 const e=await assertRejects(()=>loadTarget(db,POST,ACC,{allowInstagram:false}),PublishError);
 assertEquals(e.code,"delivery_exists_reconcile_before_retry");
});
Deno.test("Race: idempotency row insert conflict means NO provider post call",async()=>{
 const log:string[]=[];const db=fakeDb(await fixture("LinkedIn",false),log,{failDeliveryInsert:true});
 const realFetch=globalThis.fetch;globalThis.fetch=fakeFetch(log);
 try{
  const e=await assertRejects(()=>loadTarget(db,POST,ACC,{allowInstagram:false}).then(t=>deliver(db,t)),PublishError);
  assertEquals(e.code,"publishing_attempt_already_exists");
  assert(!log.includes("li:post"));
 }finally{globalThis.fetch=realFetch;}
});
Deno.test("Instagram is refused for scheduling",async()=>{
 const tables:any=await fixture("Facebook",true);tables.studio_social_accounts[0].platform="Instagram";tables.studio_posts[0].channel="Instagram";
 const e=await assertRejects(()=>loadTarget(fakeDb(tables,[]),POST,ACC,{allowInstagram:false}),PublishError);
 assertEquals(e.code,"instagram_scheduling_disabled");
});
Deno.test("Unapproved posts and GIF-less LinkedIn formats are refused",async()=>{
 const t1:any=await fixture("LinkedIn",false);t1.studio_posts[0].status="draft";
 assertEquals((await assertRejects(()=>loadTarget(fakeDb(t1,[]),POST,ACC,{allowInstagram:false}),PublishError)).code,"post_requires_approved_status");
 const t2:any=await fixture("LinkedIn",true);t2.studio_media[0].mime_type="image/webp";
 assertEquals((await assertRejects(()=>loadTarget(fakeDb(t2,[]),POST,ACC,{allowInstagram:false}),PublishError)).code,"linkedin_image_must_be_jpeg_png_or_gif");
});
Deno.test("Schedule window, backoff and secret comparison",()=>{
 const now=Date.parse("2026-11-26T12:00:00Z");
 assertEquals(scheduleWindowError("2026-11-26T12:01:00Z",now),"time_must_be_in_future");
 assertEquals(scheduleWindowError("2026-11-30T07:30:00Z",now),null);
 assertEquals(scheduleWindowError("2027-06-01T07:30:00Z",now),"time_too_far_ahead");
 assertEquals(nextAttemptAt(1,now),"2026-11-26T12:05:00.000Z");
 assertEquals(nextAttemptAt(2,now),"2026-11-26T12:15:00.000Z");
 assertEquals(nextAttemptAt(9,now),"2026-11-26T12:45:00.000Z");
 assert(constantTimeEqual("abc","abc"));assert(!constantTimeEqual("abc","abd"));assert(!constantTimeEqual("",""));
});

async function schedulerFixture(platform:"LinkedIn"|"Facebook",withImage:boolean,scheduledFor:string,attempts=0){
 const t:any=await fixture(platform,withImage);
 t.studio_publish_schedules=[{id:"s1",post_id:POST,social_account_id:ACC,scheduled_for:scheduledFor,status:"scheduled",attempts,max_attempts:3}];
 return t;
}
Deno.test("Scheduler publishes a due LinkedIn image post and links the delivery before posting",async()=>{
 const log:string[]=[];const tables=await schedulerFixture("LinkedIn",true,new Date(Date.now()-60000).toISOString());const db=fakeDb(tables,log);
 const realFetch=globalThis.fetch;globalThis.fetch=fakeFetch(log);
 try{
  const results=await runOnce(db);
  assertEquals(results,[{id:"s1",outcome:"published"}]);
  const s=tables.studio_publish_schedules[0];
  assertEquals(s.status,"published");assertEquals(s.external_post_id,"urn:li:share:999");assert(s.delivery_id);
  const i=log.indexOf("update:studio_publish_schedules:delivery_id,updated_at"),j=log.indexOf("li:post");
  assert(i>=0&&i<j,"delivery must be linked to the schedule before the provider call");
 }finally{globalThis.fetch=realFetch;}
});
Deno.test("Scheduler retries a safe transient failure with backoff, then gives up visibly",async()=>{
 const log:string[]=[];const tables=await schedulerFixture("LinkedIn",true,new Date(Date.now()-60000).toISOString());const db=fakeDb(tables,log);
 const realFetch=globalThis.fetch;globalThis.fetch=fakeFetch(log,{put:()=>new Response("",{status:503})});
 try{
  assertEquals((await runOnce(db))[0].outcome,"retry");
  const s=tables.studio_publish_schedules[0];
  assertEquals(s.status,"scheduled");assert(Date.parse(s.next_attempt_at)>Date.now());assert(s.last_error.includes("Nothing was posted"));
  await runOnce(db);assertEquals(s.status,"scheduled");
  assertEquals((await runOnce(db))[0].outcome,"failed");
  assertEquals(s.status,"failed");assertEquals(s.attempts,3);
  assertEquals(tables.studio_publish_deliveries.length,0);
  assert(!log.includes("li:post"));
 }finally{globalThis.fetch=realFetch;}
});
Deno.test("Scheduler never retries an unconfirmed send: needs_reconciliation",async()=>{
 const log:string[]=[];const tables=await schedulerFixture("LinkedIn",false,new Date(Date.now()-60000).toISOString());const db=fakeDb(tables,log);
 const realFetch=globalThis.fetch;globalThis.fetch=fakeFetch(log,{post:()=>new Response("",{status:504})});
 try{
  assertEquals((await runOnce(db))[0].outcome,"needs_reconciliation");
  assertEquals(tables.studio_publish_schedules[0].status,"needs_reconciliation");
  assertEquals((await runOnce(db)).length,0,"a reconciliation row is never claimed again");
  assertEquals(log.filter(x=>x==="li:post").length,1);
 }finally{globalThis.fetch=realFetch;}
});
Deno.test("Scheduler refuses posts that missed their slot by more than 6 hours",async()=>{
 const log:string[]=[];const tables=await schedulerFixture("Facebook",false,new Date(Date.now()-7*3600000).toISOString());const db=fakeDb(tables,log);
 assertEquals((await runOnce(db))[0],{id:"s1",outcome:"failed",error:"missed_window"});
 assertEquals(tables.studio_publish_deliveries.length,0);
});
Deno.test("Scheduler fails (no retry) when the post is no longer approved",async()=>{
 const log:string[]=[];const tables=await schedulerFixture("LinkedIn",false,new Date(Date.now()-60000).toISOString());
 tables.studio_posts[0].status="review";
 assertEquals((await runOnce(fakeDb(tables,log)))[0],{id:"s1",outcome:"failed",error:"post_requires_approved_status"});
});
