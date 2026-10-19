import { useEffect, useState } from "react";
import { Plus, Trash2, Sparkles, Layers } from "lucide-react";
import { api } from "../lib/api";
import { useQuery, optimistic } from "../lib/query";
import { useToast } from "../context/Toast";
import { cn, bandStyle } from "../lib/format";
import { Page, Card, Btn, Input, Select, Badge, Empty, Spinner, Tabs, ErrorNote } from "../components/ui";

const B8 = [["BE1", "Below Expectation 1", 0, 10], ["BE2", "Below Expectation 2", 11, 23], ["AE1", "Approaching Expectation 1", 24, 34], ["AE2", "Approaching Expectation 2", 35, 49],
  ["ME1", "Meeting Expectation 1", 50, 59], ["ME2", "Meeting Expectation 2", 60, 69], ["EE1", "Exceeding Expectation 1", 70, 79], ["EE2", "Exceeding Expectation 2", 80, 100]];
const B4 = [["BE", "Below Expectation", 0, 39], ["AE", "Approaching Expectation", 40, 59], ["ME", "Meeting Expectation", 60, 79], ["EE", "Exceeding Expectation", 80, 100]];
const asBands = (list) => list.map(([code, label, min_score, max_score], i) => ({ id: `tmp-${code}-${i}`, code, label, min_score, max_score }));

export default function Academics() {
  const toast = useToast();
  const [tab, setTab] = useState("grades");
  const grades = useQuery("/grades").data;
  const streams = useQuery("/streams").data || [];
  const subjects = useQuery("/subjects").data || [];
  const bands = useQuery("/performance-bands").data || [];
  const [error, setError] = useState("");

  const run = async (fn, ok) => { setError(""); try { await fn(); ok && toast.success(ok); } catch (e) { setError(e.message); } };
  const tmp = () => `tmp-${Math.random().toString(36).slice(2)}`;
  // Add: the new row appears at once, then the server confirms it. If the server says no, the row goes away and the text comes back.
  const submit = (path, item, call, clear, restore, ok) => {
    clear();
    return run(async () => {
      try { await optimistic(call, [[path, (rows) => [...rows, { id: tmp(), ...item }]]]); } catch (e) { restore(); throw e; }
    }, ok);
  };
  const drop = (path, id, call, ok) => run(() => optimistic(call, [[path, (rows) => rows.filter((x) => x.id !== id)]]), ok);

  const [gName, setGName] = useState(""); const [gOrder, setGOrder] = useState("");
  const [stName, setStName] = useState({});
  const [sName, setSName] = useState(""); const [sCode, setSCode] = useState("");
  const [band, setBand] = useState({ code: "", label: "", min_score: "", max_score: "" });
  const [mapGrade, setMapGrade] = useState(""); const [mapIds, setMapIds] = useState([]);
  useEffect(() => { mapGrade ? api.get(`/grades/${mapGrade}/subjects`).then(setMapIds) : setMapIds([]); }, [mapGrade]);

  const loadBands = (scale) => {
    if (bands.length && !window.confirm("Replace your current performance levels?")) return;
    run(() => optimistic(() => api.post("/academics/cbc-bands", { scale, replace: bands.length > 0 }), [["/performance-bands", () => asBands(scale === 8 ? B8 : B4)]]), "Performance levels loaded.");
  };

  if (!grades) return <Spinner />;
  return (
    <Page title="Academics" subtitle="Set up your grades, streams, subjects and performance levels. Everything starts empty, so you decide what your school uses.">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "grades", label: "Grades and streams", count: grades.length }, { value: "subjects", label: "Subjects", count: subjects.length }, { value: "bands", label: "Performance levels", count: bands.length }]} />
      <ErrorNote error={error} />

      {tab === "grades" && (
        <div className="grid xl:grid-cols-3 gap-6">
          <Card title="Add a grade" className="xl:col-span-1 self-start">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const n = gName, o = gOrder; submit("/grades", { name: n, order_index: Number(o) || 0 }, () => api.post("/grades", { name: n, order_index: o }), () => { setGName(""); setGOrder(""); }, () => { setGName(n); setGOrder(o); }, "Grade added."); }}>
              <Input label="Name" required value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Grade 4" />
              <Input label="Order" type="number" value={gOrder} onChange={(e) => setGOrder(e.target.value)} hint="Smaller numbers come first. Used for sorting and promotion." />
              <Btn type="submit" icon={Plus} className="w-full">Add grade</Btn>
            </form>
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="text-sm text-slate-600 mb-3">Prefer a head start? Add Playgroup, PP1, PP2 and Grade 1 to 10 in one click. You can still edit or remove any of them.</p>
              <Btn variant="soft" icon={Sparkles} className="w-full" onClick={() => run(async () => { const r = await api.post("/academics/cbc-levels"); toast.success(`${r.added} grades added.`); })}>Add the standard CBC levels</Btn>
            </div>
          </Card>
          <Card title="Your grades and streams" className="xl:col-span-2" pad={false}>
            {grades.length === 0 ? <Empty icon={Layers} title="No grades yet" hint="Add your first grade on the left." /> : (
              <ul className="divide-y divide-slate-100">
                {[...grades].sort((a, b) => a.order_index - b.order_index).map((g) => (
                  <li key={g.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3"><p className="font-display font-semibold">{g.name}</p>
                      <button className="text-slate-400 hover:text-rose-600 p-1" aria-label={`Remove ${g.name}`} onClick={() => window.confirm(`Remove ${g.name}?`) && drop("/grades", g.id, () => api.del(`/grades/${g.id}`), "Grade removed.")}><Trash2 size={16} /></button></div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {streams.filter((s) => s.grade_id === g.id).map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brandtext text-sm font-medium pl-3 pr-1.5 py-1">{s.name}
                          <button className="p-0.5 hover:text-rose-600" aria-label={`Remove stream ${s.name}`} onClick={() => drop("/streams", s.id, () => api.del(`/streams/${s.id}`), "Stream removed.")}><Trash2 size={13} /></button></span>
                      ))}
                      <form className="inline-flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const n = stName[g.id]; submit("/streams", { name: n, grade_id: g.id }, () => api.post("/streams", { name: n, grade_id: g.id }), () => setStName({ ...stName, [g.id]: "" }), () => setStName({ ...stName, [g.id]: n }), "Stream added."); }}>
                        <input value={stName[g.id] || ""} onChange={(e) => setStName({ ...stName, [g.id]: e.target.value })} placeholder="Add stream" required className="w-28 rounded-full ring-1 ring-slate-300 bg-surface px-3 py-1 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" aria-label={`New stream for ${g.name}`} />
                        <button className="rounded-full bg-brand-600 text-white size-7 grid place-items-center" aria-label="Add stream"><Plus size={15} /></button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "subjects" && (
        <div className="grid xl:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Card title="Add a subject">
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const n = sName, c = sCode; submit("/subjects", { name: n, code: c.toUpperCase() }, () => api.post("/subjects", { name: n, code: c }), () => { setSName(""); setSCode(""); }, () => { setSName(n); setSCode(c); }, "Subject added."); }}>
                <Input label="Name" required value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Mathematics" />
                <Input label="Short code" required value={sCode} onChange={(e) => setSCode(e.target.value)} placeholder="MATH" />
                <Btn type="submit" icon={Plus} className="w-full">Add subject</Btn>
              </form>
              <Btn variant="soft" icon={Sparkles} className="w-full mt-4" onClick={() => run(async () => { const r = await api.post("/academics/cbc-subjects"); toast.success(`${r.added} subjects added.`); })}>Add common CBC learning areas</Btn>
            </Card>
          </div>
          <Card title="Your subjects" pad={false}>
            {subjects.length === 0 ? <Empty title="No subjects yet" /> : (
              <ul className="divide-y divide-slate-100">{subjects.map((s) => (
                <li key={s.id} className="px-5 py-3 flex items-center justify-between"><span><span className="font-medium">{s.name}</span> <Badge>{s.code}</Badge></span>
                  <button className="text-slate-400 hover:text-rose-600 p-1" aria-label={`Remove ${s.name}`} onClick={() => window.confirm(`Remove ${s.name}?`) && drop("/subjects", s.id, () => api.del(`/subjects/${s.id}`), "Subject removed.")}><Trash2 size={16} /></button></li>))}</ul>
            )}
          </Card>
          <Card title="Subjects taught in each grade">
            <Select value={mapGrade} onChange={(e) => setMapGrade(e.target.value)}><option value="">Choose a grade</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
            {mapGrade && (
              <div className="mt-4 space-y-2">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-2.5 text-sm"><input type="checkbox" className="size-4 accent-[rgb(var(--b600))]" checked={mapIds.includes(s.id)}
                    onChange={(e) => setMapIds(e.target.checked ? [...mapIds, s.id] : mapIds.filter((x) => x !== s.id))} />{s.name}</label>))}
                <Btn className="w-full mt-2" onClick={() => run(() => api.put(`/grades/${mapGrade}/subjects`, { subject_ids: mapIds }), "Subjects saved for this grade.")}>Save</Btn>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "bands" && (
        <div className="grid xl:grid-cols-3 gap-6">
          <Card title="Add a level" className="self-start">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const b = band; submit("/performance-bands", { code: b.code.toUpperCase(), label: b.label, min_score: Number(b.min_score), max_score: Number(b.max_score) }, () => api.post("/performance-bands", b), () => setBand({ code: "", label: "", min_score: "", max_score: "" }), () => setBand(b), "Level added."); }}>
              <div className="grid grid-cols-2 gap-3"><Input label="Code" required value={band.code} onChange={(e) => setBand({ ...band, code: e.target.value })} placeholder="EE" />
                <Input label="Name" required value={band.label} onChange={(e) => setBand({ ...band, label: e.target.value })} placeholder="Exceeding" /></div>
              <div className="grid grid-cols-2 gap-3"><Input label="From %" type="number" step="0.01" required value={band.min_score} onChange={(e) => setBand({ ...band, min_score: e.target.value })} />
                <Input label="To %" type="number" step="0.01" required value={band.max_score} onChange={(e) => setBand({ ...band, max_score: e.target.value })} /></div>
              <Btn type="submit" icon={Plus} className="w-full">Add level</Btn>
            </form>
            <div className="mt-4 space-y-2">
              <Btn variant="soft" icon={Sparkles} className="w-full" onClick={() => loadBands(8)}>Load the 8-level scale (BE1 to EE2)</Btn>
              <Btn variant="outline" icon={Sparkles} className="w-full" onClick={() => loadBands(4)}>Load the 4-level scale (BE, AE, ME, EE)</Btn>
              <p className="text-xs text-slate-500">Loading a scale replaces the current levels, and you can still edit any of them. Automatic comments on report cards follow the scale you choose.</p>
            </div>
          </Card>
          <Card title="Performance levels" className="xl:col-span-2" pad={false}>
            {bands.length === 0 ? <Empty title="No levels yet" hint="Report cards show a level beside each score once you add them." /> : (
              <ul className="divide-y divide-slate-100">{[...bands].sort((a, b) => b.min_score - a.min_score).map((b) => (
                <li key={b.id} className="px-5 py-3 flex items-center gap-3"><span className={cn("rounded-md px-2.5 py-1 text-sm font-bold ring-1", bandStyle(b.code))}>{b.code}</span>
                  <span className="flex-1"><span className="font-medium">{b.label}</span> <span className="text-slate-500 text-sm">{b.min_score}% to {b.max_score}%</span></span>
                  <button className="text-slate-400 hover:text-rose-600 p-1" aria-label={`Remove ${b.code}`} onClick={() => drop("/performance-bands", b.id, () => api.del(`/performance-bands/${b.id}`), "Level removed.")}><Trash2 size={16} /></button></li>))}</ul>
            )}
          </Card>
        </div>
      )}
    </Page>
  );
}
