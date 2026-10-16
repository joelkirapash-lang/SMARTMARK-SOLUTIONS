import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, ListOrdered, ScrollText, XCircle } from "lucide-react";
import { api, qs } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/Toast";
import { cn } from "../lib/format";
import { Page, Card, Btn, Select, Input, Badge, ErrorNote, Empty } from "../components/ui";

const SHOW = 100;

export default function MarksImport() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === "SCHOOL_ADMIN";
  const [grades, setGrades] = useState([]); const [streams, setStreams] = useState([]); const [exams, setExams] = useState([]); const [mine, setMine] = useState([]);
  const [g, setG] = useState(""); const [s, setS] = useState(""); const [e, setE] = useState(""); const [max, setMax] = useState("100");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");

  useEffect(() => { api.get("/grades").then(setGrades); api.get("/exams").then(setExams); if (!isAdmin) api.get("/me/assignments").then(setMine); }, [isAdmin]);
  useEffect(() => { g ? api.get(`/streams${qs({ grade_id: g })}`).then(setStreams) : setStreams([]); }, [g]);
  const myGrades = useMemo(() => (isAdmin ? grades : grades.filter((x) => mine.some((a) => a.grade_id === x.id))), [isAdmin, grades, mine]);
  const reset = () => { setPreview(null); setResult(null); setError(""); };

  const send = async (dry) => {
    setError(""); setBusy(dry ? "check" : "import");
    try {
      const fd = new FormData();
      fd.append("exam_id", e); fd.append("grade_id", g); fd.append("stream_id", s); fd.append("max_score", max);
      fd.append("dry_run", dry ? "1" : "0"); fd.append("file", file);
      const r = await api.upload("/marks/import", fd);
      if (dry) setPreview(r); else { setResult(r); setPreview(null); toast.success(`${r.saved} marks saved.`); }
    } catch (x) { setError(x.message); } finally { setBusy(""); }
  };
  const ready = e && g && file;
  const okCols = preview ? preview.subjects.filter((c) => c.status === "ok") : [];
  const q = qs({ exam: e, grade: g, stream: s });

  return (
    <Page title="Import marks" subtitle="Upload an Excel or CSV file. Learners are matched by admission number, and the marklist ranks everyone from first to last automatically.">
      <Card title="Choose the class">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Select label="Exam" value={e} onChange={(x) => { setE(x.target.value); reset(); }}><option value="">Choose an exam</option>{exams.map((x) => <option key={x.id} value={x.id}>{x.name}{x.is_published ? " (published)" : ""}</option>)}</Select>
          <Select label="Grade" value={g} onChange={(x) => { setG(x.target.value); setS(""); reset(); }}><option value="">Choose a grade</option>{myGrades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          <Select label="Stream" value={s} onChange={(x) => { setS(x.target.value); reset(); }} disabled={!streams.length}><option value="">All streams</option>{streams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          <Input label="Marks are out of" type="number" min="1" value={max} onChange={(x) => { setMax(x.target.value); reset(); }} hint="Or write it in a header, like Mathematics (50)." />
        </div>
      </Card>

      <Card title="Add your file">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Not sure how to lay it out? Download a ready-made sheet that already lists your learners and subjects, then just fill in the scores.</p>
            <Btn variant="outline" icon={Download} disabled={!g} onClick={() => api.download(`/marks/import-template${qs({ grade_id: g, stream_id: s })}`, "marks-template.xlsx").catch((x) => toast.error(x.message))}>Download the template</Btn>
            {!g && <p className="text-xs text-slate-500">Choose a grade first.</p>}
          </div>
          <label className="block rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-400 p-6 text-center cursor-pointer">
            <FileSpreadsheet className="mx-auto text-brand-600" />
            <span className="block mt-2 font-semibold break-all">{file ? file.name : "Choose an Excel or CSV file"}</span>
            <span className="block text-xs text-slate-500 mt-1">.xlsx or .csv, up to 2,000 learners</span>
            <input type="file" accept=".xlsx,.xlsm,.csv,text/csv" className="hidden" onChange={(x) => { setFile(x.target.files[0] || null); reset(); }} />
          </label>
        </div>
        <ErrorNote error={error} />
        <div className="mt-4"><Btn icon={Upload} loading={busy === "check"} disabled={!ready} onClick={() => send(true)}>Check the file</Btn>
          <span className="text-sm text-slate-500 ml-3">Nothing is saved until you confirm.</span></div>
      </Card>

      {preview && (
        <Card title="Here is what we found">
          <div className="flex flex-wrap gap-3 mb-5">
            <Badge tone="green">{preview.summary.matched} of {preview.summary.rows} learners matched</Badge>
            <Badge tone="brand">{preview.summary.marks} marks ready</Badge>
            {preview.summary.problem_rows > 0 && <Badge tone="amber">{preview.summary.problem_rows} row{preview.summary.problem_rows === 1 ? "" : "s"} with problems</Badge>}
          </div>
          <div className="mb-5">
            <p className="text-sm font-semibold mb-2">Columns</p>
            <ul className="space-y-1.5">
              {preview.subjects.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {c.status === "ok" ? <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" /> : c.status === "blocked" ? <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" /> : <XCircle size={16} className="text-rose-600 mt-0.5 shrink-0" />}
                  <span><b>{c.header}</b>{c.status === "ok" ? <span className="text-slate-600"> will be imported as {c.name}, out of {c.max_score}</span> : <span className="text-slate-600"> was skipped. {c.reason}</span>}</span>
                </li>
              ))}
              {preview.subjects.length === 0 && <li className="text-sm text-slate-600">No subject columns were found. Use the template to see the expected headers.</li>}
            </ul>
          </div>
          <div className="overflow-x-auto sms-scroll rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-left text-slate-600 bg-slate-50"><th className="px-3 py-2">Row</th><th className="px-3 py-2">Learner</th>
                {okCols.map((c) => <th key={c.subject_id} className="px-3 py-2 text-right whitespace-nowrap">{c.name}</th>)}<th className="px-3 py-2">Notes</th></tr></thead>
              <tbody>
                {preview.rows.slice(0, SHOW).map((r) => (
                  <tr key={r.row} className={cn("border-t border-slate-100", r.problems.length && "bg-amber-50")}>
                    <td className="px-3 py-2 text-slate-500">{r.row}</td>
                    <td className="px-3 py-2"><p className="font-medium">{r.learner || "Not matched"}</p><p className="text-xs text-slate-500">{r.admission_number}</p></td>
                    {okCols.map((c) => <td key={c.subject_id} className="px-3 py-2 text-right tabular-nums">{r.scores[c.subject_id] ?? <span className="text-slate-300">—</span>}</td>)}
                    <td className="px-3 py-2 text-xs text-amber-800">{r.problems.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > SHOW && <p className="text-xs text-slate-500 mt-2">Showing the first {SHOW} of {preview.rows.length} rows. All of them will be imported.</p>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Btn loading={busy === "import"} disabled={!preview.summary.marks} onClick={() => send(false)}>Import {preview.summary.marks} marks</Btn>
            {preview.summary.problem_rows > 0 && <span className="text-sm text-slate-600">Rows with problems are skipped. Fix them in your file and import again any time.</span>}
          </div>
        </Card>
      )}

      {result && (
        <Card>
          <Empty icon={CheckCircle2} title={`${result.saved} marks saved`} hint="The marklist is already ranked from first to last, and report cards are ready to print."
            action={<div className="flex flex-wrap gap-2 justify-center">
              <Link to={`/app/marklist${q}`}><Btn icon={ListOrdered}>See the ranked marklist</Btn></Link>
              <Link to={`/app/report-cards${q}`}><Btn variant="outline" icon={ScrollText}>Print report cards</Btn></Link>
              <Btn variant="ghost" onClick={() => { setFile(null); reset(); }}>Import another file</Btn></div>} />
        </Card>
      )}
    </Page>
  );
}
