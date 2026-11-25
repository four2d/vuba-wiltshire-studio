/**
 * Shared staff SSO for Vuba Wiltshire Social Studio.
 * Order desk is the login hub; this adapter fetches a short-lived JWT
 * from the same host and passes it to Supabase via accessToken.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const C = window.VUBA_CONFIG || {};
const TOKEN_PATH = "/order/staff/sso/studio/token";
const START_PATH = "/order/staff/sso/studio/start";
const LOGIN_PATH = "/order/staff/login";
const LOGOUT_PATH = "/order/staff/logout";
const STUDIO_NEXT = "/studio/";

let cached = null; // { token, exp, user }
const listeners = new Set();

function b64urlJson(part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((part.length + 3) % 4);
  return JSON.parse(atob(padded));
}

function userFromToken(token) {
  const payload = b64urlJson(token.split(".")[1]);
  return {
    id: payload.sub,
    email: payload.email || "",
    name: payload.name || "",
    role: payload.role || "authenticated",
  };
}

function notify(user) {
  for (const cb of listeners) {
    try {
      cb(user);
    } catch (_) {
      /* listener errors must not break auth */
    }
  }
}

function orderLoginUrl(next = STUDIO_NEXT) {
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

export function studioStartUrl() {
  return START_PATH;
}

export function redirectToOrderLogin(next = STUDIO_NEXT) {
  window.location.assign(orderLoginUrl(next));
}

async function fetchToken() {
  const res = await fetch(TOKEN_PATH, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (res.status === 401) {
    cached = null;
    return null;
  }
  if (res.status === 403) {
    cached = null;
    const detail = await res.json().catch(() => ({}));
    const err = new Error(detail.detail || "Studio access denied for this staff account");
    err.code = "studio_denied";
    throw err;
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Studio token failed (${res.status})`);
  }
  const data = await res.json();
  if (!data?.access_token) {
    throw new Error("Studio token response missing access_token");
  }
  const user = userFromToken(data.access_token);
  const exp = Math.floor(Date.now() / 1000) + Number(data.expires_in || 900) - 30;
  cached = { token: data.access_token, exp, user };
  return cached;
}

export async function getAccessToken({ force = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  if (!force && cached?.token && cached.exp > now) {
    return cached.token;
  }
  const fresh = await fetchToken();
  return fresh?.token || null;
}

export async function getStudioUser({ force = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  if (!force && cached?.user && cached.exp > now) {
    return cached.user;
  }
  const fresh = await fetchToken();
  return fresh?.user || null;
}

export async function ensureStudioSession({ redirect = true } = {}) {
  try {
    const user = await getStudioUser({ force: true });
    if (user) {
      notify(user);
      return user;
    }
  } catch (err) {
    if (err?.code === "studio_denied") {
      window.location.assign("/order/staff/sso/studio/denied");
      return null;
    }
    throw err;
  }
  if (redirect) {
    redirectToOrderLogin();
  }
  notify(null);
  return null;
}

export function onStudioAuth(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function createStudioClient() {
  if (!C.supabaseUrl || !C.supabaseAnonKey) {
    throw new Error("Missing VUBA_CONFIG supabaseUrl / supabaseAnonKey");
  }
  return createClient(C.supabaseUrl, C.supabaseAnonKey, {
    accessToken: async () => {
      try {
        return (await getAccessToken()) || "";
      } catch (_) {
        return "";
      }
    },
  });
}

export async function studioSignOut() {
  cached = null;
  notify(null);
  try {
    await fetch(LOGOUT_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "text/html" },
      redirect: "manual",
    });
  } catch (_) {
    /* still send the browser to login */
  }
  window.location.assign(orderLoginUrl(STUDIO_NEXT));
}

/** Hide the legacy password panel and drive SSO from the Order desk. */
export function mountStudioLoginGate({ authEl, errorEl, setupEl } = {}) {
  if (setupEl && (!C.supabaseUrl || !C.supabaseAnonKey)) {
    setupEl.hidden = false;
    return;
  }
  if (authEl) {
    authEl.hidden = false;
    authEl.innerHTML = `
      <h1>Staff sign in</h1>
      <p>Use your Vuba Order desk login. You will return here after signing in.</p>
      <p style="margin:1rem 0 0">
        <a class="btn" id="studioSsoContinue" href="${studioStartUrl()}"
           style="display:inline-flex;align-items:center;justify-content:center;padding:0.7rem 1.1rem;border-radius:10px;background:#821732;color:#fff;font-weight:700;text-decoration:none">
          Continue with Order login
        </a>
      </p>
      <p id="authError" role="alert" style="margin-top:0.85rem;color:#821732"></p>
    `;
  }
  const errNode = errorEl || document.getElementById("authError");
  ensureStudioSession({ redirect: false })
    .then((user) => {
      if (!user && errNode) {
        errNode.textContent = "";
      }
    })
    .catch((err) => {
      if (errNode) errNode.textContent = err?.message || String(err);
    });
}

window.VubaStaffAuth = {
  createStudioClient,
  getStudioUser,
  getAccessToken,
  ensureStudioSession,
  onStudioAuth,
  studioSignOut,
  redirectToOrderLogin,
  studioStartUrl,
  mountStudioLoginGate,
};
