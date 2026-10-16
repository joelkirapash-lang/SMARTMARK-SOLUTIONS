import { useEffect } from "react";
import { X, Loader2, Inbox } from "lucide-react";
import { cn, initials } from "../lib/format";

export function Page({ title, subtitle, actions, children }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-slate-600 mt-1 max-w-2xl">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, action, children, className = "", pad = true }) {
  return (
    <section className={cn("bg-surface rounded-2xl shadow-soft ring-1 ring-slate-900/5", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <h2 className="font-display font-semibold text-slate-900">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

const TONES = {
  blue: "from-blue-400 to-blue-600", emerald: "from-emerald-400 to-emerald-600", amber: "from-amber-400 to-orange-500",
  rose: "from-rose-400 to-rose-600", violet: "from-violet-400 to-violet-600", cyan: "from-cyan-400 to-cyan-600",
  brand: "from-brand-400 to-brand-600",
};
export function Stat({ label, value, icon: Icon, tone = "brand", hint }) {
  return (
    <div className="bg-surface rounded-2xl shadow-soft ring-1 ring-slate-900/5 p-4 flex items-center gap-4">
      <div className={cn("size-12 rounded-xl bg-gradient-to-br text-white grid place-items-center shrink-0", TONES[tone])}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="min-w-0">
        <div className="font-display text-2xl font-semibold text-slate-900 leading-tight">{value}</div>
        <div className="text-sm text-slate-600 truncate">{label}</div>
        {hint && <div className="text-xs text-slate-500 truncate">{hint}</div>}
      </div>
    </div>
  );
}

const BTN = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  accent: "bg-accent-500 text-zinc-900 hover:bg-accent-400 shadow-sm",
  soft: "bg-brand-50 text-brandtext hover:bg-brand-100",
  outline: "bg-surface text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
  dangerSoft: "bg-rose-50 text-rose-700 hover:bg-rose-100",
};
export function Btn({ variant = "primary", size = "md", loading, icon: Icon, children, className = "", ...p }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm", BTN[variant], className)}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

const field = "w-full rounded-xl bg-surface px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500";
export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-slate-800 mb-1.5">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-rose-600 mt-1">{error}</span>}
    </label>
  );
}
export const Input = ({ label, hint, error, className = "", ...p }) => (
  <Field label={label} hint={hint} error={error}><input className={cn(field, className)} {...p} /></Field>
);
export const Select = ({ label, hint, children, className = "", ...p }) => (
  <Field label={label} hint={hint}><select className={cn(field, "pr-8", className)} {...p}>{children}</select></Field>
);
export const Textarea = ({ label, hint, className = "", ...p }) => (
  <Field label={label} hint={hint}><textarea rows={3} className={cn(field, className)} {...p} /></Field>
);

const BADGE = {
  slate: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-800", red: "bg-rose-100 text-rose-800",
  amber: "bg-amber-100 text-amber-800", blue: "bg-sky-100 text-sky-800", violet: "bg-violet-100 text-violet-800",
  brand: "bg-brand-100 text-brandtext",
};
export const Badge = ({ tone = "slate", children, className = "" }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", BADGE[tone], className)}>{children}</span>
);

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn("sms-sheet relative bg-surface w-full max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close"><X size={20} /></button>
        </header>
        <div className="p-5 overflow-y-auto sms-scroll">{children}</div>
        {footer && <footer className="px-5 py-4 border-t border-slate-100 flex flex-wrap justify-end gap-2 bg-slate-50 rounded-b-2xl">{footer}</footer>}
      </div>
    </div>
  );
}

export function Empty({ title, hint, action, icon: Icon = Inbox }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto size-14 rounded-2xl bg-brand-50 text-brand-600 grid place-items-center mb-3"><Icon size={26} /></div>
      <p className="font-display font-semibold text-slate-900">{title}</p>
      {hint && <p className="text-sm text-slate-600 mt-1 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Spinner = ({ label = "Loading" }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-slate-500" role="status">
    <Loader2 className="animate-spin" size={20} /> {label}…
  </div>
);

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface p-1 ring-1 ring-slate-200 shadow-sm no-print">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cn("px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors", value === t.value ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 opacity-70">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, max, tone = "brand" }) {
  const p = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = tone === "red" ? "bg-rose-500" : tone === "amber" ? "bg-amber-500" : tone === "green" ? "bg-emerald-500" : "bg-brand-500";
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${p}%` }} />
    </div>
  );
}

export const Avatar = ({ name, size = 36 }) => (
  <div className="rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white grid place-items-center font-semibold shrink-0"
    style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>{initials(name)}</div>
);

export const ErrorNote = ({ error }) =>
  error ? <div className="rounded-xl bg-rose-50 text-rose-800 ring-1 ring-rose-200 px-4 py-3 text-sm" role="alert">{error}</div> : null;
