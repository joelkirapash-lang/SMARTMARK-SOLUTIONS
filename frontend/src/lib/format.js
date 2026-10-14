export const cn = (...a) => a.filter(Boolean).join(" ");

/** Date-only strings (YYYY-MM-DD) are built as local dates so they never shift a day;
 *  full timestamps from the server carry an explicit "Z" and convert to the viewer's timezone. */
export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
}
export const fmtDate = (v, o = { day: "numeric", month: "short", year: "numeric" }) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString(undefined, o) : "—";
};
export const fmtTime = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
};
export const fmtDateTime = (v) => (v ? `${fmtDate(v)}, ${fmtTime(v)}` : "Never");
export const tzName = () => {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
};
export function timeAgo(v) {
  const d = toDate(v);
  if (!d) return "";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return fmtDate(d);
}
export function dayLabel(v) {
  const d = toDate(v);
  const today = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (same(d, today)) return "Today";
  if (same(d, y)) return "Yesterday";
  return fmtDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
export const daysLeftLabel = (n) =>
  n === null || n === undefined ? "No deadline" : n < 0 ? `${-n} day${n === -1 ? "" : "s"} overdue` : n === 0 ? "Due today" : `Due in ${n} day${n === 1 ? "" : "s"}`;

export const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
export const pct = (n) => (n === null || n === undefined ? "—" : `${n}%`);

export const ROLE_LABEL = { SUPER_ADMIN: "Super Admin", SCHOOL_ADMIN: "School Admin", TEACHER: "Teacher", EDUCATOR: "Educator", STUDENT: "Student" };
export const themeFor = (role) =>
  ({ SUPER_ADMIN: "super", SCHOOL_ADMIN: "admin", TEACHER: "teacher", EDUCATOR: "educator", STUDENT: "student" }[role] || "login");

export const BAND_STYLE = {
  EE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  ME: "bg-sky-100 text-sky-800 ring-sky-200",
  AE: "bg-amber-100 text-amber-800 ring-amber-200",
  BE: "bg-rose-100 text-rose-800 ring-rose-200",
};
export const bandStyle = (c) => BAND_STYLE[c] || "bg-violet-100 text-violet-800 ring-violet-200";
export const PALETTE = ["#0d9488", "#7c3aed", "#f97316", "#2563eb", "#e11d48", "#65a30d", "#0891b2", "#c026d3", "#ca8a04", "#4f46e5"];

export function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob(["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
