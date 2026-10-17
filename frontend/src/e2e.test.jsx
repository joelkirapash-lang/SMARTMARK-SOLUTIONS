/**
 * Full-stack smoke test. Needs a running backend (see README "Run the tests").
 * Renders every screen for every role against REAL data and drives the key flows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/Toast";
import { ModeProvider } from "./context/Mode";
import { tokens } from "./lib/api";

const API = import.meta.env.VITE_API_BASE_URL;
async function call(method, path, body, token) {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
const login = async (email, password) => (await call("POST", "/auth/login", { email, password })).access_token;
const W = {};
const consoleErrors = [];
const IGNORE = /not wrapped in act|width\(0\)|ResizeObserver|Not implemented/i;

beforeAll(async () => {
  vi.spyOn(console, "error").mockImplementation((...a) => { const m = a.map(String).join(" "); if (!IGNORE.test(m)) consoleErrors.push(m.slice(0, 300)); });
  W.super = await login("dev@smartmarksolutions.com", "SuperPass1");
  const sc = await call("POST", "/super/schools", { school_name: "Anestar Secondary", admin_first_name: "Jane", admin_second_name: "Mwangi", max_students: 50, max_staff: 10, plan_name: "Standard", payment_status: "INSTALLMENTS", next_payment_due: "2026-12-01" }, W.super);
  W.school = sc.school;
  W.adminCred = sc.credentials;
  const first = await login(sc.credentials.email, sc.credentials.password);
  await call("POST", "/auth/change-password", { current_password: sc.credentials.password, new_password: "AdminPass1" }, first);
  W.admin = await login(sc.credentials.email, "AdminPass1");
  W.g4 = await call("POST", "/grades", { name: "Grade 4", order_index: 4 }, W.admin);
  W.g5 = await call("POST", "/grades", { name: "Grade 5", order_index: 5 }, W.admin);
  W.stream = await call("POST", "/streams", { name: "A", grade_id: W.g4.id }, W.admin);
  W.math = await call("POST", "/subjects", { name: "Mathematics", code: "MATH" }, W.admin);
  W.eng = await call("POST", "/subjects", { name: "English", code: "ENG" }, W.admin);
  await call("POST", "/academics/cbc-bands", {}, W.admin);
  await call("POST", "/remarks", { text: "Excellent work, keep it up", subject_id: W.math.id }, W.admin);
  const mk = async (role, first, second, extra = {}) => (await call("POST", "/accounts", { role, first_name: first, second_name: second, must_change_password: false, ...extra }, W.admin));
  const t = await mk("TEACHER", "Tom", "Ouma"); W.teacherCred = t.credentials; W.teacherId = t.user.id;
  const e = await mk("EDUCATOR", "Eve", "Wanjiru"); W.educatorCred = e.credentials;
  const sa = await mk("STUDENT", "Amina", "Hassan", { admission_number: "1001", grade_id: W.g4.id, stream_id: W.stream.id }); W.stuA = sa;
  const sb = await mk("STUDENT", "Brian", "Otieno", { admission_number: "1002", grade_id: W.g4.id, stream_id: W.stream.id }); W.stuB = sb;
  W.teacher = await login(W.teacherCred.email, W.teacherCred.password);
  W.educator = await login(W.educatorCred.email, W.educatorCred.password);
  W.student = await login(sa.credentials.email, sa.credentials.password);
  await call("PUT", `/staff/${W.teacherId}/assignments`, { assignments: [{ grade_id: W.g4.id, stream_id: W.stream.id, subject_id: W.math.id }] }, W.admin);
  W.e1 = await call("POST", "/exams", { name: "Opener", exam_date: "2026-02-01", marks_deadline: "2026-02-20" }, W.admin);
  W.e2 = await call("POST", "/exams", { name: "Midterm", exam_date: "2026-05-01", marks_deadline: "2026-05-10" }, W.admin);
  for (const [ex, a, b] of [[W.e1, 60, 80], [W.e2, 85, 70]]) {
    await call("POST", "/marks/grid", { exam_id: ex.id, grade_id: W.g4.id, subject_id: W.math.id, rows: [{ student_id: W.stuA.user.id, score: a, remark: "Good" }, { student_id: W.stuB.user.id, score: b }] }, W.admin);
  }
  await call("POST", `/exams/${W.e1.id}/publish`, {}, W.admin);
});
afterAll(() => { if (consoleErrors.length) console.log("CONSOLE ERRORS:\n" + [...new Set(consoleErrors)].join("\n---\n")); });

function mount(path, token) {
  cleanup(); localStorage.clear();
  if (token) tokens.set(token);
  return render(<MemoryRouter initialEntries={[path]}><ModeProvider><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></ModeProvider></MemoryRouter>);
}
const heading = (re, level = 1) => screen.findByRole("heading", { level, name: re }, { timeout: 15000 });

describe("super admin", () => {
  it.each([
    ["/app", /Platform overview/], ["/app/schools", /^Schools$/], ["/app/view-as", /Visit any role/], ["/app/activity", /Platform activity/], ["/app/account", /Account and password/],
  ])("renders %s", async (path, re) => { mount(path, W.super); await heading(re); });

  it("lists the school with its plan and usage", async () => {
    mount("/app/schools", W.super);
    expect(await screen.findByText("Anestar Secondary", {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText(/On installments/)).toBeTruthy();
    expect(screen.getAllByText(/\/ 50/).length).toBeGreaterThan(0);
  });

  it("can visit a teacher in read-only view and return", async () => {
    mount("/app/view-as", W.super);
    await screen.findByText(/Visit any role/, {}, { timeout: 15000 });
    fireEvent.click(await screen.findByRole("button", { name: /^Teachers/ }));
    await screen.findByText("Tom Ouma", {}, { timeout: 15000 });
    fireEvent.click(await screen.findByRole("button", { name: /Enter/ }));
    expect(await screen.findByText(/read-only/, {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Back to Super Admin/ })).toBeTruthy();
    await screen.findByText("Marks to enter", {}, { timeout: 15000 });
    fireEvent.click(screen.getByRole("button", { name: /Back to Super Admin/ }));
    await heading(/Visit any role/);
  });
});

describe("school admin", () => {
  it.each([
    ["/app/accounts", /^Accounts$/], ["/app/academics", /^Academics$/], ["/app/access", /Teacher access/], ["/app/exams", /^Exams$/],
    ["/app/marks", /Marks entry/], ["/app/marklist", /Marklists/], ["/app/trends", /Performance trends/], ["/app/report-cards", /Report cards/],
    ["/app/promote", /Promote learners/], ["/app/remarks", /Remarks bank/], ["/app/settings", /School settings/], ["/app/activity", /^Activity$/],
  ])("renders %s", async (path, re) => { mount(path, W.admin); await heading(re); });

  it("dashboard shows counts, plan usage and charts area", async () => {
    mount("/app", W.admin);
    expect(await screen.findByText(/Good (morning|afternoon|evening), Jane/, {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText(/Your plan/)).toBeTruthy();
    expect(await screen.findByText(/Results for Midterm/)).toBeTruthy();
  });

  it("creates a learner and shows the generated sign-in email immediately", async () => {
    mount("/app/accounts", W.admin);
    await screen.findByText("Amina Hassan", {}, { timeout: 15000 });
    fireEvent.click(screen.getByRole("button", { name: /Add learner/ }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByLabelText(/UPI number/)).toBeTruthy();
    expect(within(dlg).getByLabelText(/Assessment number/)).toBeTruthy();
    fireEvent.change(within(dlg).getByLabelText(/First name/), { target: { value: "Zawadi" } });
    fireEvent.change(within(dlg).getByLabelText(/Second name/), { target: { value: "Njeri" } });
    fireEvent.change(within(dlg).getByLabelText(/Admission number/), { target: { value: "2001" } });
    fireEvent.change(within(dlg).getByLabelText(/^Grade/), { target: { value: W.g4.id } });
    fireEvent.click(within(dlg).getByRole("button", { name: /Create account/ }));
    expect(await screen.findByText(/Account ready/, {}, { timeout: 15000 })).toBeTruthy();
    expect((await screen.findAllByText("zawadi.njeri@student.anestar-secondary.com")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Password$/).length).toBeGreaterThan(0);
    const learners = await call("GET", "/accounts?role=STUDENT", null, W.admin);
    expect(learners.some((l) => l.first_name === "Zawadi")).toBe(true);
  });

  it("marks entry autosaves typed scores", async () => {
    const q = `exam=${W.e2.id}&grade=${W.g4.id}&stream=${W.stream.id}&subject=${W.eng.id}`;
    mount(`/app/marks?${q}`, W.admin);
    const box = await screen.findByLabelText("Score for Amina Hassan", {}, { timeout: 15000 });
    fireEvent.change(box, { target: { value: "77" } });
    await screen.findByText(/Saved at/, {}, { timeout: 15000 });
    const grid = await call("GET", `/marks/grid?exam_id=${W.e2.id}&grade_id=${W.g4.id}&stream_id=${W.stream.id}&subject_id=${W.eng.id}`, null, W.admin);
    expect(grid.rows.find((r) => r.student_name.startsWith("Amina")).score).toBe(77);
  });

  it("marklist ranks learners and trends page shows movement", async () => {
    mount(`/app/marklist`, W.admin);
    await heading(/Marklists/);
    const sel = await screen.findAllByRole("combobox");
    await within(sel[0]).findByText("Grade 4");
    await within(sel[2]).findByText("Midterm");
    fireEvent.change(sel[0], { target: { value: W.g4.id } });
    fireEvent.change(sel[2], { target: { value: W.e2.id } });
    expect(await screen.findByText("AMINA HASSAN", {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getAllByText("EE2").length).toBeGreaterThan(0);
    mount("/app/trends", W.admin);
    expect(await screen.findByText(/Class by subject/, {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findAllByText(/Mathematics/)).toBeTruthy();
  });

  it("report card shows learner, position and level", async () => {
    mount(`/app/report-cards?student=${W.stuA.user.id}&exam=${W.e2.id}`, W.admin);
    expect(await screen.findByText(/Learner report card/i, {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText("AMINA HASSAN")).toBeTruthy();
    expect(await screen.findByText(/1 out of 2/)).toBeTruthy();
  });
});

describe("teacher and educator", () => {
  it.each([["/app/marks", /Marks entry/], ["/app/marklist", /Marklists/], ["/app/trends", /Performance trends/], ["/app/students", /^Learners$/], ["/app/activity", /My activity/], ["/app/report-cards", /Report cards/]])(
    "teacher renders %s", async (path, re) => { mount(path, W.teacher); await heading(re); });

  it("teacher dashboard lists marks still to enter", async () => {
    mount("/app", W.teacher);
    expect(await screen.findByText("Marks to enter", {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText(/Class and subject pairs/)).toBeTruthy();
  });

  it("teacher cannot open admin pages", async () => {
    mount("/app/accounts", W.teacher);
    expect(await screen.findByText("Marks to enter", {}, { timeout: 15000 })).toBeTruthy(); // bounced to dashboard
  });

  it("teacher marks page only offers assigned classes", async () => {
    mount("/app/marks", W.teacher);
    const sel = await screen.findByLabelText(/Your class and subject/, {}, { timeout: 15000 });
    expect(await within(sel).findByText(/Mathematics · Grade 4 A/)).toBeTruthy();
    expect(within(sel).queryByText(/English/)).toBeNull();
  });

  it("educator without classes sees the empty state", async () => {
    mount("/app", W.educator);
    expect(await screen.findByText(/No classes assigned yet/, {}, { timeout: 15000 })).toBeTruthy();
  });
});

describe("student", () => {
  it("sees progress, only published results, and can open the report card", async () => {
    mount("/app", W.student);
    expect(await screen.findByText(/My progress/, {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText(/Latest average/)).toBeTruthy();
    mount("/app/report-cards", W.student);
    await heading(/My report cards/);
    const sel = await screen.findByLabelText("Exam", {}, { timeout: 15000 });
    expect(await within(sel).findByText("Opener")).toBeTruthy();
    expect(within(sel).queryByText("Midterm")).toBeNull(); // unpublished stays hidden
  });
  it("cannot reach staff pages", async () => {
    mount("/app/marks", W.student);
    expect(await screen.findByText(/Latest average/, {}, { timeout: 15000 })).toBeTruthy();
  });
});

describe("layout, uploads, admins and live updates", () => {
  it("report card has the school layout and automatic teacher comments", async () => {
    mount(`/app/report-cards?student=${W.stuA.user.id}&exam=${W.e2.id}`, W.admin);
    expect(await screen.findByText(/Learner report card/i, {}, { timeout: 15000 })).toBeTruthy();
    for (const t of [/Class teacher's remarks/, /Head teacher's remarks/, /Total \/ Mean/, /School stamp/, /Powered by SMARTMARK SOLUTIONS/]) expect(await screen.findByText(t)).toBeTruthy();
    expect(await screen.findByText(/An outstanding result by AMINA at 81%/)).toBeTruthy();
    expect(await screen.findByText(/Very good work\. Aim even higher\./)).toBeTruthy();
    expect(await screen.findByText("Good")).toBeTruthy();
  });
  it("marklist shows subject means and the class summary", async () => {
    mount(`/app/marklist?exam=${W.e2.id}&grade=${W.g4.id}&stream=${W.stream.id}`, W.admin);
    expect(await screen.findByText("Subject mean", {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText("Class summary")).toBeTruthy();
    expect(await screen.findByText(/Powered by SMARTMARK SOLUTIONS/)).toBeTruthy();
  });
  it("settings offers uploads for crest, signature and stamp", async () => {
    mount("/app/settings", W.admin); await heading(/School settings/);
    for (const l of ["School crest or logo file", "Head teacher's signature file", "School stamp file"]) expect(await screen.findByLabelText(l, {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByLabelText(/Head teacher's name/)).toBeTruthy();
  });
  it("super dashboard lists the schools created with their admin counts", async () => {
    mount("/app", W.super);
    expect(await screen.findByText(/Schools created \(/, {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText("School admin accounts")).toBeTruthy();
  });
  it("super admin can add another admin to a school", async () => {
    mount("/app/schools", W.super);
    fireEvent.click(await screen.findByRole("button", { name: /Manage/ }, { timeout: 15000 }));
    expect(await screen.findByText(/exactly the same things/)).toBeTruthy();
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText(/^First name/), { target: { value: "Peter" } });
    fireEvent.change(within(dlg).getByLabelText(/^Second name/), { target: { value: "Kiprop" } });
    fireEvent.click(within(dlg).getByRole("button", { name: /Add admin/ }));
    expect((await screen.findAllByText("peter.kiprop@admin.anestar-secondary.com", {}, { timeout: 15000 })).length).toBeGreaterThan(0);
    const admins = await call("GET", `/super/schools/${W.school.id}/users?role=SCHOOL_ADMIN`, null, W.super);
    expect(admins.length).toBe(2);
  });
  it("screens update by themselves when something changes elsewhere", async () => {
    mount("/app/exams", W.admin);
    expect(await screen.findByText("Opener", {}, { timeout: 15000 })).toBeTruthy();
    await call("POST", "/exams", { name: "Added Elsewhere" }, W.admin);
    window.dispatchEvent(new Event("focus"));
    expect(await screen.findByText("Added Elsewhere", {}, { timeout: 15000 })).toBeTruthy();
  });
});

describe("import and appearance", () => {
  it("import marks page opens for admin and for a teacher with only their own grades", async () => {
    mount("/app/import", W.admin); await heading(/Import marks/);
    expect(await screen.findByRole("button", { name: /Download the template/ })).toBeTruthy();
    mount("/app/import", W.teacher); await heading(/Import marks/);
    const grade = (await screen.findAllByRole("combobox"))[1];
    expect(await within(grade).findByText("Grade 4")).toBeTruthy();
    expect(within(grade).queryByText("Grade 5")).toBeNull();
  });
  it("marklist and report-card links pre-fill the class", async () => {
    mount(`/app/marklist?exam=${W.e2.id}&grade=${W.g4.id}&stream=${W.stream.id}`, W.admin);
    expect(await screen.findByText("AMINA HASSAN", {}, { timeout: 15000 })).toBeTruthy();
    mount(`/app/report-cards?exam=${W.e2.id}&grade=${W.g4.id}&stream=${W.stream.id}`, W.admin);
    expect(await screen.findByRole("button", { name: /Print the whole class/ }, { timeout: 15000 })).toBeTruthy();
  });
  it("dark mode can be switched, is remembered, and flips the page", async () => {
    mount("/app/account", W.admin); await heading(/Account and password/);
    fireEvent.click(await screen.findByRole("button", { name: /^Dark$/ }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("sms_mode")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: /Switch to light mode/ }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("sms_mode")).toBe("light");
  });
});

describe("account safety", () => {
  it("forces a new password on first sign in", async () => {
    const c = (await call("POST", "/accounts", { role: "TEACHER", first_name: "Newbie", second_name: "Teacher" }, W.admin)).credentials;
    mount("/app", await login(c.email, c.password));
    expect(await screen.findByText(/Choose your own password/, {}, { timeout: 15000 })).toBeTruthy();
  });

  it("a paused school sees the paused screen and resumes cleanly", async () => {
    await call("POST", `/super/schools/${W.school.id}/suspend`, { reason: "Instalment overdue, please call us." }, W.super);
    mount("/app", W.admin);
    expect(await screen.findByText(/Access is paused/, {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText(/Instalment overdue/)).toBeTruthy();
    await call("POST", `/super/schools/${W.school.id}/resume`, {}, W.super);
    mount("/app", W.admin);
    expect(await screen.findByText(/Your plan/, {}, { timeout: 15000 })).toBeTruthy();
  });

  it("no unexpected console errors were logged while rendering", () => {
    expect(consoleErrors).toEqual([]);
  });
});
