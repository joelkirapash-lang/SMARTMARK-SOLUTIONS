const BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const KEY = "sms_token";
const SUPER_KEY = "sms_super_token";

// ---- live data -------------------------------------------------------------
// Every screen that reads data re-fetches whenever this counter changes: after any save,
// when you come back to the tab, when the phone reconnects, and every 20 seconds.
export const queryCache = new Map();
let epoch = 0, cacheVersion = 0, lastToken = null;
const listeners = new Set(), cacheListeners = new Set();
export const getEpoch = () => epoch;
export const subscribeEpoch = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const bumpEpoch = () => { epoch += 1; listeners.forEach((fn) => fn()); };
export const getCacheVersion = () => cacheVersion;
export const subscribeCache = (fn) => { cacheListeners.add(fn); return () => cacheListeners.delete(fn); };
const bumpCache = () => { cacheVersion += 1; cacheListeners.forEach((fn) => fn()); };

/** Change what screens show right now, before the server has answered. Returns an undo function. */
export function patchCache(prefix, updater) {
  const undo = [];
  queryCache.forEach((hit, key) => {
    if (key === prefix || key.startsWith(prefix + "?")) {
      try { queryCache.set(key, { ...hit, data: updater(hit.data, key) }); undo.push([key, hit]); } catch { /* shape differs: skip */ }
    }
  });
  bumpCache();
  return () => { undo.forEach(([k, h]) => queryCache.set(k, h)); bumpCache(); };
}

// A tiny "has anything changed?" check every 8 seconds. Screens re-fetch only when it says yes,
// so the server is not asked for everything again and again.
async function pulse() {
  const t = typeof localStorage !== "undefined" && localStorage.getItem(KEY);
  if (!t || document.hidden) return;
  try {
    const r = await fetch(BASE + "/pulse", { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) return;
    const { token } = await r.json();
    if (lastToken !== null && token !== lastToken) bumpEpoch();
    lastToken = token;
  } catch { /* offline: try again next time */ }
}
if (typeof window !== "undefined") {
  const wake = () => { if (!document.hidden && localStorage.getItem(KEY)) { bumpEpoch(); pulse(); } };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  window.addEventListener("online", wake);
  setInterval(pulse, 8000);
  pulse();
}

const ORIGIN = BASE.startsWith("http") ? BASE.replace(/\/api\/?$/, "") : "";
export const API_ORIGIN = ORIGIN;
/** Uploaded images are stored as /api/files/...; when the API lives on another domain, point at it. */
export const assetUrl = (u) => (u && u.startsWith("/api/") ? ORIGIN + u : u || "");

export const tokens = {
  get: () => localStorage.getItem(KEY),
  set: (t) => { localStorage.setItem(KEY, t); queryCache.clear(); lastToken = null; bumpEpoch(); pulse(); },
  getSuper: () => localStorage.getItem(SUPER_KEY),
  setSuper: (t) => localStorage.setItem(SUPER_KEY, t),
  clearSuper: () => localStorage.removeItem(SUPER_KEY),
  clear: () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SUPER_KEY);
    queryCache.clear();
    lastToken = null;
    bumpEpoch();
  },
};

const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const t = tokens.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (body !== undefined && !form) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: form ? form : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Cannot reach the server. Check your internet connection and try again."), { status: 0 });
  }
  const isJson = (res.headers.get("content-type") || "").includes("json");
  const data = isJson ? await res.json() : await res.blob();
  if (!res.ok) {
    const err = new Error((isJson && (data.error || data.msg)) || "Something went wrong. Please try again.");
    err.status = res.status;
    err.code = isJson ? data.code : undefined;
    err.details = isJson ? data.details : undefined;
    err.data = isJson ? data : undefined;
    if (res.status === 401 && t) emit("sms:expired");
    if (err.code === "SCHOOL_SUSPENDED") emit("sms:suspended", data);
    if (err.code === "PASSWORD_CHANGE_REQUIRED") emit("sms:pwchange");
    throw err;
  }
  if (method !== "GET") { lastToken = null; bumpEpoch(); }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, b = {}) => request(p, { method: "POST", body: b }),
  put: (p, b = {}) => request(p, { method: "PUT", body: b }),
  del: (p) => request(p, { method: "DELETE" }),
  upload: (p, form) => request(p, { method: "POST", form }),
  async download(path, filename) {
    const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${tokens.get()}` } });
    if (!res.ok) throw new Error("The download failed. Please try again.");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
