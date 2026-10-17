import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Printer, FileSpreadsheet, ListOrdered, ScrollText } from "lucide-react";
import { api, qs, assetUrl } from "../lib/api";
import { useQuery } from "../lib/query";
import { useAuth } from "../context/AuthContext";
import { Page, Card, Btn, Select, Empty, Spinner } from "../components/ui";

export default function Marklist() {
  const { school: mine } = useAuth();
  const [sp] = useSearchParams();
  const [g, setG] = useState(sp.get("grade") || ""); const [s, setS] = useState(sp.get("stream") || ""); const [e, setE] = useState(sp.get("exam") || "");
  const grades = useQuery("/grades").data || []; const exams = useQuery("/exams").data || [];
  const streams = useQuery(g ? `/streams${qs({ grade_id: g })}` : null).data || [];
  const school = useQuery("/school").data || mine || {};
  const { data, loading, error } = useQuery(g && e ? `/marklist${qs({ exam_id: e, grade_id: g, stream_id: s })}` : null);
  const gradeName = grades.find((x) => x.id === g)?.name; const streamName = streams.find((x) => x.id === s)?.name; const exam = exams.find((x) => x.id === e);
  const line = [school.motto, school.address, school.contact_phone, school.contact_email].filter(Boolean).join("  ·  ");
  const stat = (id) => data.subject_stats.find((x) => x.subject_id === id);
  const meanOfTotals = data && data.learners ? Math.round((data.grand_total / data.learners) * 10) / 10 : null;
  return (
    <Page title="Marklists" subtitle="A ranked class list for any grade, stream and exam. Learners with the same mean share a position."
      actions={data && data.rows.length > 0 && <><Btn variant="outline" icon={Printer} onClick={() => window.print()}>Print</Btn>
        <Btn variant="accent" icon={FileSpreadsheet} onClick={() => api.download(`/marklist/export${qs({ exam_id: e, grade_id: g, stream_id: s })}`, "marklist.xlsx")}>Download Excel</Btn>
        <Link to={`/app/report-cards?exam=${e}&grade=${g}&stream=${s}`}><Btn variant="outline" icon={ScrollText}>Report cards</Btn></Link></>}>
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <Card className="no-print"><div className="grid sm:grid-cols-3 gap-3">
        <Select label="Grade" value={g} onChange={(x) => { setG(x.target.value); setS(""); }}><option value="">Choose a grade</option>{grades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        <Select label="Stream" value={s} onChange={(x) => setS(x.target.value)} disabled={!streams.length}><option value="">All streams</option>{streams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        <Select label="Exam" value={e} onChange={(x) => setE(x.target.value)}><option value="">Choose an exam</option>{exams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
      </div></Card>
      {error && <Card><Empty title="Can't show this list" hint={error.message} /></Card>}
      {!g || !e ? (!error && <Card><Empty icon={ListOrdered} title="Choose a grade and an exam" hint="The ranked marklist appears here." /></Card>)
        : loading ? <Spinner /> : data && (data.rows.length === 0 ? <Card><Empty title="No learners or marks yet" /></Card> : (
          <div className="paper ml print-area" style={{ overflowX: "auto" }}>
            <div className="rc-head">
              {school.crest_url ? <img className="rc-crest" src={assetUrl(school.crest_url)} alt="School crest" /> : <div className="rc-crest-gap" />}
              <div className="rc-headtext">
                <div className="rc-school">{school.name}</div>
                {line && <div className="rc-sub">{line}</div>}
                <div className="rc-title">{gradeName}{streamName ? ` ${streamName}` : ""} — {[exam?.term, exam?.name].filter(Boolean).join(" · ")} Marklist</div>
              </div>
              <div className="rc-crest-gap" />
            </div>
            <div className="rc-rule" />
            {data.class_teacher && <p style={{ fontSize: 13, marginBottom: 8 }}>Class teacher: <b>{data.class_teacher.toUpperCase()}</b></p>}
            <table className="ml-table" style={{ minWidth: 640 }}>
              <thead><tr><th className="n">#</th><th>Adm</th><th>Name</th>
                {data.subjects.map((x) => <th key={x.id} className="n" title={x.name}>{x.code}</th>)}
                <th className="n">Total</th><th className="n">Mean</th><th className="n">Lvl</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.student_id}>
                    <td className="n">{r.position ?? "–"}</td><td>{r.admission_number}</td><td>{r.student_name.toUpperCase()}</td>
                    {data.subjects.map((x) => <td key={x.id} className="n">{r.scores[x.id] ?? "–"}</td>)}
                    <td className="n">{r.total}</td><td className="n">{r.average ?? "–"}</td><td className="n">{r.band || ""}</td>
                  </tr>
                ))}
                <tr className="sum"><td /><td /><td>Subject mean</td>
                  {data.subjects.map((x) => <td key={x.id} className="n">{stat(x.id)?.mean ?? "–"}</td>)}
                  <td className="n">{meanOfTotals ?? "–"}</td><td className="n">{data.class_mean ?? "–"}</td><td className="n">{data.class_band || ""}</td></tr>
                <tr className="sum"><td /><td /><td>Class summary</td>
                  {data.subjects.map((x) => <td key={x.id} className="n">{stat(x.id)?.total} / {stat(x.id)?.mean ?? "–"}</td>)}
                  <td className="n">{data.grand_total}</td><td className="n">{data.class_mean ?? "–"}</td><td className="n">{data.class_band || ""}</td></tr>
              </tbody>
            </table>
            <div className="rc-foot">{school.report_card_footer && <div style={{ textTransform: "uppercase" }}>{school.report_card_footer}</div>}<div>Powered by SMARTMARK SOLUTIONS</div></div>
          </div>
        ))}
    </Page>
  );
}
