const BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const KEY = "sms_token";
const SUPER_KEY = "sms_super_token";

export const tokens = {
  get: () => localStorage.getItem(KEY),
  set: (t) => localStorage.setItem(KEY, t),
  getSuper: () => localStorage.getItem(SUPER_KEY),
  setSuper: (t) => localStorage.setItem(SUPER_KEY, t),
  clearSuper: () => localStorage.removeItem(SUPER_KEY),
  clear: () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SUPER_KEY);
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
