import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "../lib/format";

const KEY = "sms_mode"; // "light" | "dark" | "system"
const Ctx = createContext(null);
const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;

export const useMode = () => useContext(Ctx) || { mode: "system", setMode: () => {}, dark: false };

export function ModeProvider({ children }) {
  const [mode, setModeState] = useState(() => localStorage.getItem(KEY) || "system");
  const [sys, setSys] = useState(prefersDark());
  const dark = mode === "dark" || (mode === "system" && sys);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const f = () => setSys(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1220" : "#082f49");
  }, [dark]);
  // Paper is always printed in light colours, whatever the screen is showing.
  useEffect(() => {
    const before = () => document.documentElement.classList.remove("dark");
    const after = () => document.documentElement.classList.toggle("dark", dark);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, [dark]);

  const setMode = useCallback((m) => { localStorage.setItem(KEY, m); setModeState(m); }, []);
  return <Ctx.Provider value={{ mode, setMode, dark }}>{children}</Ctx.Provider>;
}

/** Quick light/dark switch for the top bar. */
export function ModeToggle({ className = "" }) {
  const { dark, setMode } = useMode();
  return (
    <button onClick={() => setMode(dark ? "light" : "dark")} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn("p-2.5 rounded-xl bg-surface ring-1 ring-slate-200 hover:bg-slate-100 text-slate-700", className)}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

/** Full Light / Dark / System choice for the account page. */
export function ModePicker() {
  const { mode, setMode } = useMode();
  const opts = [["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]];
  return (
    <div>
      <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Appearance">
        {opts.map(([v, label, Icon]) => (
          <button key={v} onClick={() => setMode(v)} aria-pressed={mode === v}
            className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors", mode === v ? "bg-surface shadow text-slate-900" : "text-slate-600 hover:text-slate-900")}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-500 mt-3">System follows your phone or computer setting. Printed report cards and marklists are always in light colours.</p>
    </div>
  );
}
