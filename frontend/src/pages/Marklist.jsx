import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Printer, FileSpreadsheet, ListOrdered, Medal, ScrollText } from "lucide-react";
import { api, qs } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { cn, bandStyle, fmtDate } from "../lib/format";
import { Page, Card, Btn, Select, Empty, Spinner } from "../components/ui";

export default function Marklist() {
  const { school } = useAuth();
  const [grades, setGrades] = useState([]); const [streams, setStreams] = useState([]); const [exams, setExams] = useState([]);
  const [sp] = useSearchParams();
  const [g, setG] = useState(sp.get("grade") || ""); const [s, setS] = useState(sp.get("stream") || ""); const [e, setE] = useState(sp.get("exam") || "");
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { api.get("/grades").then(setGrades); api.get("/exams").then(setExams); }, []);
  useEffect(() => { g ? api.get(`/streams${qs({ grade_id: g })}`).then(setStreams) : setStreams([]); }, [g]);
  useEffect(() => {
    setData(null); setErr("");
    if (!g || !e) return;
    setLoading(true);
    api.get(`/marklist${qs({ exam_id: e, grade_id: g, stream_id: s })}`).then(setData).catch((x) => setErr(x.message)).finally(() => setLoading(false));
  }, [g, s, e]);
  const gradeName = grades.find((x) => x.id === g)?.name; const streamName = streams.find((x) => x.id === s)?.name; const exam = exams.find((x) => x.id === e);
  const medal = (p) => (p === 1 ? "text-amber-500" : p === 2 ? "text-slate-400" : p === 3 ? "text-orange-600" : "");
  return (
    <Page title="Marklists" subtitle="A ranked class list for any grade, stream and exam."
      actions={data && data.rows.length > 0 && <><Btn variant="outline" icon={Printer} onClick={() => window.print()}>Print</Btn>
        <Btn variant="accent" icon={FileSpreadsheet} onClick={() => api.download(`/marklist/export${qs({ exam_id: e, grade_id: g, stream_id: s })}`, "marklist.xlsx")}>Download Excel</Btn>
        <Link to={`/app/report-cards?exam=${e}&grade=${g}&stream=${s}`}><Btn variant="outline" icon={ScrollText}>Report cards</Btn></Link></>}>
      <Card className="no-print"><div className="grid sm:grid-cols-3 gap-3">
        <Select label="Grade" value={g} onChange={(x) => { setG(x.target.value); setS(""); }}><option value="">Choose a grade</option>{grades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        <Select label="Stream" value={s} onChange={(x) => setS(x.target.value)} disabled={!streams.length}><option value="">All streams</option>{streams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        <Select label="Exam" value={e} onChange={(x) => setE(x.target.value)}><option value="">Choose an exam</option>{exams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
      </div></Card>
      {err && <Card><Empty title="Can't show this list" hint={err} /></Card>}
      {loading && <Spinner />}
      {!g || !e ? (!err && !loading && <Card><Empty icon={ListOrdered} title="Choose a grade and an exam" hint="The ranked marklist appears here." /></Card>) : data && (
        data.rows.length === 0 ? <Card><Empty title="No learners or marks yet" /></Card> : (
          <Card pad={false} className="print-area">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm text-slate-500">{school?.name}</p>
              <h2 className="font-display text-xl font-semibold">{gradeName}{streamName ? ` ${streamName}` : ""} · {exam?.name}</h2>
              <p className="text-xs text-slate-500">{[exam?.term, exam?.exam_date && fmtDate(exam.exam_date)].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="overflow-x-auto sms-scroll">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-slate-600 bg-slate-50">
                  <th className="px-4 py-2.5 w-14">Pos</th><th className="px-2 py-2.5 sticky left-0 bg-slate-50 min-w-[170px]">Learner</th>
                  {data.subjects.map((x) => <th key={x.id} className="px-2 py-2.5 text-right whitespace-nowrap" title={x.name}>{x.code}</th>)}
                  <th className="px-2 py-2.5 text-right">Total</th><th className="px-2 py-2.5 text-right">Avg %</th><th className="px-3 py-2.5">Level</th><th className="px-3 py-2.5 no-print" /></tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.student_id} className="border-t border-slate-100 hover:bg-brand-50/40">
                      <td className="px-4 py-2.5 font-display font-semibold">{r.position ? <span className="inline-flex items-center gap-1">{r.position <= 3 && <Medal size={14} className={medal(r.position)} />}{r.position}</span> : "—"}</td>
                      <td className="px-2 py-2.5 sticky left-0 bg-surface"><p className="font-medium">{r.student_name}</p><p className="text-xs text-slate-500">{r.admission_number}{r.stream_name ? ` · ${r.stream_name}` : ""}</p></td>
                      {data.subjects.map((x) => <td key={x.id} className="px-2 py-2.5 text-right tabular-nums">{r.scores[x.id] ?? <span className="text-slate-300">—</span>}</td>)}
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{r.total}</td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{r.average ?? "—"}</td>
                      <td className="px-3 py-2.5">{r.band && <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold ring-1", bandStyle(r.band))}>{r.band}</span>}</td>
                      <td className="px-3 py-2.5 no-print"><Link className="text-brandtext font-semibold text-xs" to={`/app/report-cards?student=${r.student_id}&exam=${e}`}>Report card</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </Page>
  );
}
