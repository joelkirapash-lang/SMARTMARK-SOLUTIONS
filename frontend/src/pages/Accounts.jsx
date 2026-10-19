import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { UserPlus, Upload, Pencil, KeyRound, Ban, CheckCircle2, Search, Download, Users } from "lucide-react";
import { api, qs, patchCache } from "../lib/api";
import { useQuery, optimistic } from "../lib/query";
import { useToast } from "../context/Toast";
import { fmtDateTime, downloadCsv } from "../lib/format";
import { Page, Card, Btn, Input, Select, Badge, Modal, Empty, Spinner, Tabs, Progress, ErrorNote, Avatar } from "../components/ui";
import CredentialsModal from "../components/CredentialsModal";

const TABS = [["STUDENT", "Learners"], ["TEACHER", "Teachers"], ["EDUCATOR", "Educators"]];
const SINGULAR = { STUDENT: "learner", TEACHER: "teacher", EDUCATOR: "educator" };

function AccountForm({ role, initial, grades, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!initial;
  const [f, setF] = useState(() => initial ? {
    ...initial, date_of_birth: initial.date_of_birth || "", grade_id: initial.grade_id || "", stream_id: initial.stream_id || "",
    home_grade_id: initial.home_grade_id || "", home_stream_id: initial.home_stream_id || "",
  } : { first_name: "", second_name: "", other_name: "", gender: "", personal_email: "", phone_number: "", admission_number: "", date_of_birth: "",
    grade_id: "", stream_id: "", guardian_name: "", guardian_phone: "", guardian_email: "", upi_number: "", assessment_number: "", employee_id: "", home_grade_id: "", home_stream_id: "", must_change_password: true });
  const [streams, setStreams] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const gradeKey = role === "STUDENT" ? "grade_id" : "home_grade_id";
  const streamKey = role === "STUDENT" ? "stream_id" : "home_stream_id";
  useEffect(() => { f[gradeKey] ? api.get(`/streams${qs({ grade_id: f[gradeKey] })}`).then(setStreams) : setStreams([]); }, [f[gradeKey]]);

  const submit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const payload = { ...f, role };
      if (editing) { const r = await api.put(`/accounts/${initial.id}`, payload); toast.success("Changes saved."); onSaved(null, r); }
      else { const r = await api.post("/accounts", payload); onSaved(r.credentials, r.user); }
    } catch (x) { setError(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={editing ? `Edit ${SINGULAR[role]}` : `Add a ${SINGULAR[role]}`} onClose={onClose} wide
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn loading={busy} onClick={submit}>{editing ? "Save changes" : "Create account"}</Btn></>}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorNote error={error} />
        <div className="grid sm:grid-cols-3 gap-3">
          <Input label="First name" required value={f.first_name} onChange={set("first_name")} />
          <Input label="Second name" value={f.second_name || ""} onChange={set("second_name")} />
          <Input label="Other name" value={f.other_name || ""} onChange={set("other_name")} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Select label="Gender" value={f.gender || ""} onChange={set("gender")}><option value="">Not specified</option><option>Female</option><option>Male</option></Select>
          {role === "STUDENT"
            ? <Input label="Admission number" required value={f.admission_number || ""} onChange={set("admission_number")} />
            : <Input label="Employee or TSC number" value={f.employee_id || ""} onChange={set("employee_id")} />}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Select label={role === "STUDENT" ? "Grade" : "Home grade (optional)"} required={role === "STUDENT"} value={f[gradeKey]} onChange={(e) => setF((s) => ({ ...s, [gradeKey]: e.target.value, [streamKey]: "" }))}>
            <option value="">{role === "STUDENT" ? "Choose a grade" : "None"}</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
          <Select label={role === "STUDENT" ? "Stream" : "Home stream (optional)"} value={f[streamKey]} onChange={set(streamKey)} disabled={!streams.length}>
            <option value="">{streams.length ? "No stream" : "Choose a grade first"}</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </div>
        {role === "STUDENT" && (
          <>
            <Input label="Date of birth" type="date" value={f.date_of_birth} onChange={set("date_of_birth")} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="UPI number" value={f.upi_number || ""} onChange={set("upi_number")} />
              <Input label="Assessment number" value={f.assessment_number || ""} onChange={set("assessment_number")} />
            </div>
            <p className="text-sm font-semibold pt-1">Parent or guardian</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input label="Name" value={f.guardian_name || ""} onChange={set("guardian_name")} />
              <Input label="Phone" value={f.guardian_phone || ""} onChange={set("guardian_phone")} />
              <Input label="Email" type="email" value={f.guardian_email || ""} onChange={set("guardian_email")} />
            </div>
          </>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Phone (optional)" value={f.phone_number || ""} onChange={set("phone_number")} />
          <Input label="Personal email (optional)" type="email" value={f.personal_email || ""} onChange={set("personal_email")} hint="For contact only. Not used to sign in." />
        </div>
        {!editing && (
          <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-1 size-4 accent-[rgb(var(--b600))]" checked={f.must_change_password} onChange={(e) => setF((s) => ({ ...s, must_change_password: e.target.checked }))} />
            <span>Ask them to choose their own password the first time they sign in <span className="text-slate-500">(recommended)</span></span></label>
        )}
        {!editing && <p className="text-xs text-slate-500">The sign-in email is created for you from the name, like <span className="font-mono">firstname.secondname@{role.toLowerCase()}.yourschool.com</span>. The account works straight away.</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function BulkModal({ role, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const template = () => downloadCsv(`${SINGULAR[role]}-template.csv`, role === "STUDENT"
    ? [["first_name", "second_name", "other_name", "admission_number", "gender", "date_of_birth", "grade", "stream", "guardian_name", "guardian_phone", "guardian_email", "upi_number", "assessment_number"],
       ["Amina", "Hassan", "", "1001", "Female", "2014-03-21", "Grade 4", "A", "Fatuma Hassan", "0712345678", "", "", ""]]
    : [["first_name", "second_name", "other_name", "gender", "employee_id", "phone_number", "home_grade", "home_stream"], ["John", "Kamau", "", "Male", "T1234", "0712345678", "Grade 4", "A"]]);
  const go = async () => {
    setBusy(true); setError("");
    try { const fd = new FormData(); fd.append("file", file); fd.append("role", role); setRes(await api.upload("/accounts/bulk", fd)); }
    catch (x) { setError(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Import ${SINGULAR[role]}s from a spreadsheet`} onClose={onClose} wide
      footer={res ? <Btn onClick={() => onDone(res.created)}>{res.created.length ? "Show sign-in details" : "Close"}</Btn> : <><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn loading={busy} disabled={!file} onClick={go}>Import</Btn></>}>
      {!res ? (
        <div className="space-y-4">
          <ErrorNote error={error} />
          <p className="text-sm text-slate-600">Save your spreadsheet as CSV. Grades and streams are matched by name, so they must already exist under Academics.</p>
          <Btn variant="outline" size="sm" icon={Download} onClick={template}>Download the template</Btn>
          <label className="block rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-400 p-8 text-center cursor-pointer">
            <Upload className="mx-auto text-brand-600" /><span className="block mt-2 font-semibold">{file ? file.name : "Choose a CSV file"}</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-emerald-700 font-semibold">{res.created.length} account{res.created.length === 1 ? "" : "s"} created.</p>
          {res.errors.length > 0 && (
            <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 p-4"><p className="font-semibold text-rose-800 mb-2">{res.errors.length} row{res.errors.length === 1 ? "" : "s"} skipped</p>
              <ul className="text-sm text-rose-800 space-y-1 max-h-48 overflow-auto">{res.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}</ul></div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Accounts() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [role, setRole] = useState(sp.get("tab") === "staff" ? "TEACHER" : "STUDENT");
  const [q, setQ] = useState(sp.get("q") || "");
  const [gradeId, setGradeId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [dq, setDq] = useState(q);
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const [form, setForm] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [creds, setCreds] = useState(null);

  const grades = useQuery("/grades").data || [];
  const streams = useQuery(gradeId ? `/streams${qs({ grade_id: gradeId })}` : null).data || [];
  const usage = useQuery("/accounts/usage").data || null;
  const rows = useQuery(`/accounts${qs({ role, q: dq, grade_id: role === "STUDENT" ? gradeId : "", stream_id: role === "STUDENT" ? streamId : "" })}`).data;
  const loadUsage = () => {}; const load = () => {}; // lists refresh themselves after every save

  const after = (c, u) => {
    setForm(null);
    if (!c) return;
    setCreds(c);
    if (u) { // show the new person straight away; the server then confirms
      patchCache("/accounts", (list, key) => (key.includes(`role=${u.role}`) ? [u, ...list] : list));
      const k = u.role === "STUDENT" ? "students" : "staff";
      patchCache("/accounts/usage", (x) => ({ ...x, [k]: { ...x[k], used: x[k].used + 1 } }));
    }
  };
  const reset = async (u) => {
    if (!window.confirm(`Generate a new temporary password for ${u.full_name}?`)) return;
    try { setCreds((await api.post(`/accounts/${u.id}/reset-password`)).credentials); } catch (e) { toast.error(e.message); }
  };
  const toggle = async (u) => {
    const on = u.status !== "ACTIVE";
    if (!on && !window.confirm(`Disable ${u.full_name}? They will not be able to sign in.`)) return;
    try { await optimistic(() => api.post(`/accounts/${u.id}/status`, { active: on }), [["/accounts", (list) => list.map((r) => (r.id === u.id ? { ...r, status: on ? "ACTIVE" : "DISABLED" } : r))]]); toast.success(on ? "Account re-enabled." : "Account disabled."); } catch (e) { toast.error(e.message); }
  };
  const u = usage && (role === "STUDENT" ? usage.students : usage.staff);
  const full = u && u.max !== null && u.used >= u.max;

  return (
    <Page title="Accounts" subtitle="Create learner and staff accounts. Each person can sign in the moment you create them."
      actions={<><Btn variant="outline" icon={Upload} onClick={() => setBulk(true)} disabled={full}>Import CSV</Btn><Btn icon={UserPlus} onClick={() => setForm({})} disabled={full}>Add {SINGULAR[role]}</Btn></>}>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Tabs value={role} onChange={(r) => { setRole(r); setSp({}); }} tabs={TABS.map(([value, label]) => ({ value, label }))} />
        {u && (
          <div className="w-full sm:w-64"><div className="flex justify-between text-xs mb-1"><span className="text-slate-600">Plan usage</span><span className="font-semibold">{u.used} / {u.max ?? "no limit"}</span></div>
            <Progress value={u.used} max={u.max || u.used || 1} tone={full ? "red" : "brand"} /></div>
        )}
      </div>
      {full && <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-900 text-sm px-4 py-3">You have reached the limit on your plan. Contact SMARTMARK SOLUTIONS to add more.</div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, admission number or email" className="w-full rounded-xl bg-surface ring-1 ring-slate-300 pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" /></div>
        {role === "STUDENT" && (
          <>
            <div className="sm:w-44"><Select value={gradeId} onChange={(e) => { setGradeId(e.target.value); setStreamId(""); }} aria-label="Grade"><option value="">All grades</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></div>
            <div className="sm:w-40"><Select value={streamId} onChange={(e) => setStreamId(e.target.value)} disabled={!streams.length} aria-label="Stream"><option value="">All streams</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
          </>
        )}
      </div>

      <Card pad={false}>
        {!rows ? <Spinner /> : rows.length === 0 ? (
          <Empty icon={Users} title={q ? "No one matches that search" : `No ${SINGULAR[role]}s yet`} hint={q ? "Try a different name or admission number." : `Add your first ${SINGULAR[role]} or import a whole class from a spreadsheet.`}
            action={!q && <Btn icon={UserPlus} onClick={() => setForm({})}>Add {SINGULAR[role]}</Btn>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar name={r.full_name} />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{r.smartmark_email}</p>
                    <p className="text-xs text-slate-500">{role === "STUDENT" ? `Adm. ${r.admission_number} · ${r.grade_name || "No grade"} ${r.stream_name || ""}` : `${r.employee_id ? "ID " + r.employee_id + " · " : ""}${r.home_grade_name ? "Class teacher " + r.home_grade_name + " " + (r.home_stream_name || "") : "No home class"}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                  <Badge tone={r.status === "ACTIVE" ? "green" : "red"}>{r.status === "ACTIVE" ? "Active" : "Disabled"}</Badge>
                  <span className="text-xs text-slate-500 hidden md:inline w-36">{r.last_login_at ? `Seen ${fmtDateTime(r.last_login_at)}` : r.must_change_password ? "Not signed in yet" : "Never signed in"}</span>
                  <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setForm(r)} aria-label="Edit"><span className="sr-only">Edit</span></Btn>
                  <Btn size="sm" variant="ghost" icon={KeyRound} onClick={() => reset(r)} aria-label="Reset password"><span className="sr-only">Reset password</span></Btn>
                  <Btn size="sm" variant="ghost" icon={r.status === "ACTIVE" ? Ban : CheckCircle2} onClick={() => toggle(r)} aria-label={r.status === "ACTIVE" ? "Disable" : "Enable"}><span className="sr-only">Toggle</span></Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {form && <AccountForm role={role} initial={form.id ? form : null} grades={grades} onClose={() => setForm(null)} onSaved={after} />}
      {bulk && <BulkModal role={role} onClose={() => setBulk(false)} onDone={(c) => { setBulk(false); load(); loadUsage(); if (c.length) setCreds(c); }} />}
      {creds && <CredentialsModal creds={creds} title={Array.isArray(creds) ? `${creds.length} new accounts` : "Account ready"} onClose={() => setCreds(null)} />}
    </Page>
  );
}
