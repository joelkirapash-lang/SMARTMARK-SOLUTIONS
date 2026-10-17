import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { qs } from "../lib/api";
import { useQuery } from "../lib/query";
import { useAuth } from "../context/AuthContext";
import { cn, pct } from "../lib/format";
import { Page, Card, Select, Empty, Spinner, Tabs, Badge } from "../components/ui";
import { TrendChart } from "../components/charts";

const ST = {
  improved: { label: "Improved", icon: TrendingUp, chip: "bg-emerald-100 text-emerald-800", text: "text-emerald-600" },
  declined: { label: "Needs attention", icon: TrendingDown, chip: "bg-rose-100 text-rose-800", text: "text-rose-600" },
  steady: { label: "Steady", icon: Minus, chip: "bg-slate-100 text-slate-700", text: "text-slate-500" },
  new: { label: "First result", icon: Sparkles, chip: "bg-sky-100 text-sky-800", text: "text-sky-600" },
  none: { label: "No data", icon: Minus, chip: "bg-slate-100 text-slate-500", text: "text-slate-400" },
};
const Change = ({ status, change }) => {
  const s = ST[status] || ST.none; const Icon = s.icon;
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.chip)}><Icon size={13} />{change !== null && change !== undefined ? `${change > 0 ? "+" : ""}${change} pts` : s.label}</span>;
};

export default function Trends() {
  const { user } = useAuth();
  const isAdmin = user.role === "SCHOOL_ADMIN";
  const [sp] = useSearchParams();
  const [g, setG] = useState(""); const [s, setS] = useState(""); const [sub, setSub] = useState("");
  const [scope, setScope] = useState(isAdmin ? "all" : sp.get("mine") === "0" ? "all" : "mine");
  const [filter, setFilter] = useState("all");
  const grades = useQuery("/grades").data || []; const subjects = useQuery("/subjects").data || [];
  const streams = useQuery(g ? `/streams${qs({ grade_id: g })}` : null).data || [];
  const q = qs({ grade_id: g, stream_id: s, subject_id: sub, mine: !isAdmin && scope === "mine" ? 1 : "" });
  const tr = useQuery(`/analytics/trends${q}`).data; const ov = useQuery(`/analytics/overview${q}`).data;
  const rows = useMemo(() => (ov || []).filter((r) => filter === "all" || r.status === filter), [ov, filter]);
  const counts = useMemo(() => (ov || []).reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}), [ov]);
  const empty = tr && tr.exams.length === 0;
  return (
    <Page title="Performance trends" subtitle="See how scores move from one exam to the next, and which classes and subjects are improving or slipping.">
      <Card><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Select label="Grade" value={g} onChange={(e) => { setG(e.target.value); setS(""); }}><option value="">All grades</option>{grades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        <Select label="Stream" value={s} onChange={(e) => setS(e.target.value)} disabled={!streams.length}><option value="">All streams</option>{streams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        <Select label="Subject" value={sub} onChange={(e) => setSub(e.target.value)}><option value="">All subjects</option>{subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        {!isAdmin && <Select label="Show" value={scope} onChange={(e) => setScope(e.target.value)}><option value="mine">My classes</option><option value="all">All classes in school</option></Select>}
      </div></Card>
      {!tr || !ov ? <Spinner /> : empty ? <Card><Empty icon={TrendingUp} title="No marks to compare yet" hint="Trends appear once marks have been saved for at least one exam. Two or more exams show movement." /></Card> : (
        <>
          <div className="grid xl:grid-cols-4 gap-6">
            <Card title="Average score across exams" className="xl:col-span-3">
              <TrendChart exams={tr.exams} series={tr.series} overall={tr.overall} />
              {tr.exams.length === 1 && <p className="text-sm text-slate-600 mt-2">Only one exam has marks so far. A second exam will show the movement.</p>}
            </Card>
            <Card title="Overall" className="self-start">
              <p className="font-display text-4xl font-semibold">{pct(tr.overall.latest)}</p>
              <div className="mt-2"><Change status={tr.overall.status} change={tr.overall.change} /></div>
              <ul className="mt-5 space-y-2.5">
                {tr.summary.map((x) => (
                  <li key={x.subject_id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{x.subject}</span>
                    <span className="flex items-center gap-2 shrink-0"><b>{pct(x.latest)}</b><Change status={x.status} change={x.change} /></span></li>
                ))}
              </ul>
            </Card>
          </div>
          <Card title="Class by subject" action={<Tabs value={filter} onChange={setFilter} tabs={[{ value: "all", label: "All", count: ov.length }, { value: "declined", label: "Slipping", count: counts.declined || 0 }, { value: "improved", label: "Improving", count: counts.improved || 0 }]} />} pad={false}>
            {rows.length === 0 ? <Empty title="Nothing in this view" hint="Try a different filter." /> : (
              <ul className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <li key={i} className="px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1.5">
                    <div className="min-w-[180px] flex-1"><p className="font-semibold">{r.subject}</p><p className="text-sm text-slate-500">{r.grade}{r.stream ? ` ${r.stream}` : ""} · {r.exam}</p></div>
                    <div className="text-sm text-slate-600 w-40">{r.previous !== null ? `${r.previous}%` : "—"} <span className="text-slate-300 mx-1">→</span> <b className="text-slate-900">{r.latest}%</b></div>
                    <Change status={r.status} change={r.change} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
