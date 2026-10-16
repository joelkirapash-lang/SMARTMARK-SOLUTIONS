import { Award } from "lucide-react";
import { cn, bandStyle, fmtDate } from "../lib/format";

export default function ReportCardView({ data, className = "" }) {
  if (!data) return null;
  const { school, student, exam, subjects, total, average, position, class_size, overall_band, overall_label } = data;
  return (
    <article className={cn("print-area bg-surface rounded-2xl shadow-soft ring-1 ring-slate-900/5 max-w-3xl mx-auto overflow-hidden", className)}>
      <div className="h-2 bg-gradient-to-r from-brand-500 via-accent-500 to-brand-700" />
      <div className="p-6 sm:p-10">
        <header className="flex items-start justify-between gap-4 pb-6 border-b-2 border-slate-900">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900">{school.name}</h2>
            {school.motto && <p className="italic text-slate-600">{school.motto}</p>}
            {school.address && <p className="text-sm text-slate-500 mt-1">{school.address}</p>}
          </div>
          {school.crest_url && <img src={school.crest_url} alt="" className="size-16 sm:size-20 object-contain" />}
        </header>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Learner progress report</p>
            <p className="font-display text-xl font-semibold">{student.name}</p>
            <p className="text-sm text-slate-600">
              {student.admission_number && <>Adm. {student.admission_number}</>}
              {student.grade && <> · {student.grade}{student.stream ? ` ${student.stream}` : ""}</>}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-slate-900">{exam.name}</p>
            <p className="text-slate-600">{[exam.term, exam.date && fmtDate(exam.date)].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto sms-scroll">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="text-left text-slate-600 border-b border-slate-300">
                <th className="py-2 pr-3 font-semibold">Learning area</th>
                <th className="py-2 px-3 font-semibold text-right">Score</th>
                <th className="py-2 px-3 font-semibold">Level</th>
                <th className="py-2 pl-3 font-semibold">Remark</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, i) => (
                <tr key={i} className="border-b border-slate-100 align-top">
                  <td className="py-2.5 pr-3 font-medium">{s.subject}</td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {s.score ?? "—"}<span className="text-slate-400"> / {s.max_score}</span>
                    {s.pct !== null && (
                      <div className="h-1.5 w-20 ml-auto mt-1 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${s.pct}%` }} /></div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">{s.band ? <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold ring-1", bandStyle(s.band))} title={s.band_label}>{s.band}</span> : "—"}</td>
                  <td className="py-2.5 pl-3 text-slate-600">{s.remark}</td>
                </tr>
              ))}
              {!subjects.length && <tr><td colSpan={4} className="py-8 text-center text-slate-500">No marks have been recorded for this exam yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[["Total", total], ["Average", average === null ? "—" : `${average}%`], ["Position", position ? `${position} of ${class_size}` : "—"],
            ["Overall level", overall_band ? `${overall_band}` : "—"]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-brand-50 px-4 py-3">
              <p className="text-xs text-brandtext">{k}</p>
              <p className="font-display text-lg font-semibold text-slate-900 flex items-center gap-1.5">
                {k === "Position" && position === 1 && <Award size={18} className="text-accent-500" />}{v}
              </p>
              {k === "Overall level" && overall_label && <p className="text-xs text-slate-600">{overall_label}</p>}
            </div>
          ))}
        </div>

        <div className="mt-14 grid grid-cols-2 gap-10 text-xs text-slate-600">
          <div className="border-t border-slate-400 pt-2">Class teacher's signature</div>
          <div className="border-t border-slate-400 pt-2">Principal's signature and stamp</div>
        </div>
        {school.footer && <p className="mt-8 text-center text-xs text-slate-500">{school.footer}</p>}
      </div>
    </article>
  );
}
