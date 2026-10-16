import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Users, UserCheck, Layers, CheckCircle2, Circle, AlertTriangle, TrendingUp, TrendingDown, PenLine, ClipboardList, Trophy, BookOpen, FileText, Award } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { cn, fmtDate, daysLeftLabel, pct, ROLE_LABEL } from "../lib/format";
import { Page, Card, Stat, Btn, Badge, Spinner, Empty, Progress, Select } from "../components/ui";
import { Bars, BandDonut, ProgressArea } from "../components/charts";
import ActivityFeed from "../components/ActivityFeed";

function Hero({ title, sub, children }) {
  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const { user } = useAuth();
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-side via-brand-700 to-brand-500 text-white p-6 sm:p-8">
      <div className="absolute -right-10 -top-10 size-56 rounded-full bg-accent-400/30 blur-2xl" />
      <div className="absolute right-24 bottom-[-60px] size-48 rounded-full bg-white/10 blur-xl" />
      <div className="relative">
        <p className="text-white/75 text-sm">{fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">{title || `${greet}, ${user.first_name}`}</h1>
        {sub && <p className="text-white/80 mt-1 max-w-xl">{sub}</p>}
        {children && <div className="mt-5 flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}

const hrefMarks = (i) => `/app/marks?exam=${i.exam_id}&grade=${i.grade_id}&stream=${i.stream_id || ""}&subject=${i.subject_id}`;

function PendingList({ items, empty }) {
  if (!items.length) return <Empty icon={CheckCircle2} title="Nothing waiting" hint={empty} />;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((i, k) => (
        <li key={k}>
          <Link to={hrefMarks(i)} className="flex items-center gap-4 py-3 hover:bg-brand-50/60 -mx-2 px-2 rounded-xl">
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{i.subject} · {i.grade}{i.stream ? ` ${i.stream}` : ""}</p>
              <p className="text-xs text-slate-500 truncate">{i.exam}{i.teacher ? ` · ${i.teacher}` : ""}</p>
              <div className="mt-1.5"><Progress value={i.filled} max={i.expected} tone={i.overdue ? "red" : "brand"} /></div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold">{i.filled}/{i.expected}</p>
              <p className={cn("text-xs font-semibold", i.overdue ? "text-rose-600" : "text-slate-500")}>{daysLeftLabel(i.days_left)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AdminDashboard() {
  const { school } = useAuth();
  const [d, setD] = useState(null);
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    api.get("/exams").then(setExams);
    api.get("/subjects").then(setSubjects);
    api.get("/accounts/usage").then(setUsage);
  }, []);
  useEffect(() => { api.get(`/dashboard/summary${examId ? `?exam_id=${examId}` : ""}`).then(setD); }, [examId]);
  if (!d) return <Spinner />;

  const c = d.counts;
  const steps = [
    ["Add your grades and streams", c.grades > 0, "/app/academics"], ["Add subjects", subjects.length > 0, "/app/academics"],
    ["Create teacher and learner accounts", c.students + c.teachers + c.educators > 0, "/app/accounts"],
    ["Give teachers their classes", false, "/app/access"], ["Create an exam", exams.length > 0, "/app/exams"],
  ];
  const fresh = c.grades === 0 || exams.length === 0 || c.students === 0;
  return (
    <div className="space-y-6">
      <Hero sub={school?.name}>
        <Link to="/app/accounts"><Btn variant="accent">Create accounts</Btn></Link>
        <Link to="/app/marklist"><Btn variant="outline" className="!bg-white/15 !text-white !ring-white/30 hover:!bg-white/25">Marklists</Btn></Link>
      </Hero>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Learners" value={c.students} icon={GraduationCap} tone="blue" />
        <Stat label="Teachers" value={c.teachers} icon={Users} tone="emerald" />
        <Stat label="Educators" value={c.educators} icon={UserCheck} tone="amber" />
        <Stat label="Grades" value={c.grades} icon={Layers} tone="violet" />
      </div>

      {fresh && (
        <Card title="Getting started">
          <ol className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {steps.map(([t, done, to], i) => (
              <li key={t}><Link to={to} className={cn("flex items-start gap-2.5 rounded-xl p-3 ring-1 h-full transition-colors", done ? "ring-emerald-200 bg-emerald-50" : "ring-slate-200 hover:bg-brand-50")}>
                {done ? <CheckCircle2 className="text-emerald-600 shrink-0" size={20} /> : <Circle className="text-slate-300 shrink-0" size={20} />}
                <span className="text-sm font-medium">{t}</span></Link></li>
            ))}
          </ol>
        </Card>
      )}

      {usage && (usage.students.max !== null || usage.staff.max !== null) && (
        <Card title="Your plan">
          <div className="grid sm:grid-cols-2 gap-6">
            {[["Learners", usage.students], ["Teachers and educators", usage.staff]].map(([k, u]) => (
              <div key={k}><div className="flex justify-between text-sm mb-1.5"><span>{k}</span><span className="font-semibold">{u.used} of {u.max ?? "unlimited"}</span></div>
                <Progress value={u.used} max={u.max || u.used || 1} tone={u.max !== null && u.used >= u.max ? "red" : u.max !== null && u.used / u.max > 0.85 ? "amber" : "brand"} /></div>
            ))}
          </div>
          {school?.payment_status !== "PAID" && school?.next_payment_due && <p className="mt-4 text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-2">Next payment is due on {fmtDate(school.next_payment_due)}.</p>}
        </Card>
      )}

      {d.exam ? (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display text-xl font-semibold">Results for {d.exam.name}</h2>
            <div className="w-56"><Select value={examId || d.exam.id} onChange={(e) => setExamId(e.target.value)} aria-label="Exam">
              {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></div>
          </div>
          <div className="grid xl:grid-cols-3 gap-6">
            <Card title="Average score by subject" className="xl:col-span-2"><Bars data={d.subject_averages} nameKey="subject" dataKey="average" unit="%" /></Card>
            <Card title="Learners by performance level"><BandDonut data={d.distribution} /></Card>
          </div>
        </>
      ) : <Card><Empty icon={ClipboardList} title="No results yet" hint="Charts appear here as soon as teachers save marks for an exam." /></Card>}

      <div className="grid xl:grid-cols-2 gap-6">
        <Card title={`Marks overdue${d.overdue_total ? ` (${d.overdue_total})` : ""}`}><PendingList items={d.overdue} empty="Every class has its marks in on time." /></Card>
        {d.most_improved?.length > 0 && (
          <Card title={`Most improved since ${d.prior_exam}`}>
            <ul className="divide-y divide-slate-100">
              {d.most_improved.map((m, i) => (
                <li key={i} className="py-2.5 flex items-center justify-between gap-3"><span className="flex items-center gap-2 min-w-0"><span className="size-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold grid place-items-center">{i + 1}</span><span className="truncate">{m.student}</span></span>
                  <Badge tone={m.change >= 0 ? "green" : "red"}>{m.change >= 0 ? "+" : ""}{m.change} pts</Badge></li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card title="Recent activity" action={<Link to="/app/activity" className="text-sm font-semibold text-brandtext">See all</Link>}><ActivityFeed items={d.activity} /></Card>
    </div>
  );
}

export function StaffDashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [ov, setOv] = useState([]);
  useEffect(() => { api.get("/dashboard/summary").then(setD); api.get("/analytics/overview?mine=1").then(setOv); }, []);
  if (!d) return <Spinner />;
  const declined = ov.filter((r) => r.status === "declined").slice(0, 4);
  const improved = [...ov].filter((r) => r.status === "improved").sort((a, b) => b.change - a.change).slice(0, 4);
  return (
    <div className="space-y-6">
      <Hero sub={`${ROLE_LABEL[user.role]} · ${d.assignments} class${d.assignments === 1 ? "" : "es"} assigned to you`}>
        <Link to="/app/marks"><Btn variant="accent" icon={PenLine}>Enter marks</Btn></Link>
        <Link to="/app/trends"><Btn variant="outline" className="!bg-white/15 !text-white !ring-white/30 hover:!bg-white/25" icon={TrendingUp}>See trends</Btn></Link>
      </Hero>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="Class and subject pairs" value={d.assignments} icon={BookOpen} tone="emerald" />
        <Stat label="Classes" value={d.classes} icon={Users} tone="blue" />
        <Stat label="Marks still to enter" value={d.pending_total} icon={ClipboardList} tone="amber" />
        <Stat label="Overdue" value={d.overdue} icon={AlertTriangle} tone={d.overdue ? "rose" : "cyan"} />
      </div>
      {d.assignments === 0 && <Card><Empty icon={BookOpen} title="No classes assigned yet" hint="Your school administrator decides which grades, streams and subjects you can enter marks for." /></Card>}
      <div className="grid xl:grid-cols-2 gap-6">
        <Card title="Marks to enter"><PendingList items={d.pending} empty="You have entered everything that is open." /></Card>
        <Card title="How your classes are moving" action={<Link to="/app/trends?mine=1" className="text-sm font-semibold text-brandtext">Details</Link>}>
          {ov.length === 0 ? <Empty icon={TrendingUp} title="No comparisons yet" hint="Once two exams have marks, you'll see which classes improved or slipped." /> : (
            <div className="space-y-4">
              {[["Needs attention", declined, TrendingDown, "text-rose-600"], ["Improving", improved, TrendingUp, "text-emerald-600"]].map(([t, rows, Icon, col]) => rows.length > 0 && (
                <div key={t}><p className={cn("text-sm font-semibold flex items-center gap-1.5 mb-2", col)}><Icon size={16} />{t}</p>
                  <ul className="space-y-1.5">{rows.map((r, i) => <li key={i} className="flex justify-between text-sm"><span>{r.subject} · {r.grade}{r.stream ? ` ${r.stream}` : ""}</span><span className={cn("font-semibold", col)}>{r.change > 0 ? "+" : ""}{r.change} pts</span></li>)}</ul></div>
              ))}
              {!declined.length && !improved.length && <p className="text-sm text-slate-600">Everything is steady since the last exam.</p>}
            </div>
          )}
        </Card>
      </div>
      <Card title="Your recent activity"><ActivityFeed items={d.activity} /></Card>
    </div>
  );
}

export function StudentHome() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/me/progress").then(setD); }, []);
  if (!d) return <Spinner />;
  const ex = d.exams;
  const latest = ex[ex.length - 1];
  const chart = ex.map((e) => ({ name: e.name, You: e.average, "Class average": e.class_average }));
  const best = latest ? [...latest.subjects].sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1))[0] : null;
  return (
    <div className="space-y-6">
      <Hero sub="Your marks and how you are growing.">
        <Link to="/app/report-cards"><Btn variant="accent" icon={FileText}>My report cards</Btn></Link>
      </Hero>
      {!latest ? <Card><Empty icon={Award} title="Your results will appear here" hint="When your school publishes an exam, your marks and progress show up on this page." /></Card> : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Stat label="Latest average" value={pct(latest.average)} icon={Trophy} tone="amber" hint={latest.name} />
            <Stat label="Class average" value={pct(latest.class_average)} icon={Users} tone="blue" />
            <Stat label="Strongest subject" value={best?.name || "—"} icon={Award} tone="emerald" hint={best ? pct(best.pct) : ""} />
            <Stat label="Exams taken" value={ex.length} icon={FileText} tone="violet" />
          </div>
          <div className="grid xl:grid-cols-5 gap-6">
            <Card title="My progress" className="xl:col-span-3"><ProgressArea data={chart} /></Card>
            <Card title={`Subjects in ${latest.name}`} className="xl:col-span-2">
              <ul className="space-y-3">
                {latest.subjects.map((s) => (
                  <li key={s.name}><div className="flex justify-between text-sm mb-1"><span className="font-medium">{s.name}</span><span className="font-semibold">{s.score}/{s.max_score}</span></div>
                    <Progress value={s.pct || 0} max={100} tone={s.pct >= 80 ? "green" : s.pct >= 50 ? "brand" : "amber"} /></li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
