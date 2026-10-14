import { ShieldCheck, UserPlus, PenLine, FileText, School, Layers, Link2, Eye, Activity } from "lucide-react";
import { cn, dayLabel, fmtTime, timeAgo, ROLE_LABEL } from "../lib/format";
import { Empty } from "./ui";

const CAT = {
  security: { icon: ShieldCheck, bubble: "bg-slate-700 text-white", chip: "bg-slate-100 text-slate-700", name: "Security" },
  accounts: { icon: UserPlus, bubble: "bg-emerald-500 text-white", chip: "bg-emerald-100 text-emerald-800", name: "Accounts" },
  marks: { icon: PenLine, bubble: "bg-blue-500 text-white", chip: "bg-blue-100 text-blue-800", name: "Marks" },
  exams: { icon: FileText, bubble: "bg-amber-500 text-white", chip: "bg-amber-100 text-amber-800", name: "Exams" },
  school: { icon: School, bubble: "bg-violet-500 text-white", chip: "bg-violet-100 text-violet-800", name: "School" },
  academics: { icon: Layers, bubble: "bg-cyan-500 text-white", chip: "bg-cyan-100 text-cyan-800", name: "Academics" },
  reports: { icon: Link2, bubble: "bg-fuchsia-500 text-white", chip: "bg-fuchsia-100 text-fuchsia-800", name: "Reports" },
  platform: { icon: Eye, bubble: "bg-indigo-600 text-white", chip: "bg-indigo-100 text-indigo-800", name: "Platform" },
  other: { icon: Activity, bubble: "bg-slate-500 text-white", chip: "bg-slate-100 text-slate-700", name: "Other" },
};
export const ACTIVITY_CATEGORIES = Object.entries(CAT).filter(([k]) => k !== "other").map(([value, c]) => ({ value, label: c.name }));

export default function ActivityFeed({ items, empty = "Activity will appear here as work gets done." }) {
  if (!items?.length) return <Empty icon={Activity} title="Nothing here yet" hint={empty} />;
  const groups = [];
  items.forEach((it) => {
    const label = dayLabel(it.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  });
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="font-display font-semibold text-slate-800 mb-3 sticky top-0 bg-white/90 backdrop-blur py-1 z-[1]">{g.label}</h3>
          <ol className="relative space-y-4 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
            {g.items.map((it) => {
              const c = CAT[it.category] || CAT.other;
              const Icon = c.icon;
              return (
                <li key={it.id} className="relative flex gap-3">
                  <div className={cn("relative size-9 rounded-full grid place-items-center shrink-0 ring-4 ring-white", c.bubble)}><Icon size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm text-slate-900"><span className="font-semibold">{it.actor_name}</span> <span className="text-slate-600">{it.label.toLowerCase()}</span></p>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", c.chip)}>{c.name}</span>
                      {it.school_name && <span className="rounded-md px-1.5 py-0.5 text-xs font-semibold bg-slate-900 text-white">{it.school_name}</span>}
                    </div>
                    {it.detail && <p className="text-sm text-slate-600 break-words">{it.detail}</p>}
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className={cn("rounded px-1.5 py-0.5 font-semibold mr-1.5", c.chip)}>{fmtTime(it.created_at)}</span>
                      {timeAgo(it.created_at)}{it.actor_role && ` · ${ROLE_LABEL[it.actor_role]}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
