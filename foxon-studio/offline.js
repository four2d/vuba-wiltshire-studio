// FOXON-only local editorial starters. Not AI-generated; do not auto-publish.
(function(){
const entries=[
  {
    "title": "What does FOXON Invoice help you organise?",
    "topic": "What does FOXON Invoice help you organise?",
    "pillar": "Product Education",
    "series": "Product Spotlight",
    "format": "Single image",
    "caption": "A useful invoice workflow starts with clear records and a simple routine. We're putting together practical examples of how trade businesses approach invoicing.\\n\\nWhich part of your current invoicing process takes the most time?\\n\\n[Check current FOXON Invoice functionality before adding feature claims.]"
  },
  {
    "title": "Let's talk CIS paperwork",
    "topic": "Let's talk CIS paperwork",
    "pillar": "FOXON CIS",
    "series": "Trade Workflow",
    "format": "Carousel",
    "caption": "Construction Industry Scheme records can mean a lot of moving parts. We want to hear what contractors and subcontractors find most time-consuming.\\n\\nWhat would make your CIS admin easier?\\n\\n[Educational discussion only; verify HMRC rules before publishing.]"
  },
  {
    "title": "Mileage records: what works for you?",
    "topic": "Mileage records: what works for you?",
    "pillar": "FOXON Miles",
    "series": "Trade Workflow",
    "format": "Text-led",
    "caption": "Recording work journeys is one of those jobs that is easy to put off.\\n\\nHow do you currently keep mileage records for your business?\\n\\n[Do not claim automatic tracking or tax eligibility without checking current features and guidance.]"
  },
  {
    "title": "Gas safety recordkeeping questions",
    "topic": "Gas safety recordkeeping questions",
    "pillar": "FOXON Gas",
    "series": "Frequently Asked",
    "format": "Carousel",
    "caption": "Gas safety paperwork needs to be accurate and complete. We'd like to understand which parts of managing records most often create extra admin.\\n\\n[Do not publish technical gas-safety advice or claims without qualified review.]"
  },
  {
    "title": "Tools That Graft: what that means to the trade",
    "topic": "Tools That Graft: what that means to the trade",
    "pillar": "Company News",
    "series": "Behind the Build",
    "format": "Branded graphic",
    "caption": "Tools That Graft.\\n\\nOur aim is straightforward: software conversations grounded in the practical working day of UK trades.\\n\\nWhat would you like trade software to make easier?"
  },
  {
    "title": "Behind the build: a genuine FOXON update",
    "topic": "Behind the build: a genuine FOXON update",
    "pillar": "Behind the Software",
    "series": "Behind the Build",
    "format": "Single image",
    "caption": "A look behind the software starts with the people and the decisions that shape it.\\n\\n[Add a real development update, approved screenshot or team photograph before publishing.]"
  },
  {
    "title": "One question for the UK trade",
    "topic": "One question for the UK trade",
    "pillar": "Trade Productivity",
    "series": "Frequently Asked",
    "format": "Text-led",
    "caption": "If you could remove one repetitive admin task from your working week, which would it be?\\n\\nTell us what slows you down — we'd like to listen."
  },
  {
    "title": "Invoice, CIS, Miles, Gas — which topic first?",
    "topic": "Invoice, CIS, Miles, Gas — which topic first?",
    "pillar": "Company News",
    "series": "Product Spotlight",
    "format": "Carousel",
    "caption": "We're planning practical content around four areas: invoicing, CIS, mileage and gas safety records.\\n\\nWhich would you find most useful to explore first?\\n\\n[Check live product availability and names before posting.]"
  },
  {
    "title": "Common app questions, answered from verified sources",
    "topic": "Common app questions, answered from verified sources",
    "pillar": "Frequently Asked Questions",
    "series": "Frequently Asked",
    "format": "Branded graphic",
    "caption": "Have a question about FOXON Software? Share it and we'll aim to answer using current confirmed information.\\n\\n[Add a sourced answer before publication.]"
  },
  {
    "title": "A practical software screenshot tour",
    "topic": "A practical software screenshot tour",
    "pillar": "Product Education",
    "series": "Feature Explained",
    "format": "Carousel",
    "caption": "A good software walkthrough should show real screens and explain what people can do.\\n\\n[Insert current, genuine FOXON screenshots and verify each feature shown before publishing.]"
  }
];
const clean=s=>String(s||"").trim().replace(/\s+/g," ").slice(0,300);
window.VubaOfflineDraft=function(args={}){
 const topic=clean(args.topic);
 const history=(args.existingTitles||[]).map(x=>String(x).toLowerCase());
 let seed=entries.find(x=>x.pillar===args.pillar&&!history.includes(x.title.toLowerCase()))||
   entries.find(x=>!history.includes(x.title.toLowerCase()))||entries[new Date().getDate()%entries.length];
 if(topic){
  const match=entries.find(x=>(x.title+" "+x.topic).toLowerCase().includes(topic.toLowerCase()));
  if(match)seed=match;
  else return {topic,title:topic.slice(0,140),caption:"A question for people working in UK trades: "+topic.replace(/[.?!]+$/,"")+"?\n\nWhat do you think?\n\n[Editorial starter — add a specific, source-checked FOXON takeaway before approval.]",
   pillar:args.pillar||"Product Education",series:"",format:"Text-led",
   source_notes:"FOXON OFFLINE STARTER only. Verify all claims, product availability, permission and imagery."};
 }
 return {...seed,topic:topic||seed.topic,source_notes:"FOXON OFFLINE STARTER only. Verify current FOXON product facts and imagery before approval. Never auto-publish."};
};
})();