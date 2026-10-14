import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area } from "recharts";
import { PALETTE } from "../lib/format";

const axis = { fontSize: 12, fill: "#64748b" };
const tip = { borderRadius: 12, border: "none", boxShadow: "0 10px 30px -10px rgba(15,23,42,.3)", fontSize: 13 };

export function TrendChart({ exams, series, overall, height = 300 }) {
  const data = exams.map((e, i) => {
    const row = { exam: e.name };
    series.forEach((s) => (row[s.subject] = s.points[i]));
    if (overall) row["All subjects"] = overall.points[i];
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="exam" tick={axis} tickLine={false} />
        <YAxis domain={[0, 100]} tick={axis} tickLine={false} unit="%" />
        <Tooltip contentStyle={tip} formatter={(v) => (v === null ? "—" : `${v}%`)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line key={s.subject_id} type="monotone" dataKey={s.subject} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5}
            dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
        ))}
        {overall && <Line type="monotone" dataKey="All subjects" stroke="#0f172a" strokeWidth={3} strokeDasharray="6 4" dot={{ r: 4 }} connectNulls />}
      </LineChart>
    </ResponsiveContainer>
  );
}

const BAND_COLORS = { EE: "#10b981", ME: "#0ea5e9", AE: "#f59e0b", BE: "#f43f5e", Unranked: "#94a3b8" };
export function BandDonut({ data, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="band" innerRadius="55%" outerRadius="85%" paddingAngle={3} stroke="none">
          {data.map((d, i) => <Cell key={d.band} fill={BAND_COLORS[d.band] || PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function Bars({ data, nameKey, dataKey, height = 260, unit = "", colorful = true }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey={nameKey} tick={axis} tickLine={false} interval={0} />
        <YAxis tick={axis} tickLine={false} unit={unit} />
        <Tooltip contentStyle={tip} cursor={{ fill: "rgba(100,116,139,.08)" }} />
        <Bar dataKey={dataKey} radius={[8, 8, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={colorful ? PALETTE[i % PALETTE.length] : "rgb(var(--b500))"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProgressArea({ data, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="me" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--b500))" stopOpacity={0.45} />
            <stop offset="100%" stopColor="rgb(var(--b500))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={axis} tickLine={false} />
        <YAxis domain={[0, 100]} tick={axis} tickLine={false} unit="%" />
        <Tooltip contentStyle={tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="You" stroke="rgb(var(--b600))" strokeWidth={3} fill="url(#me)" dot={{ r: 4 }} />
        <Area type="monotone" dataKey="Class average" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" fill="none" dot={{ r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
