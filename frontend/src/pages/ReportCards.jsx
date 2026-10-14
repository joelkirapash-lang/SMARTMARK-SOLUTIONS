import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Printer, Link2, RotateCw, Users, ScrollText, Copy } from "lucide-react";
import { api, qs } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/Toast";
import { Page, Card, Btn, Select, Empty, Spinner } from "../components/ui";
import ReportCardView from "../components/ReportCardView";

export default function ReportCards() {
  const { user } = useAuth();
  const toast = useToast();
  const isStudent = user.role === "STUDENT";
  const isAdmin = user.role === "SCHOOL_ADMIN";
  const [sp] = useSearchParams();
  const [grades, setGrades] = useState([]); const [streams, setStreams] = useState([]); const [exams, setExams] = useState([]); const [students, setStudents] = useState([]);
  const [g, setG] = useState(""); const [s, setS] = useState(""); const [e, setE] = useState(sp.get("exam") || ""); const [stu, setStu] = useState(isStudent ? user.id : sp.get("student") || "");
  const [card, setCard] = useState(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const [landscape, setLandscape] = useState(false);
  const [bulk, setBulk] = useState(null); const [link, setLink] = useState(null);

  useEffect(() => { api.get("/exams").then(setExams); if (!isStudent) api.get("/grades").then(setGrades); }, [isStudent]);
  useEffect(() => { g ? api.get(`/streams${qs({ grade_id: g })}`).then(setStreams) : setStreams([]); }, [g]);
  useEffect(() => { if (g && !isStudent) api.get(`/students${qs({ grade_id: g, stream_id: s })}`).then(setStudents); else setStudents([]); }, [g, s, isStudent]);
  useEffect(() => {
    setCard(null); setErr(""); setLink(null);
    if (!stu || !e) return;
    setLoading(true);
    api.get(`/reports/card${qs({ student_id: stu, exam_id: e })}`).then(setCard).catch((x) => setErr(x.message)).finally(() => setLoading(false));
  }, [stu, e]);

  const printClass = async () => {
    try { const list = await api.get(`/reports/class${qs({ exam_id: e, grade_id: g, stream_id: s })}`); if (!list.length) return toast.error("No marks have been recorded for this class yet."); setBulk(list); setTimeout(() => window.print(), 400); }
    catch (x) { toast.error(x.message); }
  };
  const makeLink = async () => {
    try { const r = await api.post("/reports/share-link", { student_id: stu, exam_id: e }); setLink(r.url); } catch (x) { toast.error(x.message); }
  };

  return (
    <Page title={isStudent ? "My report cards" : "Report cards"} subtitle={isStudent ? "Results your school has published." : "Print one learner or a whole class. Save as PDF from the print window."}
      actions={card && !bulk && <>
        <Btn variant="outline" icon={RotateCw} onClick={() => setLandscape(!landscape)}>{landscape ? "Portrait" : "Landscape"}</Btn>
        {isAdmin && <Btn variant="outline" icon={Link2} onClick={makeLink}>Parent link</Btn>}
        <Btn icon={Printer} onClick={() => window.print()}>Print or save PDF</Btn></>}>
      <style>{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; }`}</style>
      {!bulk && (
        <Card className="no-print"><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Select label="Exam" value={e} onChange={(x) => setE(x.target.value)}><option value="">Choose an exam</option>{exams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          {!isStudent && (
            <>
              <Select label="Grade" value={g} onChange={(x) => { setG(x.target.value); setS(""); setStu(""); }}><option value="">Choose a grade</option>{grades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
              <Select label="Stream" value={s} onChange={(x) => { setS(x.target.value); setStu(""); }} disabled={!streams.length}><option value="">All streams</option>{streams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
              <Select label="Learner" value={stu} onChange={(x) => setStu(x.target.value)} disabled={!students.length}><option value="">{students.length ? "Choose a learner" : "Choose a grade first"}</option>{students.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select>
            </>
          )}
        </div>
        {!isStudent && g && e && <div className="mt-4"><Btn variant="soft" icon={Users} onClick={printClass}>Print the whole class</Btn></div>}</Card>
      )}
      {link && <div className="no-print rounded-xl bg-accent-400/15 ring-1 ring-accent-500/30 px-4 py-3 text-sm flex flex-wrap items-center gap-3 justify-between">
        <span className="break-all">Parent link, valid for 30 days: <b>{link}</b></span>
        <Btn size="sm" variant="outline" icon={Copy} onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied."); }}>Copy</Btn></div>}

      {bulk ? (
        <>
          <div className="no-print flex gap-2"><Btn variant="outline" onClick={() => setBulk(null)}>Back</Btn><Btn icon={Printer} onClick={() => window.print()}>Print again</Btn><span className="text-sm text-slate-600 self-center">{bulk.length} report cards</span></div>
          <div className="space-y-6">{bulk.map((c, i) => <div key={i} className="print-break"><ReportCardView data={c} /></div>)}</div>
        </>
      ) : loading ? <Spinner /> : err ? <Card><Empty icon={ScrollText} title="This report card isn't available" hint={err} /></Card>
        : card ? <ReportCardView data={card} className={landscape ? "max-w-5xl" : ""} />
        : <Card><Empty icon={ScrollText} title={isStudent ? "Choose an exam" : "Choose an exam and a learner"} hint={isStudent ? (exams.length ? "Pick an exam above to open your report card." : "Your school hasn't published any results yet.") : "The report card appears here, ready to print."} /></Card>}
    </Page>
  );
}
