import { assetUrl } from "../lib/api";
import { cn, fmtDate } from "../lib/format";

/** The printed report card. Fixed light colours so it always looks like paper. */
export default function ReportCardView({ data, className = "" }) {
  if (!data) return null;
  const { school, student, exam, subjects, total, average, position, class_size, overall_band,
    class_teacher_remark, head_teacher_remark } = data;
  const line = [school.motto, school.address, school.phone, school.email].filter(Boolean).join("  ·  ");
  const term = exam.term || school.term;
  return (
    <article className={cn("paper rc print-area max-w-[860px] mx-auto shadow-soft", className)}>
      <header className="rc-head">
        {school.crest_url ? <img className="rc-crest" src={assetUrl(school.crest_url)} alt="School crest" /> : <div className="rc-crest-gap" />}
        <div className="rc-headtext">
          <div className="rc-school">{school.name}</div>
          {line && <div className="rc-sub">{line}</div>}
          <div className="rc-title">Learner report card — {[term, exam.name].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="rc-crest-gap" />
      </header>
      <div className="rc-rule" />
      <div className="rc-info">
        <div>Name: <b>{student.name.toUpperCase()}</b></div>
        <div>Adm No: <b>{student.admission_number || ""}</b></div>
        <div>Grade: <b>{[student.grade, student.stream].filter(Boolean).join(" ")}</b></div>
        <div>UPI: <b>{student.upi || "–"}</b> &nbsp; Assess. No: <b>{student.assessment_number || "–"}</b></div>
        <div>Position: <b>{position ? `${position} out of ${class_size}` : "–"}</b></div>
        <div>Class teacher: <b>{(student.class_teacher || "–").toUpperCase()}</b></div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="rc-table" style={{ minWidth: 520 }}>
          <thead><tr><th>Learning area</th><th>Score</th><th>Out of</th><th>Level</th><th>Remarks</th></tr></thead>
          <tbody>
            {subjects.map((s, i) => (
              <tr key={i}>
                <td>{s.subject}</td><td>{s.score ?? "–"}</td><td>{s.max_score}</td>
                <td>{s.band ? `${s.band} ${s.band_label || ""}` : "–"}</td><td>{s.remark}</td>
              </tr>
            ))}
            {!subjects.length && <tr><td colSpan={5} style={{ textAlign: "center", padding: 18 }}>No marks have been recorded for this exam yet.</td></tr>}
            <tr className="total"><td>Total / Mean</td><td>{total}</td><td /><td>{overall_band || ""}</td><td>Mean: {average ?? "–"}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="rc-box"><b>Class teacher's remarks</b>{class_teacher_remark}</div>
      <div className="rc-box"><b>Head teacher's remarks</b>{head_teacher_remark}</div>
      <div className="rc-sign">
        <div>Class teacher signature</div>
        <div>{school.head_signature_url && <img src={assetUrl(school.head_signature_url)} alt="Head teacher signature" />}
          Head teacher signature{school.head_teacher_name ? ` — ${school.head_teacher_name.toUpperCase()}` : ""}</div>
        <div>{school.stamp_url && <img src={assetUrl(school.stamp_url)} alt="School stamp" />}School stamp</div>
      </div>
      {school.next_term_begins && <div className="rc-next">Next term begins: {fmtDate(school.next_term_begins, { day: "numeric", month: "long", year: "numeric" })}</div>}
      <footer className="rc-foot">{school.footer && <div style={{ textTransform: "uppercase" }}>{school.footer}</div>}<div>Powered by SMARTMARK SOLUTIONS</div></footer>
    </article>
  );
}
