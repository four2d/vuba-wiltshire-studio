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
const channelRules={
 Facebook:{audience:"sole traders, small trade businesses and community",target:"50–120 words; occasionally very short or up to 180",visual:"original photo, practical image or short Reel",cta:"a specific workday question or clean website link"},
 LinkedIn:{audience:"trade business owners, construction professionals and partners",target:"100–220 words; sometimes 50 or up to 350",visual:"genuine workflow screenshot, short video or document carousel",cta:"a thoughtful practical takeaway or professional question"},
 Instagram:{audience:"visually engaged tradespeople discovering FOXON",target:"20–70 words; some slightly longer educational captions",visual:"4:5 authentic app screenshot carousel or 9:16 original short Reel",cta:"swipe, save or link in bio; no clickable caption URL"}
};
const verified={
 "FOXON Invoice":{hook:"THE JOB'S WON. DON'T TYPE IT TWICE.",point:"FOXON Invoice is designed to turn an accepted quote into an invoice.",detail:"A focused quote-to-invoice workflow for tradespeople."},
 "FOXON CIS":{hook:"KNOW WHAT'S BEEN DEDUCTED.",point:"FOXON CIS is designed to help subcontractors track contractor payments and deductions.",detail:"CIS recordkeeping, not HMRC filing or personal tax advice."},
 "FOXON Miles":{hook:"WORK MILES. PROPERLY LOGGED.",point:"FOXON Miles is designed to log journeys and distinguish work mileage from personal trips.",detail:"A work journey log is not a guarantee of tax relief."},
 "FOXON Gas":{hook:"THE CHECKS COME FIRST.",point:"FOXON Gas is being developed for qualified engineers handling landlord gas safety records.",detail:"The tool records work; it does not replace a qualified engineer's checks."}
};
function selectProduct(args,seed) {
 const combined=(args.pillar+" "+args.topic+" "+seed.pillar+" "+seed.title).toLowerCase();
 return Object.keys(verified).find(k=>combined.includes(k.toLowerCase())||combined.includes(k.split(" ")[1].toLowerCase()))||null;
}
function offlineDraft(args={}){
 const topic=clean(args.topic);
 const history=(args.existingTitles||[]).map(x=>String(x).toLowerCase());
 let seed=entries.find(x=>x.pillar===args.pillar&&!history.includes(x.title.toLowerCase()))||
   entries.find(x=>!history.includes(x.title.toLowerCase()))||entries[new Date().getDate()%entries.length];
 if(topic){
   const match=entries.find(x=>(x.title+" "+x.topic).toLowerCase().includes(topic.toLowerCase()));
   if(match)seed=match;
 }
 const channel=channelRules[args.channel]?args.channel:"Facebook";
 const product=selectProduct(args,seed);
 const detail=product?verified[product]:null;
 const hook=detail?.hook||"BUILT FOR THE TRADE.";
 const noun=product||"FOXON Software";
 const captions={
   Facebook:detail?
     hook+"\n\nYou finish the job. The paperwork still has to be done.\n\n"+detail.point+"\n\n"+detail.detail+"\n\nWhich part of the admin routine would you most like to make easier?\n\nSee what we're building: https://foxonsoftware.com/":
     "A full day on site. Then more paperwork.\n\nFOXON is building four practical tools for the trade: Invoice, CIS, Miles and Gas. Real workflows, clear records and straightforward software.\n\nWhich part of your working week would you most like to simplify?\n\nhttps://foxonsoftware.com/",
   LinkedIn:detail?
     hook+"\n\nIn a small trade business, paperwork has to fit around the work, not the other way round.\n\n"+detail.point+"\n\nThe design challenge is practical: make the next step clear, keep records useful, and make the workflow understandable on a phone.\n\n"+detail.detail+"\n\nThat's part of the thinking behind "+noun+". The app is being prepared for release, and the real product screens are available on our website.\n\nWhat do you value most when assessing software for a trade business?\n\nhttps://foxonsoftware.com/":
     "Software for tradespeople should start with the working day, not a feature list.\n\nQuotes, CIS records, mileage and gas paperwork all happen around the real job. Those workflows are the starting point for FOXON's four focused apps.\n\nWe're sharing the thinking and the actual product screens as we build towards release.\n\nFor trade business owners, what makes a new tool worth adopting?\n\nhttps://foxonsoftware.com/",
   Instagram:detail?
     hook+"\n\n"+detail.point+"\n\nReal app screens. Built for the trade. Coming soon.\n\nSee the FOXON line-up via the link in bio.\n\n#ToolsThatGraft #FOXONSoftware":
     "PAPERWORK AFTER THE JOB?\n\nMeet FOXON Invoice, CIS, Miles and Gas. Four tools, one trade-first attitude.\n\nReal screens. No nonsense. Coming soon.\n\nExplore via the link in bio.\n\n#FOXONSoftware #ToolsThatGraft"
 };
 // Deliberate rhythm: some short punchy hooks and occasional detailed posts.
 // This changes the length while keeping each channel's own voice.
 const count=(args.existingTitles||[]).length;
 if(count%5===1){
   if(channel==="Facebook")captions[channel]=detail?
     hook+"\\n\\n"+detail.point+"\\n\\nWhat would make your working day easier?\\n\\nhttps://foxonsoftware.com/":
     "NO NONSENSE. JUST WORK.\\n\\nInvoice. CIS. Miles. Gas.\\n\\nWhich one would be useful in your working week?\\n\\nhttps://foxonsoftware.com/";
   if(channel==="LinkedIn")captions[channel]=detail?
     hook+"\\n\\n"+detail.point+"\\n\\nA simple workflow is only useful if it matches how tradespeople actually work. That's the FOXON design principle.\\n\\nhttps://foxonsoftware.com/":
     "A useful trade tool starts with a real job, not a feature list.\\n\\nThat's the thinking behind FOXON's four focused apps.\\n\\nhttps://foxonsoftware.com/";
   if(channel==="Instagram")captions[channel]=hook+"\\n\\nReal trade-focused software. Coming soon.\\n\\nSee the screens via our link in bio.\\n\\n#ToolsThatGraft";
 }
 if(count%5===4 && channel==="Instagram"){
   captions[channel]=detail?hook+"\\n\\n"+detail.point+"\\n\\n"+detail.detail+"\\n\\nSwipe the real app screens. Which part would you use most?\\n\\nFOXON — BUILT FOR THE TRADE.\\n\\n#FOXONSoftware #ToolsThatGraft":captions[channel];
 }
 const suffix="FOXON OFFLINE "+channel.toUpperCase()+" EDITORIAL STARTER. Audience: "+channelRules[channel].audience+". Suggested length: "+channelRules[channel].target+". Artwork: "+channelRules[channel].visual+". CTA: "+channelRules[channel].cta+". Read and adapt this generic draft; confirm relevance to the selected topic, product features and image before approval. Never auto-publish. Avoid identical cross-platform captions.";
 return {topic:topic||seed.topic,title:hook,pillar:args.pillar||seed.pillar,series:seed.series,format:channel==="Instagram"?"Carousel":channel==="LinkedIn"?"Single image":"Single image",caption:captions[channel],source_notes:suffix};
}
window.FOXONOfflineDraft=offlineDraft;
window.VubaOfflineDraft=offlineDraft; // Existing FOXON editor still calls this legacy global.
})();