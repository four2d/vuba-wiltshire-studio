/* Shared Social Studio caption-link helper.
   Identical UX across company-branded Studios; no brand, server, login or data is shared.
   Ordinary social post captions do not support hidden clickable text links. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const caption = $("caption");
  const channel = $("postChannel");
  if (!caption || !channel) return;

  const wrap = document.createElement("div");
  wrap.className = "studio-link-tools";
  wrap.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:8px 0 16px";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Make links readable";
  button.title = "Remove tracking parameters from links in the caption. Only the text in the editor changes; this does not create redirects.";
  button.style.cssText = "padding:8px 12px;font:inherit;cursor:pointer";
  const hint = document.createElement("small");
  hint.setAttribute("role","status");
  hint.setAttribute("aria-live","polite");
  hint.style.cssText = "flex:1 1 260px;line-height:1.45;opacity:.85";
  const defaultHints = {
    Instagram: "Instagram feed captions do not have clickable web links. Use a link in bio or a platform-supported link sticker.",
    Facebook: "Facebook feed captions show the actual URL. Use a short branded website link for neat, trackable posts.",
    LinkedIn: "LinkedIn feed captions show the actual URL. A short branded redirect is better than a long tracking query."
  };
  function updateHint(message) { hint.textContent = message || defaultHints[channel.value] || defaultHints.Facebook; }
  const tracked = /\bhttps?:\/\/[^\s<>"'\u201c\u201d]+/gi;
  function cleanUrl(raw) {
    const punctuation = (raw.match(/[),.!?;:]+$/) || [""])[0];
    const address = raw.slice(0,raw.length-punctuation.length);
    try {
      const parsed = new URL(address);
      if (!["https:","http:"].includes(parsed.protocol)) return raw;
      for (const key of [...parsed.searchParams.keys()]) {
        if (/^utm_/i.test(key) || /^(fbclid|gclid|msclkid)$/i.test(key)) parsed.searchParams.delete(key);
      }
      return parsed.toString() + punctuation;
    } catch { return raw; }
  }
  button.addEventListener("click", () => {
    const before = caption.value;
    const after = before.replace(tracked, cleanUrl);
    if (after === before) { updateHint("No tracking parameters found. " + defaultHints[channel.value]); return; }
    caption.value = after;
    caption.dispatchEvent(new Event("input", { bubbles:true }));
    updateHint("Tracking strings removed from caption. Review before saving; short branded redirects can preserve tracking when configured on your own website.");
  });
  channel.addEventListener("change", () => updateHint());
  const form = $("postForm");
  form?.addEventListener("reset", () => queueMicrotask(() => updateHint()));
  wrap.append(button,hint);
  caption.closest("label")?.insertAdjacentElement("afterend",wrap);
  updateHint();
})();
