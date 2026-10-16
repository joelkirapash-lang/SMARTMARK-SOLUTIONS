import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, GraduationCap } from "lucide-react";
import { api, qs } from "../lib/api";
import { Page, Card, Select, Empty, Spinner, Avatar } from "../components/ui";

export default function Students() {
  const [sp] = useSearchParams();
  const [grades, setGrades] = useState([]); const [streams, setStreams] = useState([]);
  const [g, setG] = useState(""); const [s, setS] = useState(""); const [q, setQ] = useState(sp.get("q") || "");
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/grades").then(setGrades); }, []);
  useEffect(() => { g ? api.get(`/streams${qs({ grade_id: g })}`).then(setStreams) : setStreams([]); }, [g]);
  useEffect(() => { setRows(null); const t = setTimeout(() => api.get(`/students${qs({ grade_id: g, stream_id: s, q })}`).then(setRows), q ? 250 : 0); return () => clearTimeout(t); }, [g, s, q]);
  return (
    <Page title="Learners" subtitle="Everyone in your school. You can look at class lists here; only the administrator can change them.">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or admission number" className="w-full rounded-xl bg-surface ring-1 ring-slate-300 pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" /></div>
        <div className="sm:w-44"><Select value={g} onChange={(e) => { setG(e.target.value); setS(""); }} aria-label="Grade"><option value="">All grades</option>{grades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
        <div className="sm:w-40"><Select value={s} onChange={(e) => setS(e.target.value)} disabled={!streams.length} aria-label="Stream"><option value="">All streams</option>{streams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
      </div>
      <Card pad={false}>
        {!rows ? <Spinner /> : rows.length === 0 ? <Empty icon={GraduationCap} title="No learners found" hint="Learners appear once the administrator creates their accounts." /> : (
          <ul className="divide-y divide-slate-100">{rows.map((r) => (
            <li key={r.id} className="px-5 py-3 flex items-center gap-3"><Avatar name={r.full_name} /><div className="min-w-0 flex-1"><p className="font-semibold truncate">{r.full_name}</p>
              <p className="text-xs text-slate-500">Adm. {r.admission_number}</p></div><span className="text-sm text-slate-600">{r.grade_name} {r.stream_name}</span></li>))}</ul>
        )}
      </Card>
    </Page>
  );
}
