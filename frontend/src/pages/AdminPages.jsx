import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, KeyRound, FileText, Pencil, Eye, EyeOff, ArrowRight, MessageSquareQuote } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/Toast";
import { cn, fmtDate, ROLE_LABEL } from "../lib/format";
import { Page, Card, Btn, Input, Select, Textarea, Badge, Empty, Spinner, Modal, ErrorNote, Avatar, Tabs } from "../components/ui";
import ActivityFeed, { ACTIVITY_CATEGORIES } from "../components/ActivityFeed";

/* ---------------- Teacher access ---------------- */
export function Access() {
  const toast = useToast();
  const [staff, setStaff] = useState(null);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [streams, setStreams] = useState([]);
  const [sel, setSel] = useState(null);
  const [list, setList] = useState([]);
  const [d, setD] = useState({ grade_id: "", stream_id: "", subject_id: "" });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/accounts?role=TEACHER"), api.get("/accounts?role=EDUCATOR")]).then(([a, b]) => setStaff([...a, ...b]));
    api.get("/grades").then(setGrades); api.get("/subjects").then(setSubjects);
  }, []);
  useEffect(() => { d.grade_id ? api.get(`/streams?grade_id=${d.grade_id}`).then(setStreams) : setStreams([]); }, [d.grade_id]);

  const open = async (s) => { setSel(s); setDirty(false); setList(await api.get(`/staff/${s.id}/assignments`)); };
  const add = () => {
    if (!d.grade_id || !d.subject_id) return;
    const g = grades.find((x) => x.id === d.grade_id), sub = subjects.find((x) => x.id === d.subject_id), st = streams.find((x) => x.id === d.stream_id);
    setList((l) => [...l, { ...d, stream_id: d.stream_id || null, grade_name: g?.name, subject_name: sub?.name, stream_name: st?.name, key: Math.random() }]);
    setD({ grade_id: d.grade_id, stream_id: "", subject_id: "" }); setDirty(true);
  };
  const save = async () => {
    try { setList(await api.put(`/staff/${sel.id}/assignments`, { assignments: list.map(({ grade_id, stream_id, subject_id }) => ({ grade_id, stream_id, subject_id })) })); setDirty(false); toast.success("Class access saved."); }
    catch (e) { toast.error(e.message); }
  };
  if (!staff) return <Spinner />;
  return (
    <Page title="Teacher access" subtitle="Choose exactly which grade, stream and subject each teacher or educator may enter marks for. They cannot change this themselves.">
      <div className="grid lg:grid-cols-5 gap-6">
        <Card title="Teachers and educators" className="lg:col-span-2 self-start" pad={false}>
          {staff.length === 0 ? <Empty icon={KeyRound} title="No staff accounts yet" hint="Create teacher or educator accounts first." /> : (
            <ul className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto sms-scroll">
              {staff.map((s) => (
                <li key={s.id}><button onClick={() => open(s)} className={cn("w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-brand-50", sel?.id === s.id && "bg-brand-50")}>
                  <Avatar name={s.full_name} /><span className="min-w-0"><span className="block font-semibold truncate">{s.full_name}</span><span className="block text-xs text-slate-500">{ROLE_LABEL[s.role]}</span></span></button></li>
              ))}
            </ul>
          )}
        </Card>
        <div className="lg:col-span-3">
          {!sel ? <Card><Empty icon={KeyRound} title="Pick someone from the list" hint="Then add the classes and subjects they teach." /></Card> : (
            <Card title={`Classes for ${sel.full_name}`} action={dirty && <Badge tone="amber">Unsaved changes</Badge>}>
              <div className="grid sm:grid-cols-3 gap-3">
                <Select label="Grade" value={d.grade_id} onChange={(e) => setD({ grade_id: e.target.value, stream_id: "", subject_id: d.subject_id })}><option value="">Choose</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
                <Select label="Stream" value={d.stream_id} onChange={(e) => setD({ ...d, stream_id: e.target.value })} disabled={!d.grade_id}><option value="">All streams</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                <Select label="Subject" value={d.subject_id} onChange={(e) => setD({ ...d, subject_id: e.target.value })}><option value="">Choose</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              </div>
              <Btn variant="soft" icon={Plus} className="mt-3" onClick={add} disabled={!d.grade_id || !d.subject_id}>Add to list</Btn>
              <div className="mt-5">
                {list.length === 0 ? <p className="text-sm text-slate-600 rounded-xl bg-slate-50 px-4 py-6 text-center">No access yet. This person cannot enter marks anywhere.</p> : (
                  <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                    {list.map((a) => (
                      <li key={a.id || a.key} className="px-4 py-2.5 flex items-center justify-between text-sm">
                        <span><b>{a.subject_name}</b> · {a.grade_name} {a.stream_name || <span className="text-slate-500">(all streams)</span>}</span>
                        <button className="text-slate-400 hover:text-rose-600 p-1" aria-label="Remove" onClick={() => { setList(list.filter((x) => x !== a)); setDirty(true); }}><Trash2 size={16} /></button></li>
                    ))}
                  </ul>
                )}
              </div>
              <Btn icon={Save} className="mt-4" onClick={save} disabled={!dirty}>Save access</Btn>
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}

/* ---------------- Exams ---------------- */
const blankExam = { name: "", term: "", exam_date: "", marks_deadline: "" };
export function Exams() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api.get("/exams").then(setRows), []);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setError("");
    try {
      const body = { name: f.name, term: f.term, exam_date: f.exam_date || null, marks_deadline: f.marks_deadline || null };
      f.id ? await api.put(`/exams/${f.id}`, body) : await api.post("/exams", body);
      toast.success("Exam saved."); setF(null); load();
    } catch (e) { setError(e.message); }
  };
  const pub = async (e, on) => {
    if (on && !window.confirm(`Publish ${e.name}? Learners will be able to see their results, and teachers can no longer edit marks.`)) return;
    await api.post(`/exams/${e.id}/publish`, { published: on }); toast.success(on ? "Exam published." : "Exam unpublished."); load();
  };
  const del = async (e) => { if (!window.confirm(`Delete ${e.name}?`)) return; try { await api.del(`/exams/${e.id}`); load(); } catch (x) { toast.error(x.message); } };
  return (
    <Page title="Exams" subtitle="Create an exam, set when marks are due, then publish when results are ready for learners and parents."
      actions={<Btn icon={Plus} onClick={() => { setError(""); setF({ ...blankExam }); }}>New exam</Btn>}>
      {!rows ? <Spinner /> : rows.length === 0 ? <Card><Empty icon={FileText} title="No exams yet" hint="Create your first exam to start collecting marks." action={<Btn onClick={() => setF({ ...blankExam })}>Create an exam</Btn>} /></Card> : (
        <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {rows.map((e) => (
            <div key={e.id} className="bg-white rounded-2xl shadow-soft ring-1 ring-slate-900/5 p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-display font-semibold text-lg truncate">{e.name}</h3>
                <p className="text-sm text-slate-500">{[e.term, e.exam_date && fmtDate(e.exam_date)].filter(Boolean).join(" · ") || "No date set"}</p></div>
                <Badge tone={e.is_published ? "green" : "amber"}>{e.is_published ? "Published" : "Open for marks"}</Badge></div>
              <p className="text-sm text-slate-600">Marks due: <b>{e.marks_deadline ? fmtDate(e.marks_deadline) : "no deadline"}</b></p>
              <div className="flex flex-wrap gap-2 mt-auto">
                <Btn size="sm" variant="outline" icon={Pencil} onClick={() => { setError(""); setF({ id: e.id, name: e.name, term: e.term || "", exam_date: e.exam_date || "", marks_deadline: e.marks_deadline || "" }); }}>Edit</Btn>
                {e.is_published ? <Btn size="sm" variant="soft" icon={EyeOff} onClick={() => pub(e, false)}>Unpublish</Btn> : <Btn size="sm" icon={Eye} onClick={() => pub(e, true)}>Publish</Btn>}
                <Btn size="sm" variant="dangerSoft" icon={Trash2} onClick={() => del(e)} aria-label="Delete"><span className="sr-only">Delete</span></Btn>
              </div>
            </div>
          ))}
        </div>
      )}
      {f && (
        <Modal title={f.id ? "Edit exam" : "New exam"} onClose={() => setF(null)} footer={<><Btn variant="ghost" onClick={() => setF(null)}>Cancel</Btn><Btn onClick={save}>Save</Btn></>}>
          <div className="space-y-4"><ErrorNote error={error} />
            <Input label="Exam name" required value={f.name} onChange={set("name")} placeholder="Term 2 Mid-term" />
            <Input label="Term" value={f.term} onChange={set("term")} placeholder="Term 2" />
            <div className="grid grid-cols-2 gap-3"><Input label="Exam date" type="date" value={f.exam_date} onChange={set("exam_date")} />
              <Input label="Marks due by" type="date" value={f.marks_deadline} onChange={set("marks_deadline")} hint="Teachers are reminded before this date." /></div>
          </div>
        </Modal>
      )}
    </Page>
  );
}

/* ---------------- Promote ---------------- */
export function Promote() {
  const toast = useToast();
  const [grades, setGrades] = useState(null);
  const [counts, setCounts] = useState({});
  const [target, setTarget] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/grades").then((g) => {
      setGrades(g);
      const t = {}; g.forEach((x, i) => (t[x.id] = g[i + 1]?.id || "GRADUATE")); setTarget(t);
    });
    api.get("/accounts?role=STUDENT").then((rows) => { const c = {}; rows.forEach((r) => (c[r.grade_id] = (c[r.grade_id] || 0) + 1)); setCounts(c); });
  }, []);
  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);
  const go = async () => {
    if (!window.confirm("Promote all learners now? This moves every learner to the grade you chose. Recorded marks and report cards keep their original grade.")) return;
    setBusy(true);
    try {
      const moves = grades.filter((g) => target[g.id] !== "SKIP").map((g) => ({ from_grade_id: g.id, to_grade_id: target[g.id] === "GRADUATE" ? null : target[g.id] }));
      const r = await api.post("/promote", { moves });
      toast.success(`${r.moved} promoted, ${r.graduated} graduated.`);
      const rows = await api.get("/accounts?role=STUDENT"); const c = {}; rows.forEach((x) => (c[x.grade_id] = (c[x.grade_id] || 0) + 1)); setCounts(c);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  if (!grades) return <Spinner />;
  return (
    <Page title="Promote learners" subtitle="At the end of the year, move every class up in one step. Streams carry over by name. Learners in a grade marked Graduate are archived."
      actions={<Btn onClick={go} loading={busy} disabled={!total}>Promote {total} learners</Btn>}>
      {grades.length === 0 ? <Card><Empty title="No grades yet" /></Card> : (
        <Card pad={false}><ul className="divide-y divide-slate-100">
          {grades.map((g) => (
            <li key={g.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="sm:w-56"><p className="font-semibold">{g.name}</p><p className="text-xs text-slate-500">{counts[g.id] || 0} learner{counts[g.id] === 1 ? "" : "s"}</p></div>
              <ArrowRight className="text-slate-300 hidden sm:block" size={18} />
              <div className="sm:w-64"><Select value={target[g.id] || ""} onChange={(e) => setTarget({ ...target, [g.id]: e.target.value })} aria-label={`Where ${g.name} goes`}>
                <option value="SKIP">Leave in {g.name}</option>
                {grades.filter((x) => x.id !== g.id).map((x) => <option key={x.id} value={x.id}>Move to {x.name}</option>)}
                <option value="GRADUATE">Graduate and archive</option></Select></div>
            </li>
          ))}</ul></Card>
      )}
    </Page>
  );
}

/* ---------------- Remarks bank ---------------- */
export function Remarks() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [f, setF] = useState({ text: "", subject_id: "", band_code: "" });
  const load = useCallback(() => api.get("/remarks").then(setRows), []);
  useEffect(() => { load(); api.get("/subjects").then(setSubjects); }, [load]);
  const add = async (e) => {
    e.preventDefault();
    try { await api.post("/remarks", f); setF({ text: "", subject_id: f.subject_id, band_code: "" }); toast.success("Remark added."); load(); } catch (x) { toast.error(x.message); }
  };
  const name = (id) => subjects.find((s) => s.id === id)?.name || "Any subject";
  return (
    <Page title="Remarks bank" subtitle="Ready-made comments teachers can pick from while entering marks, so feedback is quick and consistent.">
      <div className="grid xl:grid-cols-3 gap-6">
        <Card title="Add a remark" className="self-start">
          <form className="space-y-3" onSubmit={add}>
            <Textarea label="Remark" required value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Shows excellent understanding. Keep it up." maxLength={300} />
            <Select label="Subject" value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })}><option value="">Any subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            <Btn type="submit" icon={Plus} className="w-full">Add remark</Btn>
          </form>
        </Card>
        <Card title="All remarks" className="xl:col-span-2" pad={false}>
          {!rows ? <Spinner /> : rows.length === 0 ? <Empty icon={MessageSquareQuote} title="No remarks yet" hint="Add common comments and teachers will see them as suggestions." /> : (
            <ul className="divide-y divide-slate-100">{rows.map((r) => (
              <li key={r.id} className="px-5 py-3 flex items-start justify-between gap-3"><div><p>{r.text}</p><Badge tone="brand" className="mt-1">{name(r.subject_id)}</Badge></div>
                <button className="text-slate-400 hover:text-rose-600 p-1" aria-label="Delete remark" onClick={async () => { await api.del(`/remarks/${r.id}`); load(); }}><Trash2 size={16} /></button></li>))}</ul>
          )}
        </Card>
      </div>
    </Page>
  );
}

/* ---------------- Settings ---------------- */
export function Settings() {
  const { refresh } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/school").then(setF); }, []);
  if (!f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setError("");
    try { await api.put("/school", f); await refresh(); toast.success("School settings saved."); } catch (x) { setError(x.message); }
  };
  return (
    <Page title="School settings" subtitle="Your name, motto, crest and report card footer appear on every report card.">
      <div className="grid xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2"><form onSubmit={save} className="space-y-4">
          <ErrorNote error={error} />
          <Input label="School name" required value={f.name || ""} onChange={set("name")} />
          <Input label="Motto" value={f.motto || ""} onChange={set("motto")} />
          <Input label="Crest or logo web address" value={f.crest_url || ""} onChange={set("crest_url")} hint="Paste the link to your crest image." />
          <Input label="Address" value={f.address || ""} onChange={set("address")} />
          <div className="grid sm:grid-cols-2 gap-3"><Input label="Contact email" type="email" value={f.contact_email || ""} onChange={set("contact_email")} /><Input label="Contact phone" value={f.contact_phone || ""} onChange={set("contact_phone")} /></div>
          <div className="grid sm:grid-cols-3 gap-3"><Input label="Current term" value={f.current_term || ""} onChange={set("current_term")} placeholder="Term 2, 2026" />
            <Input label="Term starts" type="date" value={f.term_start || ""} onChange={set("term_start")} /><Input label="Term ends" type="date" value={f.term_end || ""} onChange={set("term_end")} /></div>
          <Textarea label="Report card footer" value={f.report_card_footer || ""} onChange={set("report_card_footer")} />
          <Btn type="submit" icon={Save}>Save settings</Btn>
        </form></Card>
        <Card title="Your plan" className="self-start">
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-slate-500">Plan</dt><dd className="font-semibold">{f.plan_name || "Standard"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Learner limit</dt><dd className="font-semibold">{f.max_students ?? "Unlimited"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Staff limit</dt><dd className="font-semibold">{f.max_staff ?? "Unlimited"}</dd></div>
            {f.next_payment_due && <div className="flex justify-between"><dt className="text-slate-500">Next payment</dt><dd className="font-semibold">{fmtDate(f.next_payment_due)}</dd></div>}
          </dl>
          <p className="text-xs text-slate-500 mt-4">To change your plan, contact SMARTMARK SOLUTIONS.</p>
        </Card>
      </div>
    </Page>
  );
}

/* ---------------- Activity ---------------- */
export function Activity() {
  const { user } = useAuth();
  const isSuper = user.role === "SUPER_ADMIN";
  const [items, setItems] = useState(null);
  const [cat, setCat] = useState("all");
  const [schools, setSchools] = useState([]);
  const [sid, setSid] = useState("");
  useEffect(() => { if (isSuper) api.get("/super/schools").then(setSchools); }, [isSuper]);
  useEffect(() => {
    setItems(null);
    api.get(isSuper ? `/super/activity${sid ? `?school_id=${sid}` : ""}` : "/activity").then(setItems);
  }, [isSuper, sid]);
  const shown = useMemo(() => (items || []).filter((i) => cat === "all" || i.category === cat), [items, cat]);
  return (
    <Page title={isSuper ? "Platform activity" : user.role === "SCHOOL_ADMIN" ? "Activity" : "My activity"} subtitle="Who did what, and exactly when. Times are shown in your own timezone.">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={cat} onChange={setCat} tabs={[{ value: "all", label: "Everything" }, ...ACTIVITY_CATEGORIES.filter((c) => isSuper || c.value !== "platform")]} />
        {isSuper && <div className="w-56"><Select value={sid} onChange={(e) => setSid(e.target.value)} aria-label="School"><option value="">All schools</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>}
      </div>
      <Card>{!items ? <Spinner /> : <ActivityFeed items={shown} empty="Actions like signing in, saving marks and creating accounts will be listed here." />}</Card>
    </Page>
  );
}
