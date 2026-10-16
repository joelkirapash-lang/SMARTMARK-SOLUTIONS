import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Circle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/Toast";
import { api } from "../lib/api";
import { ROLE_LABEL, fmtDateTime } from "../lib/format";
import { Brand } from "../components/Shell";
import { ModePicker } from "../context/Mode";
import { Page, Card, Btn, Input, ErrorNote, Avatar, Badge } from "../components/ui";

const RULES = [
  ["At least 8 characters", (p) => p.length >= 8], ["An uppercase letter", (p) => /[A-Z]/.test(p)],
  ["A lowercase letter", (p) => /[a-z]/.test(p)], ["A number", (p) => /\d/.test(p)],
];

function PasswordForm({ forced }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = RULES.every(([, f]) => f(pw)) && pw === again && cur;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: cur, new_password: pw });
      await refresh();
      toast.success("Your password has been changed.");
      nav("/app");
      setCur(""); setPw(""); setAgain("");
    } catch (err) {
      setError(err.details ? `${err.message} ${err.details.join(" ")}` : err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <ErrorNote error={error} />
      <Input label={forced ? "Temporary password you were given" : "Current password"} type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} />
      <Input label="New password" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {RULES.map(([t, f]) => (
          <li key={t} className={f(pw) ? "text-emerald-700" : "text-slate-500"}>
            {f(pw) ? <Check size={13} className="inline mr-1" /> : <Circle size={13} className="inline mr-1" />}{t}
          </li>
        ))}
      </ul>
      <Input label="Confirm new password" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)}
        error={again && pw !== again ? "The two passwords do not match." : undefined} />
      <Btn type="submit" loading={busy} disabled={!ok}>Save new password</Btn>
    </form>
  );
}

export function ForcedPassword() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 bg-gradient-to-br from-side to-brand-800">
      <div className="w-full max-w-lg bg-surface rounded-3xl p-8 shadow-2xl">
        <Brand light={false} />
        <h1 className="font-display text-2xl font-semibold mt-6">Choose your own password</h1>
        <p className="text-slate-600 mt-1 mb-6">Hello {user.first_name}. For your security, please replace the temporary password you were given before you continue.</p>
        <PasswordForm forced />
        <button onClick={() => { logout(); nav("/login"); }} className="mt-6 text-sm text-slate-500 underline">Sign out</button>
      </div>
    </div>
  );
}

export function Account() {
  const { user, school, impersonating } = useAuth();
  return (
    <Page title="Account and password" subtitle="Your sign-in details and security.">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Profile">
          <div className="flex items-center gap-4">
            <Avatar name={user.full_name} size={56} />
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold">{user.full_name}</p>
              <Badge tone="brand">{ROLE_LABEL[user.role]}</Badge>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-slate-500">Sign-in email</dt><dd className="font-mono break-all">{user.smartmark_email}</dd>
            {school && <><dt className="text-slate-500">School</dt><dd>{school.name}</dd></>}
            {user.admission_number && <><dt className="text-slate-500">Admission no.</dt><dd>{user.admission_number}</dd></>}
            <dt className="text-slate-500">Last sign-in</dt><dd>{fmtDateTime(user.last_login_at)}</dd>
          </dl>
        </Card>
        <Card title="Change password">
          {impersonating ? <p className="text-sm text-slate-600">Passwords cannot be changed while viewing as another user.</p> : <PasswordForm />}
        </Card>
        <Card title="Appearance" className="lg:col-span-2"><ModePicker /></Card>
      </div>
    </Page>
  );
}
