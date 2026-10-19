import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckCircle2, PauseCircle, AlertTriangle, GraduationCap, Users, Plus, Eye, Pause, Play, Settings2, Search, KeyRound } from "lucide-react";
import { api } from "../lib/api";
import { useQuery, optimistic } from "../lib/query";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/Toast";
import { cn, fmtDate, ROLE_LABEL } from "../lib/format";
import { Page, Card, Stat, Btn, Input, Select, Textarea, Badge, Modal, Empty, Spinner, Progress, ErrorNote, Avatar, Tabs } from "../components/ui";
import { Bars } from "../components/charts";
import ActivityFeed from "../components/ActivityFeed";
import CredentialsModal from "../components/CredentialsModal";

const PAY = { PAID: ["green", "Paid"], INSTALLMENTS: ["amber", "On installments"], OVERDUE: ["red", "Overdue"], TRIAL: ["blue", "Trial"] };

export function SuperDashboard() {
  const { data: s } = useQuery("/super/stats");
  const nav = useNavigate();
  if (!s) return <Spinner />;
  return (
    <Page title="Platform overview" subtitle="Every school on SMARTMARK SOLUTIONS at a glance."
      actions={<Btn icon={Building2} onClick={() => nav("/app/schools")}>Manage schools</Btn>}>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <Stat label="Schools" value={s.schools} icon={Building2} tone="violet" />
        <Stat label="Active" value={s.active} icon={CheckCircle2} tone="emerald" />
        <Stat label="Paused" value={s.suspended} icon={PauseCircle} tone="amber" />
        <Stat label="Overdue payments" value={s.overdue} icon={AlertTriangle} tone="rose" />
        <Stat label="Learners" value={s.students} icon={GraduationCap} tone="blue" />
        <Stat label="Teachers and educators" value={s.staff} icon={Users} tone="cyan" />
        <Stat label="School admin accounts" value={s.admins} icon={KeyRound} tone="brand" />
      </div>
      <div className="grid xl:grid-cols-2 gap-6">
        <Card title="Largest schools by learners">
          {s.top_schools.length ? <Bars data={s.top_schools} nameKey="name" dataKey="students" /> : <Empty title="No schools yet" hint="Create your first school to get started." action={<Btn onClick={() => nav("/app/schools")}>Add a school</Btn>} />}
        </Card>
        <Card title="Needs your attention">
          {s.attention.length === 0 ? <Empty icon={CheckCircle2} title="All clear" hint="No overdue payments or paused schools." /> : (
            <ul className="divide-y divide-slate-100">
              {s.attention.map((x) => (
                <li key={x.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="font-semibold truncate">{x.name}</p>
                    <p className="text-xs text-slate-500">{x.next_payment_due ? `Next payment ${fmtDate(x.next_payment_due)}` : "No due date set"}</p></div>
                  <div className="flex gap-1.5 shrink-0">{!x.is_active && <Badge tone="amber">Paused</Badge>}<Badge tone={PAY[x.payment_status]?.[0]}>{PAY[x.payment_status]?.[1]}</Badge></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title={`Schools created (${s.schools})`} pad={false}>
        {s.all_schools.length === 0 ? <Empty icon={Building2} title="No schools yet" hint="Schools you create appear here with how many admins each has." /> : (
          <div className="overflow-x-auto sms-scroll"><table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-slate-600 bg-slate-50"><th className="px-5 py-2.5">School</th><th className="px-3 py-2.5">Created</th><th className="px-3 py-2.5 text-right">Admins</th><th className="px-3 py-2.5 text-right">Learners</th><th className="px-3 py-2.5 text-right">Staff</th><th className="px-5 py-2.5">Status</th></tr></thead>
            <tbody>{s.all_schools.map((x) => (
              <tr key={x.id} className="border-t border-slate-100"><td className="px-5 py-2.5 font-semibold">{x.name}</td><td className="px-3 py-2.5 text-slate-600">{fmtDate(x.created_at)}</td>
                <td className="px-3 py-2.5 text-right"><Badge tone="brand">{x.admins}</Badge></td><td className="px-3 py-2.5 text-right">{x.students}</td><td className="px-3 py-2.5 text-right">{x.staff}</td>
                <td className="px-5 py-2.5">{x.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Paused</Badge>}</td></tr>))}</tbody></table></div>)}
      </Card>
      <Card title="Latest activity across all schools"><ActivityFeed items={s.recent_activity} /></Card>
    </Page>
  );
}

const blank = { school_name: "", admin_first_name: "", admin_second_name: "", admin_phone: "", max_students: "", max_staff: "", plan_name: "", payment_status: "PAID", next_payment_due: "", billing_note: "" };

function PlanFields({ f, set }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Learner limit" type="number" min="0" value={f.max_students ?? ""} onChange={set("max_students")} hint="Leave empty for no limit" />
        <Input label="Staff limit" type="number" min="0" value={f.max_staff ?? ""} onChange={set("max_staff")} hint="Teachers + educators" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Plan name" value={f.plan_name ?? ""} onChange={set("plan_name")} placeholder="e.g. Standard 500" />
        <Select label="Payment status" value={f.payment_status} onChange={set("payment_status")}>
          <option value="PAID">Paid in full</option><option value="INSTALLMENTS">On installments</option>
          <option value="OVERDUE">Overdue</option><option value="TRIAL">Trial</option>
        </Select>
      </div>
      <Input label="Next payment due" type="date" value={f.next_payment_due ?? ""} onChange={set("next_payment_due")} />
      <Textarea label="Private billing note" value={f.billing_note ?? ""} onChange={set("billing_note")} hint="Only you can see this." />
    </>
  );
}

const TITLES = ["Head teacher", "Deputy head teacher", "Chairperson", "Board member", "Computer patron", "ICT officer", "Secretary", "Bursar", "Director"];

function PositionPicker({ value, onChange, label = "Position" }) {
  const [other, setOther] = useState(!!value && !TITLES.includes(value));
  return (
    <div className="space-y-2">
      <Select label={label} value={other ? "__other" : value || ""} onChange={(e) => { const v = e.target.value; if (v === "__other") { setOther(true); onChange(""); } else { setOther(false); onChange(v); } }}>
        <option value="">No position</option>
        {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
        <option value="__other">Other…</option>
      </Select>
      {other && <Input label="Position name" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Board secretary" />}
    </div>
  );
}

function AdminsPanel({ school, onCreds }) {
  const toast = useToast();
  const listKey = `/super/schools/${school.id}/users`;
  const { data: admins } = useQuery(`${listKey}?role=SCHOOL_ADMIN`);
  const blank = { first_name: "", second_name: "", job_title: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post(`/super/schools/${school.id}/admins`, f); setF(blank); onCreds(r.credentials); toast.success("Admin added."); }
    catch (x) { toast.error(x.message); } finally { setBusy(false); }
  };
  const reset = async (a) => {
    if (!window.confirm(`Generate a new temporary password for ${a.full_name}?`)) return;
    try { onCreds((await api.post(`/super/users/${a.id}/reset-password`)).credentials); } catch (x) { toast.error(x.message); }
  };
  const change = (a, patch) => (rows) => rows.map((x) => (x.id === a.id ? { ...x, ...patch } : x));
  const toggle = async (a) => {
    const on = a.status !== "ACTIVE";
    try { await optimistic(() => api.post(`/super/users/${a.id}/status`, { active: on }), [[listKey, change(a, { status: on ? "ACTIVE" : "DISABLED" })]]); } catch (x) { toast.error(x.message); }
  };
  const retitle = async (a, title) => {
    try { await optimistic(() => api.put(`/super/users/${a.id}`, { job_title: title }), [[listKey, change(a, { job_title: title || null })]]); } catch (x) { toast.error(x.message); }
  };
  return (
    <div className="rounded-xl ring-1 ring-slate-200 p-4 space-y-3">
      <p className="font-display font-semibold">School admins <Badge tone="brand">{admins ? admins.length : "…"}</Badge></p>
      <p className="text-xs text-slate-500">Head teacher, chairperson, computer patron or anyone else you choose. Every admin sees and can do exactly the same things.</p>
      <ul className="divide-y divide-slate-100">
        {(admins || []).map((a) => (
          <li key={a.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2"><Avatar name={a.full_name} size={34} />
            <div className="min-w-0 flex-1 basis-40"><p className="text-sm font-semibold truncate">{a.full_name} {a.status !== "ACTIVE" && <Badge tone="red">Disabled</Badge>}</p><p className="text-xs text-slate-500 truncate">{a.smartmark_email}</p></div>
            <select aria-label={`Position of ${a.full_name}`} value={a.job_title || ""} onChange={(e) => retitle(a, e.target.value)}
              className="rounded-lg ring-1 ring-slate-300 bg-surface text-sm px-2 py-1.5 max-w-[11rem]">
              <option value="">No position</option>
              {[...new Set([...TITLES, a.job_title].filter(Boolean))].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Btn size="sm" variant="ghost" icon={KeyRound} onClick={() => reset(a)} aria-label={`Reset password for ${a.full_name}`}><span className="sr-only">Reset</span></Btn>
            <Btn size="sm" variant="ghost" onClick={() => toggle(a)}>{a.status === "ACTIVE" ? "Disable" : "Enable"}</Btn></li>
        ))}
      </ul>
      <form onSubmit={add} className="space-y-3 rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-semibold">Add another admin</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input label="First name" required value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
          <Input label="Second name" value={f.second_name} onChange={(e) => setF({ ...f, second_name: e.target.value })} />
        </div>
        <PositionPicker value={f.job_title} onChange={(v) => setF({ ...f, job_title: v })} />
        <Btn type="submit" loading={busy} icon={Plus}>Add admin</Btn>
      </form>
    </div>
  );
}

export function Schools() {
  const { viewAs } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { data: rows } = useQuery("/super/schools");
  const [create, setCreate] = useState(null);
  const [manage, setManage] = useState(null);
  const [creds, setCreds] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [adminsFor, setAdminsFor] = useState(null);

  const load = () => {};
  const set = (state, setter) => (k) => (e) => setter({ ...state, [k]: e.target.value });

  const submitCreate = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = await api.post("/super/schools", create);
      setCreate(null); setCreds(r.credentials); load();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const saveManage = async () => {
    setErr(""); setBusy(true);
    try {
      const { name, plan_name, payment_status, next_payment_due, billing_note, max_students, max_staff } = manage;
      await api.put(`/super/schools/${manage.id}`, { name, plan_name, payment_status, next_payment_due, billing_note, max_students, max_staff });
      toast.success("School plan saved."); setManage(null); load();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const pause = async (s, why) => {
    try { await api.post(`/super/schools/${s.id}/suspend`, { reason: why }); toast.success(`${s.name} is now paused.`); setManage(null); setReason(""); load(); } catch (x) { setErr(x.message); }
  };
  const resume = async (s) => { await api.post(`/super/schools/${s.id}/resume`); toast.success(`${s.name} is active again.`); setManage(null); load(); };
  const enterAsAdmin = async (s) => {
    const admins = await api.get(`/super/schools/${s.id}/users?role=SCHOOL_ADMIN`);
    if (!admins.length) return toast.error("This school has no admin account.");
    await viewAs(admins[0].id); nav("/app");
  };
  const resetAdmin = async (s) => {
    const admins = await api.get(`/super/schools/${s.id}/users?role=SCHOOL_ADMIN`);
    if (!admins.length) return;
    if (!window.confirm(`Generate a new temporary password for ${admins[0].full_name}?`)) return;
    const r = await api.post(`/super/users/${admins[0].id}/reset-password`);
    setCreds(r.credentials);
  };

  return (
    <Page title="Schools" subtitle="Create schools, set what each one has bought, and pause access when payments are missed."
      actions={<Btn icon={Plus} onClick={() => { setErr(""); setCreate({ ...blank }); }}>Add school</Btn>}>
      {!rows ? <Spinner /> : rows.length === 0 ? (
        <Card><Empty icon={Building2} title="No schools yet" hint="Add a school, choose its learner and staff limits, and hand over the admin sign-in details." action={<Btn onClick={() => setCreate({ ...blank })}>Add the first school</Btn>} /></Card>
      ) : (
        <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-5">
          {rows.map((s) => {
            const [tone, label] = PAY[s.payment_status] || ["slate", s.payment_status];
            return (
              <div key={s.id} className={cn("rounded-2xl bg-surface shadow-soft ring-1 overflow-hidden", s.is_active ? "ring-slate-900/5" : "ring-amber-400")}>
                <div className={cn("h-1.5", s.is_active ? "bg-gradient-to-r from-brand-500 to-accent-500" : "bg-amber-400")} />
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><h3 className="font-display text-lg font-semibold truncate">{s.name}</h3>
                      <p className="text-xs text-slate-500">{s.plan_name || "No plan name"} · since {fmtDate(s.created_at)}</p></div>
                    <div className="flex flex-col items-end gap-1">{!s.is_active && <Badge tone="amber">Paused</Badge>}<Badge tone={tone}>{label}</Badge></div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1.5">School admins: <b>{s.usage.admins}</b></p>
                    <div className="flex flex-wrap gap-1.5">
                      {(s.admin_users || []).slice(0, 4).map((a) => <span key={a.id} className={cn("rounded-full text-xs font-medium px-2.5 py-1", a.status === "ACTIVE" ? "bg-brand-50 text-brandtext" : "bg-rose-50 text-rose-700 line-through")}>{a.full_name}{a.job_title ? ` · ${a.job_title}` : ""}</span>)}
                      {(s.admin_users || []).length > 4 && <span className="rounded-full text-xs px-2.5 py-1 bg-slate-100 text-slate-600">+{s.admin_users.length - 4} more</span>}
                    </div>
                  </div>
                  {[["Learners", s.usage.students, s.max_students], ["Staff", s.usage.staff, s.max_staff]].map(([k, used, max]) => (
                    <div key={k}><div className="flex justify-between text-sm mb-1"><span className="text-slate-600">{k}</span><span className="font-semibold">{used}{max !== null ? ` / ${max}` : " · no limit"}</span></div>
                      <Progress value={used} max={max || used || 1} tone={max !== null && used >= max ? "red" : "brand"} /></div>
                  ))}
                  {s.next_payment_due && <p className="text-xs text-slate-500">Next payment due {fmtDate(s.next_payment_due)}</p>}
                  {!s.is_active && s.suspended_reason && <p className="text-xs rounded-lg bg-amber-50 text-amber-900 px-3 py-2">{s.suspended_reason}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Btn size="sm" variant="soft" icon={Settings2} onClick={() => { setErr(""); setReason(""); setManage({ ...s }); }}>Manage</Btn>
                    <Btn size="sm" variant="accent" icon={Plus} onClick={() => setAdminsFor(s)}>Add admin</Btn>
                    <Btn size="sm" variant="outline" icon={Eye} onClick={() => enterAsAdmin(s)}>View as admin</Btn>
                    {s.is_active ? <Btn size="sm" variant="dangerSoft" icon={Pause} onClick={() => { setErr(""); setReason(""); setManage({ ...s }); }}>Pause</Btn>
                      : <Btn size="sm" variant="accent" icon={Play} onClick={() => resume(s)}>Resume</Btn>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {create && (
        <Modal title="Add a school" onClose={() => setCreate(null)} wide
          footer={<><Btn variant="ghost" onClick={() => setCreate(null)}>Cancel</Btn><Btn loading={busy} onClick={submitCreate}>Create school</Btn></>}>
          <form onSubmit={submitCreate} className="space-y-4">
            <ErrorNote error={err} />
            <Input label="School name" required value={create.school_name} onChange={set(create, setCreate)("school_name")} />
            <p className="text-sm font-semibold text-slate-800 pt-1">School administrator</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="First name" required value={create.admin_first_name} onChange={set(create, setCreate)("admin_first_name")} />
              <Input label="Second name" value={create.admin_second_name} onChange={set(create, setCreate)("admin_second_name")} />
            </div>
            <Input label="Phone (optional)" value={create.admin_phone} onChange={set(create, setCreate)("admin_phone")} />
            <p className="text-sm font-semibold text-slate-800 pt-1">What they bought</p>
            <PlanFields f={create} set={set(create, setCreate)} />
            <button type="submit" className="hidden" />
          </form>
        </Modal>
      )}

      {manage && (
        <Modal title={manage.name} onClose={() => setManage(null)} wide
          footer={<><Btn variant="ghost" onClick={() => setManage(null)}>Close</Btn><Btn loading={busy} onClick={saveManage}>Save plan</Btn></>}>
          <div className="space-y-4">
            <ErrorNote error={err} />
            <Input label="School name" value={manage.name} onChange={set(manage, setManage)("name")} />
            <PlanFields f={manage} set={set(manage, setManage)} />
            <AdminsPanel school={manage} onCreds={setCreds} />
            <div className={cn("rounded-xl p-4 space-y-3 ring-1", manage.is_active ? "ring-rose-200 bg-rose-50/50" : "ring-amber-300 bg-amber-50")}>
              <p className="font-display font-semibold">{manage.is_active ? "Pause this school" : "This school is paused"}</p>
              {manage.is_active ? (
                <>
                  <p className="text-sm text-slate-600">Everyone at this school is signed out of the system and sees your message until you resume access. Their data stays safe.</p>
                  <Textarea label="Message they will see" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Your instalment is due. Please contact us to restore access." />
                  <Btn variant="danger" icon={Pause} onClick={() => window.confirm(`Pause ${manage.name} now?`) && pause(manage, reason)}>Pause access</Btn>
                </>
              ) : <Btn variant="accent" icon={Play} onClick={() => resume(manage)}>Resume access</Btn>}
            </div>
          </div>
        </Modal>
      )}
      {adminsFor && (
        <Modal title={`Admins at ${adminsFor.name}`} onClose={() => setAdminsFor(null)} wide footer={<Btn onClick={() => setAdminsFor(null)}>Done</Btn>}>
          <AdminsPanel school={adminsFor} onCreds={setCreds} />
        </Modal>
      )}
      {creds && <CredentialsModal creds={creds} title="School administrator sign-in" onClose={() => setCreds(null)} />}
    </Page>
  );
}

const ROLES = [["SCHOOL_ADMIN", "School admins"], ["TEACHER", "Teachers"], ["EDUCATOR", "Educators"], ["STUDENT", "Students"]];

export function ViewAs() {
  const { viewAs } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { data: schools } = useQuery("/super/schools");
  const [sid0, setSid] = useState("");
  const [role, setRole] = useState("SCHOOL_ADMIN");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [creds, setCreds] = useState(null);
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const sid = sid0 || schools?.[0]?.id || "";
  const { data: users } = useQuery(sid ? `/super/schools/${sid}/users?role=${role}&q=${encodeURIComponent(dq)}` : null);

  const enter = async (u) => { try { await viewAs(u.id); nav("/app"); } catch (e) { toast.error(e.message); } };
  const reset = async (u) => {
    if (!window.confirm(`Generate a new temporary password for ${u.full_name}?`)) return;
    setCreds((await api.post(`/super/users/${u.id}/reset-password`)).credentials);
  };

  if (!schools) return <Spinner />;
  return (
    <Page title="Visit any role" subtitle="Step into a real account to see exactly what that person sees. You can look but not change anything.">
      {schools.length === 0 ? <Card><Empty icon={Eye} title="No schools to visit yet" hint="Add a school first, then create its accounts." /></Card> : (
        <>
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="lg:w-72"><Select label="School" value={sid} onChange={(e) => setSid(e.target.value)}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
            <Tabs value={role} onChange={setRole} tabs={ROLES.map(([value, label]) => ({ value, label }))} />
            <div className="relative lg:w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or admission" className="w-full rounded-xl bg-surface ring-1 ring-slate-300 pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" /></div>
          </div>
          <Card pad={false}>
            {!users ? <Spinner /> : users.length === 0 ? <Empty title="No accounts here yet" hint="The school admin creates teacher, educator and student accounts." /> : (
              <ul className="divide-y divide-slate-100">
                {users.map((u) => (
                  <li key={u.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                    <Avatar name={u.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{u.full_name} {u.status === "DISABLED" && <Badge tone="red">Disabled</Badge>}</p>
                      <p className="text-xs text-slate-500 truncate">{u.smartmark_email}{u.admission_number ? ` · ${u.admission_number}` : ""}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Btn size="sm" variant="outline" onClick={() => reset(u)} icon={KeyRound}><span className="hidden sm:inline">Reset</span></Btn>
                      <Btn size="sm" icon={Eye} onClick={() => enter(u)}>Enter</Btn>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
    </Page>
  );
}
