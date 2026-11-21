// Fail-closed bootstrap: no Vuba backend and no unauthenticated module imports.
const c=window.VUBA_CONFIG||{};
const valid=c.supabaseUrl&&c.supabaseAnonKey&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.supabaseUrl);
if(!valid){
  const x=document.getElementById("setup");
  if(x){x.hidden=false;x.innerHTML='<h1>FOXON Social Studio</h1><p>The private FOXON workspace has not been provisioned yet. Create the dedicated FOXON Software Supabase project and configure the <code>config.js</code> publishable settings. No Vuba data or logins are connected.</p>';}
}else{
  await import("./app.js?v=20261120phasesFinal");
  await import("./marketing.js?v=20261120m");
  await import("./workspace.js?v=20261120art1");
  await import("./brain.js?v=20261120m");
  await import("./brain-documents.js?v=20261120m");
  await import("./media-tools.js?v=20261120art2");
  await import("./media-manager.js?v=20261120m");
  await import("./artwork.js?v=20261120art1");
  await import("./shell.js?v=20261120visibleStatSvg1");
  await import("./studio-upgrades.js?v=20261121hqMetrics2");
  await import("./marketing-hq.js?v=20261121hq2");
}