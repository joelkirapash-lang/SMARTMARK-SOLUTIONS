import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LineChart, ShieldCheck, Smartphone, ScrollText } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Brand } from "../components/Shell";
import { Btn, Input, ErrorNote } from "../components/ui";
import { ModeToggle } from "../context/Mode";

export default function Login() {
  const { login, user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      nav("/app");
    } catch (err) {
      setError(err.code === "SCHOOL_SUSPENDED" ? `${err.message}${err.data?.reason ? " " + err.data.reason : ""}` : err.message);
    } finally {
      setBusy(false);
    }
  };

  const perks = [
    [ScrollText, "Report cards and marklists", "Ranked, printable, ready in seconds."],
    [LineChart, "Score movement", "See which classes and subjects are rising or slipping."],
    [ShieldCheck, "Every school stands alone", "Private data, role-based access."],
    [Smartphone, "Built for phones", "Enter marks from anywhere in the school."],
  ];
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden lg:flex flex-col justify-between p-12 text-white bg-gradient-to-br from-side via-side2 to-brand-700 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="absolute bottom-0 -left-20 size-80 rounded-full bg-brand-400/25 blur-3xl" />
        <Brand />
        <div className="relative max-w-lg">
          <h1 className="font-display text-5xl font-semibold leading-[1.05]">Marks that make sense, for every school.</h1>
          <p className="mt-4 text-lg text-white/75">Built for the Competency Based Curriculum, from Playgroup to Grade 10.</p>
          <ul className="mt-10 space-y-5">
            {perks.map(([Icon, t, d]) => (
              <li key={t} className="flex gap-4"><div className="size-10 rounded-xl bg-white/10 grid place-items-center shrink-0"><Icon size={20} /></div>
                <div><p className="font-semibold">{t}</p><p className="text-sm text-white/70">{d}</p></div></li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/50">© {new Date().getFullYear()} SMARTMARK SOLUTIONS</p>
      </aside>
      <main className="relative flex flex-col justify-center px-6 py-12 sm:px-12 bg-surface">
        <div className="absolute top-4 right-4"><ModeToggle /></div>
        <div className="lg:hidden mb-10"><Brand light={false} /></div>
        <form onSubmit={submit} className="w-full max-w-sm mx-auto space-y-5">
          <div>
            <h2 className="font-display text-3xl font-semibold">Welcome back</h2>
            <p className="text-slate-600 mt-1">Sign in with the account your school gave you.</p>
          </div>
          <ErrorNote error={error} />
          <Input label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="firstname.surname@teacher.yourschool.com" />
          <div className="relative">
            <Input label="Password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-[34px] text-slate-500" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <Btn type="submit" loading={busy} className="w-full py-3">Sign in</Btn>
          <p className="text-xs text-slate-500 text-center">Forgot your password? Ask your school administrator to reset it for you.</p>
        </form>
      </main>
    </div>
  );
}
