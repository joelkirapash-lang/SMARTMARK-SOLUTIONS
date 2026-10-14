import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Copy, Download, Printer, KeyRound } from "lucide-react";
import { Modal, Btn } from "./ui";
import { useToast } from "../context/Toast";
import { useAuth } from "../context/AuthContext";
import { downloadCsv, ROLE_LABEL } from "../lib/format";

/** Shows freshly generated sign-in details ONCE. Passwords are never stored in readable form. */
export default function CredentialsModal({ creds, title = "Sign-in details", onClose }) {
  const list = Array.isArray(creds) ? creds : [creds];
  const toast = useToast();
  const { school } = useAuth();
  const origin = window.location.origin;

  useEffect(() => {
    document.body.classList.add("printing-slips");
    return () => document.body.classList.remove("printing-slips");
  }, []);

  const text = list.map((c) => `${c.name} (${ROLE_LABEL[c.role] || c.role})\nEmail: ${c.email}\nPassword: ${c.password}`).join("\n\n");
  const copy = async () => { await navigator.clipboard.writeText(text); toast.success("Sign-in details copied."); };
  const csv = () => downloadCsv("sign-in-details.csv", [["Name", "Role", "Class", "Admission No", "Login email", "Temporary password"],
    ...list.map((c) => [c.name, ROLE_LABEL[c.role] || c.role, c.class || "", c.admission_number || "", c.email, c.password])]);

  return (
    <>
      <Modal title={title} onClose={onClose} wide={list.length > 1}
        footer={<>
          <Btn variant="outline" icon={Copy} onClick={copy}>Copy</Btn>
          <Btn variant="outline" icon={Download} onClick={csv}>Download CSV</Btn>
          <Btn variant="outline" icon={Printer} onClick={() => window.print()}>Print slips</Btn>
          <Btn onClick={onClose}>Done</Btn>
        </>}>
        <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-900 text-sm px-4 py-3 mb-4 flex gap-2">
          <KeyRound size={18} className="shrink-0 mt-0.5" />
          <span>Save or print these now. The temporary password is shown only once. Each person is asked to choose a new password the first time they sign in.</span>
        </div>
        <ul className="space-y-3">
          {list.map((c, i) => (
            <li key={c.id || i} className="rounded-xl ring-1 ring-slate-200 p-4">
              <p className="font-semibold text-slate-900">{c.name} <span className="text-sm font-normal text-slate-500">· {ROLE_LABEL[c.role] || c.role}{c.class ? ` · ${c.class}` : ""}</span></p>
              <dl className="mt-2 grid sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-500">Login email</dt><dd className="font-mono break-all select-all">{c.email}</dd>
                <dt className="text-slate-500">Password</dt><dd className="font-mono font-semibold select-all">{c.password}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </Modal>
      {createPortal(
        <div id="slips" className="hidden print:grid grid-cols-2 gap-3 p-4">
          {list.map((c, i) => (
            <div key={c.id || i} className="border-2 border-dashed border-slate-400 rounded-lg p-4 break-inside-avoid text-sm">
              <p className="font-bold text-base">{school?.name || "SMARTMARK SOLUTIONS"}</p>
              <p className="mt-1">{c.name} · {ROLE_LABEL[c.role] || c.role}{c.class ? ` · ${c.class}` : ""}</p>
              <p className="mt-2">Sign in at: <b>{origin}</b></p>
              <p>Email: <b className="font-mono">{c.email}</b></p>
              <p>Password: <b className="font-mono">{c.password}</b></p>
              <p className="mt-2 text-xs text-slate-600">You will be asked to choose a new password the first time you sign in.</p>
            </div>
          ))}
        </div>, document.body)}
    </>
  );
}
