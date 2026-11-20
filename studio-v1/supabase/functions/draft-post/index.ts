import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const pillars=["Installer Advice","Product Education","Blends & Colour Inspiration","Local Stock & Availability","Project Planning","Behind the Scenes / Depot","Installer & Project Spotlights","FAQs & Myth Busting","Homeowner Education","Commercial / Sales"];
const seasonal={
 winter:["Weather-dependent project planning","Preparing the crew's winter schedule","Useful pre-installation questions","Selecting samples in low winter light"],
 spring:["Spring site preparation planning","Colour samples in changing daylight","Booking crews and confirming lead times"],
 summer:["Site-day planning during busy periods","Comparing samples in summer daylight","Questions before scheduling the next project"],
 autumn:["Planning work as daylight hours shorten","Forecast questions before committing to a pour","Autumn blend selection in natural light"]
};
function season(m:number){return m===11||m<2?"winter":m<5?"spring":m<8?"summer":"autumn"}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("",{headers:cors});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:cors});
 try{
  const token=req.headers.get("Authorization");
  if(!token?.startsWith("Bearer "))throw Error("Sign in first.");
  const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const db=createClient(url,key,{global:{headers:{Authorization:token}}});
  const {data:{user},error}=await db.auth.getUser();if(error||!user)throw Error("Sign in first.");
  const member=await db.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
  if(member.error||!member.data)throw Error("Not authorised for the Vuba Wiltshire team.");
  const b=await req.json(),topic=String(b.topic||"").trim().slice(0,300),title=String(b.title||"").trim().slice(0,140);
  const source=String(b.source||"").trim().slice(0,3000),channel=["Instagram","Facebook","LinkedIn"].includes(b.channel)?b.channel:"Instagram";
  const requestedPillar=pillars.includes(b.pillar)?b.pillar:"Installer Advice";
  const [planResult,postsResult]=await Promise.all([
   db.from("studio_marketing_plan").select("goal,audience,priorities,campaigns,seasonal_notes,confirmed_events,cadence").eq("id",1).maybeSingle(),
   db.from("studio_posts").select("title,pillar,topic,status").order("created_at",{ascending:false}).limit(20)
  ]);
  if(planResult.error||postsResult.error)throw Error("Could not read the marketing plan or recent posts.");
  const plan=planResult.data||{},recent=postsResult.data||[];
  const apiKey=Deno.env.get("OPENAI_API_KEY");
  if(!apiKey)throw Error("AI drafting is not configured yet. Set OPENAI_API_KEY as a Supabase Edge Function secret.");
  const s=season(new Date().getUTCMonth());
  const system=`You are the social editor for Vuba Wiltshire, a UK trade supplier serving resin-bound installers and landscapers. Choose and draft one genuinely useful post in natural, practical British English. Editorial mix over latest 20 posts: 60% useful trade advice, 20% product and stock, 10% depot/local activity, 10% commercial. Favour an underrepresented category, but an explicitly supplied topic takes precedence. If a TOPIC is supplied, follow that topic faithfully, don't replace it. If no topic is supplied, independently choose one that fits the UK season, the marketing strategy and the previous 20 posts. One clear point, no generic marketing padding. Avoid 'we're thrilled', 'one-stop shop', 'premium solutions', 'for all your resin needs'. STRICT FACTUAL SAFETY: do not invent training, events, actual stock, prices, product identities, hours, deliveries, technical thresholds, installation conditions, coverage, performance claims, timelines, or people. The plan is a direction, not verification of product facts. Supplied URL alone is not evidence that a page was read. If manufacturer technical evidence is missing, frame as helpful planning questions or a prompt to check the current manufacturer instructions rather than asserting technical advice. Do not assume any photograph exists. You are writing a proposed DRAFT, not an approved or published post. Only return a JSON object with the keys topic, title, caption, pillar, source_notes. Use a valid pillar from the supplied pillar list. source_notes must state which statements need verification; no fabricated links. Limit headline to 140 characters and caption to 1400 characters. No markdown code fences.`;
  const input=JSON.stringify({today:new Date().toISOString().slice(0,10),season:s,seasonal_suggestions:seasonal[s],topic:topic||null,working_title:title||null,channel,preferred_pillar:topic?requestedPillar:null,format:String(b.format||"Single image").slice(0,50),user_confirmed_notes:source||null,marketing_plan:plan,recent_posts:recent,pillars});
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",instructions:system,input,max_output_tokens:780,text:{format:{type:"json_object"}}})});
  const out=await response.json();if(!response.ok)throw Error("AI provider error; check the server configuration and logs.");
  const raw=(out.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==="output_text").map((c:any)=>c.text).join("");
  let value:any;try{value=JSON.parse(raw)}catch{throw Error("AI returned an unreadable draft; please retry.");}
  if(!value.topic||!value.title||!value.caption)throw Error("AI returned an incomplete post; please retry.");
  const result={topic:topic||String(value.topic).slice(0,300),title:String(value.title).slice(0,140),caption:String(value.caption).slice(0,1400),pillar:pillars.includes(value.pillar)?value.pillar:requestedPillar,source_notes:String(value.source_notes||"Draft — verify technical statements and imagery before approval.").slice(0,3000)};
  return new Response(JSON.stringify(result),{headers:cors});
 }catch(e){return new Response(JSON.stringify({error:String((e as Error).message||e)}),{status:400,headers:cors});}
});
