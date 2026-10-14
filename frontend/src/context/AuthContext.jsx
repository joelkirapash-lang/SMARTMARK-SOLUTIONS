import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokens } from "../lib/api";
import { themeFor } from "../lib/format";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const EMPTY = { loading: false, user: null, school: null, impersonating: false };

export function AuthProvider({ children }) {
  const [state, setState] = useState({ ...EMPTY, loading: true });
  const [suspended, setSuspended] = useState(null);

  const loadMe = useCallback(async () => {
    if (!tokens.get()) {
      setState(EMPTY);
      return null;
    }
    try {
      const d = await api.get("/auth/me");
      setState({ loading: false, user: d.user, school: d.school, impersonating: d.impersonating });
      setSuspended(d.school && d.school.is_active === false && !d.impersonating ? { reason: d.school.suspended_reason } : null);
      return d;
    } catch (e) {
      if (e.status === 401 || e.status === 403) tokens.clear();
      setState(EMPTY);
      return null;
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.user ? themeFor(state.user.role) : "login";
  }, [state.user]);

  useEffect(() => {
    const expired = () => { tokens.clear(); setState(EMPTY); };
    const susp = (e) => setSuspended({ reason: e.detail?.reason });
    const pw = () => loadMe();
    window.addEventListener("sms:expired", expired);
    window.addEventListener("sms:suspended", susp);
    window.addEventListener("sms:pwchange", pw);
    return () => {
      window.removeEventListener("sms:expired", expired);
      window.removeEventListener("sms:suspended", susp);
      window.removeEventListener("sms:pwchange", pw);
    };
  }, [loadMe]);

  const login = async (email, password) => {
    const d = await api.post("/auth/login", { email, password });
    tokens.set(d.access_token);
    setSuspended(null);
    await loadMe();
    return d;
  };
  const logout = () => { tokens.clear(); setSuspended(null); setState(EMPTY); };

  // Super Admin "view as": swap to a short-lived read-only token, remember the real one.
  const viewAs = async (userId) => {
    const current = tokens.get();
    const d = await api.post(`/super/impersonate/${userId}`);
    tokens.setSuper(current);
    tokens.set(d.access_token);
    await loadMe();
  };
  const exitView = async () => {
    const back = tokens.getSuper();
    tokens.clearSuper();
    if (back) tokens.set(back);
    await loadMe();
  };

  return (
    <Ctx.Provider value={{ ...state, suspended, login, logout, refresh: loadMe, viewAs, exitView }}>{children}</Ctx.Provider>
  );
}
