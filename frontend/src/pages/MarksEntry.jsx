import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, CheckCircle2, Loader2, AlertCircle, PenLine, ClipboardPaste } from "lucide-react";
import { api, qs } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { cn, bandStyle, fmtTime } from "../lib/format";
import { Page, Card, Select, Empty, Spinner, Progress, Badge } from "../components/ui";

export default function MarksEntry() {
  const { user } = useAuth();
  const isAdmin = user.role === "SCHOOL_ADMIN";
  const [sp] = useSearchParams();
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [bands, setBands] = useState([]);
  const [mine, setMine] = useState([]);
  const [streams, setStreams] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [sel, setSel] = useState({ exam: sp.get("exam") || "", grade: sp.get("grade") || "", stream: sp.get("stream") || "", subject: sp.get("subject") || "" });

  const [rows, setRows] = useState(null);
  const [locked, setLocked] = useState(false);
  const [dirty, setDirty] = useState(new Set());
  const [errs, setErrs] = useState({});
  const [status, setStatus] = useState({ kind: "idle" });
  const [loadErr, setLoadErr] = useState("");
  const rowsRef = useRef(null); const dirtyRef = useRef(dirty); const timer = useRef();
  rowsRef.current = rows; dirtyRef.current = dirty;

  useEffect(() => {
    api.get("/grades").then(setGrades); api.get("/subjects").then(setSubjects); api.get("/exams").then(setExams);
    api.get("/performance-bands").then(setBands);
    if (!isAdmin) api.get("/me/assignments").then(setMine);
  }, [isAdmin]);
  useEffect(() => { sel.grade ? api.get(`/streams${qs({ grade_id: sel.grade })}`).then(setStreams) : setStreams([]); }, [sel.grade]);
  useEffect(() => { sel.subject ? api.get(`/remarks${qs({ subject_id: sel.subject })}`).then(setRemarks) : setRemarks([]); }, [sel.subject]);

  const ctx = useMemo(() => ({ exam_id: sel.exam, grade_id: sel.grade, stream_id: sel.stream || null, subject_id: sel.subject }), [sel]);
  const ready = sel.exam && sel.grade && sel.subject;

  useEffect(() => {
    setRows(null); setDirty(new Set()); setErrs({}); setLoadErr(""); setStatus({ kind: "idle" });
    if (!ready) return;
    api.get(`/marks/grid${qs({ exam_id: sel.exam, grade_id: sel.grade, stream_id: sel.stream, subject_id: sel.subject })}`)
      .then((d) => { setRows(d.rows.map((r) => ({ ...r, score: r.score ?? "", remark: r.remark || "" }))); setLocked(d.locked); })
      .catch((e) => setLoadErr(e.message));
  }, [sel.exam, sel.grade, sel.stream, sel.subject, ready]);

  const saveNow = useCallback(async () => {
    clearTimeout(timer.current);
    const d = dirtyRef.current;
    if (!d.size || !rowsRef.current) return;
    const payload = rowsRef.current.filter((r) => d.has(r.student_id)).map((r) => ({ student_id: r.student_id, score: r.score === "" ? null : r.score, max_score: r.max_score, remark: r.remark }));
    setStatus({ kind: "saving" });
    try {
      const res = await api.post("/marks/grid", { ...ctx, rows: payload });
      const failed = {}; res.errors.forEach((e) => (failed[e.student_id] = e.error));
      setErrs(failed);
      setDirty((prev) => { const n = new Set(prev); payload.forEach((r) => !failed[r.student_id] && n.delete(r.student_id)); return n; });
      setStatus(res.errors.length ? { kind: "error", msg: `${res.errors.length} entr${res.errors.length === 1 ? "y needs" : "ies need"} fixing` } : { kind: "saved", at: new Date() });
    } catch (e) { setStatus({ kind: "error", msg: e.message }); }
  }, [ctx]);

  const touch = (ids) => {
    setDirty((p) => { const n = new Set(p); ids.forEach((i) => n.add(i)); return n; });
    setStatus({ kind: "pending" });
    clearTimeout(timer.current);
    timer.current = setTimeout(saveNow, 1200);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (patch) => saveNow().then(() => setSel((s) => ({ ...s, ...patch })));

  const edit = (sid, field, value) => { setRows((rs) => rs.map((r) => (r.student_id === sid ? { ...r, [field]: value } : r))); touch([sid]); };
  const paste = (i) => (e) => {
    const vals = e.clipboardData.getData("text").split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
    if (vals.length < 2) return;
    e.preventDefault();
    const ids = [];
    setRows((rs) => rs.map((r, k) => { if (k >= i && k < i + vals.length) { ids.push(r.student_id); return { ...r, score: vals[k - i].replace(",", ".") }; } return r; }));
    setTimeout(() => touch(ids), 0);
  };
  const next = (i) => (e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById(`score-${i + 1}`)?.focus(); } };

  const band = (score, max) => {
    if (score === "" || score === null || !bands.length) return null;
    const p = (Number(score) / (max || 100)) * 100; let c = null;
    bands.forEach((b) => { if (p >= b.min_score) c = b; });
    return c;
  };
  const filled = rows ? rows.filter((r) => r.score !== "").length : 0;
  const mean = rows && filled ? Math.round((rows.filter((r) => r.score !== "").reduce((a, r) => a + (Number(r.score) / r.max_score) * 100, 0) / filled) * 10) / 10 : null;

  const pickAssignment = (idx) => {
    const a = mine[Number(idx)];
    if (!a) return setSel((s) => ({ ...s, grade: "", stream: "", subject: "" }));
    change({ grade: a.grade_id, stream: a.stream_id || "", subject: a.subject_id });
  };
  const assignIdx = mine.findIndex((a) => a.grade_id === sel.grade && a.subject_id === sel.subject && (a.stream_id || "") === (sel.stream || ""));
  const assignFlex = mine.findIndex((a) => a.grade_id === sel.grade && a.subject_id === sel.subject);

  return (
    <Page title="Marks entry" subtitle="Type or paste a column of scores from Excel. Your work saves automatically.">
      <Card>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Select label="Exam" value={sel.exam} onChange={(e) => change({ exam: e.target.value })}>
            <option value="">Choose an exam</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}{e.is_published ? " (published)" : ""}</option>)}</Select>
          {isAdmin ? (
            <>
              <Select label="Grade" value={sel.grade} onChange={(e) => change({ grade: e.target.value, stream: "" })}><option value="">Choose a grade</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
              <Select label="Stream" value={sel.stream} onChange={(e) => change({ stream: e.target.value })} disabled={!streams.length}><option value="">All streams</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              <Select label="Subject" value={sel.subject} onChange={(e) => change({ subject: e.target.value })}><option value="">Choose a subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </>
          ) : (
            <>
              <div className="sm:col-span-2"><Select label="Your class and subject" value={assignFlex >= 0 ? (assignIdx >= 0 ? assignIdx : assignFlex) : ""} onChange={(e) => pickAssignment(e.target.value)}>
                <option value="">{mine.length ? "Choose a class" : "No classes assigned to you yet"}</option>
                {mine.map((a, i) => <option key={a.id} value={i}>{a.subject_name} · {a.grade_name} {a.stream_name || "(all streams)"}</option>)}</Select></div>
              {assignFlex >= 0 && !mine[assignFlex].stream_id && (
                <Select label="Stream" value={sel.stream} onChange={(e) => change({ stream: e.target.value })}><option value="">All streams</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              )}
            </>
          )}
        </div>
      </Card>

      {!ready ? <Card><Empty icon={PenLine} title="Choose an exam and a class" hint="The learners in that class will appear here ready for marks." /></Card>
        : loadErr ? <Card><Empty icon={AlertCircle} title="You can't open this class" hint={loadErr} /></Card>
        : !rows ? <Spinner /> : (
          <Card pad={false}>
            <div className="sticky top-16 z-10 bg-white rounded-t-2xl px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex-1 min-w-[180px]">
                <div className="flex justify-between text-sm mb-1"><span className="font-semibold">{filled} of {rows.length} entered</span>{mean !== null && <span className="text-slate-600">Class average <b>{mean}%</b></span>}</div>
                <Progress value={filled} max={rows.length} tone={filled === rows.length && rows.length ? "green" : "brand"} />
              </div>
              <div className="text-sm font-medium" aria-live="polite">
                {status.kind === "saving" && <span className="text-slate-600 flex items-center gap-1.5"><Loader2 size={15} className="animate-spin" />Saving…</span>}
                {status.kind === "pending" && <span className="text-amber-600">Unsaved changes</span>}
                {status.kind === "saved" && <span className="text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={15} />Saved at {fmtTime(status.at)}</span>}
                {status.kind === "error" && <span className="text-rose-600 flex items-center gap-1.5"><AlertCircle size={15} />{status.msg}</span>}
                {status.kind === "idle" && <span className="text-slate-400">Up to date</span>}
              </div>
            </div>
            {locked && <div className="px-5 py-3 bg-amber-50 text-amber-900 text-sm flex items-center gap-2"><Lock size={16} />This exam is published, so marks are locked. Ask your administrator if something needs changing.</div>}
            {rows.length === 0 ? <Empty title="No learners in this class" hint="Learners appear once the administrator creates their accounts." /> : (
              <>
                <p className="px-5 pt-3 text-xs text-slate-500 flex items-center gap-1.5"><ClipboardPaste size={14} />Tip: copy a column of scores from Excel and paste into the first box.</p>
                <ul className="divide-y divide-slate-100">
                  {rows.map((r, i) => {
                    const b = band(r.score, r.max_score);
                    const invalid = r.score !== "" && (Number(r.score) < 0 || Number(r.score) > r.max_score || Number.isNaN(Number(r.score)));
                    return (
                      <li key={r.student_id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="sm:w-64 min-w-0"><p className="font-semibold truncate"><span className="text-slate-400 font-normal mr-2 tabular-nums">{i + 1}</span>{r.student_name}</p>
                          <p className="text-xs text-slate-500 ml-6">Adm. {r.admission_number}{r.stream_name ? ` · ${r.stream_name}` : ""}</p></div>
                        <div className="flex items-center gap-2 ml-6 sm:ml-0">
                          <input id={`score-${i}`} inputMode="decimal" disabled={locked} value={r.score} placeholder="—" aria-label={`Score for ${r.student_name}`}
                            onChange={(e) => edit(r.student_id, "score", e.target.value.replace(",", "."))} onPaste={paste(i)} onKeyDown={next(i)}
                            className={cn("w-24 text-center text-lg font-semibold rounded-xl py-2 ring-1 focus:ring-2 focus:outline-none disabled:bg-slate-100 tabular-nums",
                              invalid || errs[r.student_id] ? "ring-rose-400 bg-rose-50 focus:ring-rose-500" : "ring-slate-300 focus:ring-brand-500", dirty.has(r.student_id) && !invalid && "bg-amber-50")} />
                          <span className="text-sm text-slate-500 w-14">/ {r.max_score}</span>
                          <span className="w-10">{b && !invalid && <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold ring-1", bandStyle(b.code))}>{b.code}</span>}</span>
                        </div>
                        <div className="flex-1 ml-6 sm:ml-0">
                          <input list={`rm-${i}`} disabled={locked} value={r.remark} onChange={(e) => edit(r.student_id, "remark", e.target.value)} placeholder="Remark (optional)" aria-label={`Remark for ${r.student_name}`}
                            className="w-full rounded-xl py-2 px-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-slate-100" />
                          <datalist id={`rm-${i}`}>{remarks.map((m) => <option key={m.id} value={m.text} />)}</datalist>
                          {(invalid || errs[r.student_id]) && <p className="text-xs text-rose-600 mt-1">{errs[r.student_id] || `Enter a number from 0 to ${r.max_score}.`}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>
        )}
    </Page>
  );
}
