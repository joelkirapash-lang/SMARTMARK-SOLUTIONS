import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, Users, Layers, KeyRound, FileText, PenLine, ListOrdered, ScrollText, TrendingUp, ArrowRightLeft,
  MessageSquareQuote, Activity, Settings, Building2, Eye, LogOut, Menu, X, Bell, Search, Clock, GraduationCap,
  AlertTriangle, ShieldAlert,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { cn, ROLE_LABEL, fmtDate, tzName, daysLeftLabel } from "../lib/format";
import { Avatar, Badge } from "./ui";

const ADMIN_NAV = [
  ["/app", "Dashboard", LayoutDashboard, true], ["/app/accounts", "Accounts", Users], ["/app/academics", "Academics", Layers],
  ["/app/access", "Teacher access", KeyRound], ["/app/exams", "Exams", FileText], ["/app/marks", "Marks entry", PenLine],
  ["/app/marklist", "Marklists", ListOrdered], ["/app/report-cards", "Report cards", ScrollText], ["/app/trends", "Performance trends", TrendingUp],
  ["/app/promote", "Promote learners", ArrowRightLeft], ["/app/remarks", "Remarks bank", MessageSquareQuote],
  ["/app/activity", "Activity", Activity], ["/app/settings", "School settings", Settings],
];
const STAFF_NAV = [
  ["/app", "Dashboard", LayoutDashboard, true], ["/app/marks", "Marks entry", PenLine], ["/app/marklist", "Marklists", ListOrdered],
  ["/app/trends", "Performance trends", TrendingUp], ["/app/report-cards", "Report cards", ScrollText],
  ["/app/students", "Learners", GraduationCap], ["/app/activity", "My activity", Activity],
];
const STUDENT_NAV = [["/app", "My progress", LayoutDashboard, true], ["/app/report-cards", "My report cards", ScrollText]];
const SUPER_NAV = [
  ["/app", "Overview", LayoutDashboard, true], ["/app/schools", "Schools", Building2], ["/app/view-as", "View as", Eye],
  ["/app/activity", "Platform activity", Activity],
];

const navFor = (role) => ({ SUPER_ADMIN: SUPER_NAV, SCHOOL_ADMIN: ADMIN_NAV, STUDENT: STUDENT_NAV }[role] || STAFF_NAV);

export function Brand({ light = true, small }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="size-9 rounded-xl bg-gradient-to-br from-accent-400 to-brand-400 grid place-items-center shadow-lg shrink-0">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0f172a" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
      </div>
      <div className={cn("leading-none", light ? "text-white" : "text-slate-900")}>
        <p className={cn("font-display font-bold tracking-tight", small ? "text-base" : "text-[17px]")}>SMARTMARK</p>
        <p className={cn("font-display font-medium text-xs tracking-[0.18em] mt-0.5", light ? "text-white/70" : "text-slate-500")}>SOLUTIONS</p>
      </div>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  return (
    <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-sm" title={`Your local time (${tzName()})`}>
      <Clock size={15} className="text-brand-600" />
      <span className="font-semibold text-slate-900 tabular-nums">{now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
      <span className="text-slate-500 hidden md:inline">{fmtDate(now, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
      <span className="text-slate-400 text-xs hidden lg:inline">{tzName()}</span>
    </div>
  );
}

function SearchBox() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const box = useRef();
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => api.get(`/search?q=${encodeURIComponent(q.trim())}`).then(setRes).catch(() => setRes(null)), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const off = (e) => !box.current?.contains(e.target) && setRes(null);
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);
  const go = (p) => { nav(`${user.role === "SCHOOL_ADMIN" ? "/app/accounts" : "/app/students"}?q=${encodeURIComponent(p.admission_number || p.full_name)}${p.role !== "STUDENT" ? "&tab=staff" : ""}`); setRes(null); setQ(""); };
  const rows = res ? [...res.students, ...res.staff] : [];
  return (
    <div ref={box} className="relative flex-1 max-w-md">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search learners by name or admission number"
        className="w-full rounded-xl bg-white ring-1 ring-slate-200 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" aria-label="Search" />
      {res && (
        <div className="absolute z-30 mt-2 w-full rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden">
          {rows.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No one matches “{q}”.</p>}
          {rows.map((p) => (
            <button key={p.id} onClick={() => go(p)} className="w-full text-left px-4 py-2.5 hover:bg-brand-50 flex items-center gap-3">
              <Avatar name={p.full_name} size={30} />
              <span className="min-w-0"><span className="block text-sm font-semibold truncate">{p.full_name}</span>
                <span className="block text-xs text-slate-500 truncate">{ROLE_LABEL[p.role]}{p.admission_number ? ` · ${p.admission_number}` : ""}{p.grade_name ? ` · ${p.grade_name} ${p.stream_name || ""}` : ""}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Bell_() {
  const [data, setData] = useState({ items: [], overdue: 0, total: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const load = () => api.get("/notifications").then(setData).catch(() => {});
    load();
    const t = setInterval(load, 300000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const off = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);
  const count = data.total;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2.5 rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50" aria-label={`Notifications, ${count} pending`}>
        <Bell size={18} className="text-slate-700" />
        {count > 0 && <span className={cn("absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold grid place-items-center text-white", data.overdue ? "bg-rose-600" : "bg-brand-600")}>{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(92vw,380px)] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden">
          <p className="px-4 py-3 font-display font-semibold border-b border-slate-100">Marks to enter</p>
          <div className="max-h-96 overflow-y-auto sms-scroll divide-y divide-slate-100">
            {data.items.length === 0 && <p className="px-4 py-6 text-sm text-slate-500 text-center">You're all caught up. Nothing is waiting.</p>}
            {data.items.map((i, k) => (
              <Link key={k} onClick={() => setOpen(false)} to={`/app/marks?exam=${i.exam_id}&grade=${i.grade_id}&stream=${i.stream_id || ""}&subject=${i.subject_id}`} className="block px-4 py-3 hover:bg-brand-50">
                <p className="text-sm font-semibold">{i.subject} · {i.grade}{i.stream ? ` ${i.stream}` : ""}</p>
                <p className="text-xs text-slate-600">{i.exam}{i.teacher ? ` · ${i.teacher}` : ""} · {i.filled}/{i.expected} entered</p>
                <p className={cn("text-xs font-semibold mt-0.5", i.overdue ? "text-rose-600" : "text-amber-600")}>{daysLeftLabel(i.days_left)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Shell() {
  const { user, school, impersonating, exitView, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  const items = navFor(user.role);
  const hasTools = user.role === "SCHOOL_ADMIN" || user.role === "TEACHER" || user.role === "EDUCATOR";

  const Sidebar = (
    <div className="h-full flex flex-col bg-side text-white">
      <div className="px-5 py-5 border-b border-white/10"><Brand /></div>
      {school && (
        <div className="px-5 py-3 border-b border-white/10">
          <p className="text-xs text-white/60">{user.role === "SUPER_ADMIN" ? "Viewing school" : "Your school"}</p>
          <p className="font-semibold truncate">{school.name}</p>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto sms-scroll px-3 py-4 space-y-1">
        {items.map(([to, label, Icon, end]) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive ? "bg-white text-slate-900 shadow" : "text-white/75 hover:bg-white/10 hover:text-white")}>
            {({ isActive }) => (<><Icon size={18} className={isActive ? "text-brand-600" : ""} />{label}</>)}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{user.full_name}</p>
            <p className="text-xs text-white/60">{ROLE_LABEL[user.role]}</p>
          </div>
          <button onClick={() => { logout(); nav("/login"); }} className="p-2 rounded-lg hover:bg-white/10" aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
        </div>
        <NavLink to="/app/account" className="mt-3 block text-xs text-white/70 hover:text-white underline underline-offset-2">Account and password</NavLink>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30 no-print">{Sidebar}</aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 no-print">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{Sidebar}
            <button onClick={() => setOpen(false)} className="absolute top-4 -right-12 p-2 rounded-full bg-white text-slate-900" aria-label="Close menu"><X size={18} /></button>
          </div>
        </div>
      )}

      {impersonating && (
        <div className="sticky top-0 z-30 bg-slate-900 text-white no-print">
          <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2"><Eye size={16} className="text-accent-400" />
              Viewing <b>{user.full_name}</b> ({ROLE_LABEL[user.role]}){school ? ` at ${school.name}` : ""} · read-only</span>
            <button onClick={async () => { await exitView(); nav("/app/view-as"); }} className="rounded-lg bg-accent-500 text-slate-900 font-semibold px-3 py-1">Back to Super Admin</button>
          </div>
        </div>
      )}

      <header className={cn("sticky z-20 bg-canvas/90 backdrop-blur border-b border-slate-200/70 no-print", impersonating ? "top-[40px]" : "top-0")}>
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2.5 rounded-xl bg-white ring-1 ring-slate-200" aria-label="Open menu"><Menu size={18} /></button>
          <div className="lg:hidden"><Brand light={false} small /></div>
          {hasTools && <div className="hidden md:flex flex-1"><SearchBox /></div>}
          <div className="flex-1 md:hidden" />
          <div className="ml-auto flex items-center gap-2">
            {user.role === "SUPER_ADMIN" && (
              <Link to="/app/view-as" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 text-white px-3.5 py-2 text-sm font-semibold hover:bg-brand-700 shadow-sm">
                <Eye size={16} /> <span className="hidden sm:inline">Visit a role</span><span className="sm:hidden">View as</span>
              </Link>
            )}
            <LiveClock />
            {hasTools && <Bell_ />}
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function SuspendedScreen() {
  const { suspended, school, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen grid place-items-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-2xl">
        <div className="mx-auto size-16 rounded-2xl bg-amber-100 text-amber-700 grid place-items-center mb-4"><ShieldAlert size={32} /></div>
        <h1 className="font-display text-2xl font-semibold">Access is paused</h1>
        <p className="text-slate-600 mt-2">{school?.name ? `${school.name} is` : "This school is"} not available right now.</p>
        {suspended?.reason && <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800">{suspended.reason}</p>}
        <p className="text-sm text-slate-500 mt-4">Your data is safe. Please contact SMARTMARK SOLUTIONS or your school administrator to restore access.</p>
        <button onClick={() => { logout(); nav("/login"); }} className="mt-6 rounded-xl bg-slate-900 text-white px-5 py-2.5 font-semibold">Sign out</button>
      </div>
    </div>
  );
}
