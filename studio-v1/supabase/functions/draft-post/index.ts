// Deploy with Supabase CLI: supabase functions deploy draft-post
// Set OPENAI_API_KEY as a Supabase secret. Never expose it in frontend code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const allowedPillars=["Installer Advice","Product Education","Blends & Colour Inspiration","Local Stock & Availability","Project Planning","Behind the Scenes / Depot","Installer & Project Spotlights","FAQs & Myth Busting","Homeowner Education","Commercial / Sales"];
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("",{headers:cors});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:cors});
 try{
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer "))throw Error("Sign-in required");
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user)throw Error("Unauthorised");
  const {data:member}=await supabase.from("studio_members").select("role").eq("user_id",user.id).maybeSingle();
  if(!member)throw Error("Not a Vuba Wiltshire staff member");
  const body=await req.json();
  const topic=String(body.topic||"").slice(0,160),source=String(body.source||"").slice(0,4000);
  const pillar=String(body.pillar||"");const channel=String(body.channel||"");
  if(!topic||!source||!allowedPillars.includes(pillar)||!["Instagram","Facebook","LinkedIn"].includes(channel))throw Error("Topic, confirmed source, valid pillar and channel are required");
  const apiKey=Deno.env.get("OPENAI_API_KEY");if(!apiKey)throw Error("AI is not configured");
  const system=`You are the Vuba Wiltshire trade-counter social editor in Sutton Veny. Write British English. Primary readers are resin-bound installers, landscapers, contractors and trade customers. Tone: practical, knowledgeable, human, concise and local, not a brochure. Give one useful specific angle. Avoid 'we're thrilled', 'one-stop shop', 'premium solutions', 'for all your resin needs', padding, forced questions, and generic claims. Never invent or infer product/blend identities, specifications, coverage, cure times, installation advice, pricing, stock, opening hours, deliveries, events or guarantees. Only use confirmed facts supplied by the user. If the supplied source is merely a URL, do NOT claim to have opened or verified it: avoid technical claims and ask for the relevant excerpt instead. Do not claim a photo shows anything not described. No more than five hashtags. Platform: Instagram short and visual; Facebook conversational and helpful; LinkedIn practical for trade decision makers. Output only the caption, no surrounding commentary.`;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",instructions:system,input:`Topic: ${topic}\nChannel: ${channel}\nPillar: ${pillar}\nFormat: ${String(body.format||"").slice(0,60)}\nConfirmed facts/source notes (do not assume a link has been read): ${source}`,max_output_tokens:500})});
  const result=await response.json();if(!response.ok)throw Error("AI request failed");
  const caption=(result.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==="output_text").map((c:any)=>c.text).join("").trim();
  if(!caption)throw Error("AI returned no draft");
  return new Response(JSON.stringify({caption}),{headers:cors});
 }catch(e){return new Response(JSON.stringify({error:String(e?.message||e)}),{status:400,headers:cors})}
});
