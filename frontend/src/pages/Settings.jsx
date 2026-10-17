import { useEffect, useRef, useState } from "react";
import { Save, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { api, assetUrl } from "../lib/api";
import { useQuery } from "../lib/query";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/Toast";
import { fmtDate } from "../lib/format";
import { Page, Card, Btn, Input, Textarea, ErrorNote, Spinner } from "../components/ui";

function ImageField({ label, hint, kind, url, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const input = useRef();
  const pick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", kind); fd.append("file", file);
      onChange(await api.upload("/school/upload", fd));
      toast.success(`${label} saved.`);
    } catch (x) { toast.error(x.message); } finally { setBusy(false); e.target.value = ""; }
  };
  const remove = async () => { try { onChange(await api.del(`/school/upload/${kind}`)); toast.success(`${label} removed.`); } catch (x) { toast.error(x.message); } };
  return (
    <div className="rounded-xl ring-1 ring-slate-200 p-4 flex gap-4 items-center">
      <div className="size-20 rounded-lg bg-slate-100 grid place-items-center overflow-hidden shrink-0">
        {url ? <img src={assetUrl(url)} alt={label} className="max-h-full max-w-full object-contain" /> : <ImageIcon className="text-slate-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p><p className="text-xs text-slate-500">{hint}</p>
        <div className="mt-2 flex gap-2 flex-wrap">
          <Btn size="sm" variant="outline" icon={Upload} loading={busy} onClick={() => input.current.click()}>{url ? "Replace" : "Upload"} image</Btn>
          {url && <Btn size="sm" variant="dangerSoft" icon={Trash2} onClick={remove}>Remove</Btn>}
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={pick} aria-label={`${label} file`} />
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { refresh } = useAuth();
  const toast = useToast();
  const { data } = useQuery("/school");
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { if (data && !f) setF(data); }, [data, f]);
  if (!f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const images = (s) => setF((p) => ({ ...p, crest_url: s.crest_url, head_signature_url: s.head_signature_url, stamp_url: s.stamp_url }));
  const save = async (e) => {
    e.preventDefault(); setError("");
    try { await api.put("/school", f); await refresh(); toast.success("School settings saved."); } catch (x) { setError(x.message); }
  };
  return (
    <Page title="School settings" subtitle="These details are printed on every report card and marklist.">
      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card title="Crest, signature and stamp">
            <div className="space-y-3">
              <ImageField kind="crest" label="School crest or logo" hint="PNG, JPG or WebP up to 2 MB. Square works best." url={f.crest_url} onChange={images} />
              <ImageField kind="signature" label="Head teacher's signature" hint="A signature on a plain or transparent background." url={f.head_signature_url} onChange={images} />
              <ImageField kind="stamp" label="School stamp" hint="Printed in the stamp box on report cards." url={f.stamp_url} onChange={images} />
            </div>
          </Card>
          <Card title="Details"><form onSubmit={save} className="space-y-4">
            <ErrorNote error={error} />
            <Input label="School name" required value={f.name || ""} onChange={set("name")} />
            <Input label="Motto" value={f.motto || ""} onChange={set("motto")} />
            <Input label="Address" value={f.address || ""} onChange={set("address")} placeholder="P.O. Box 876-20500 Narok" />
            <div className="grid sm:grid-cols-2 gap-3"><Input label="Contact email" type="email" value={f.contact_email || ""} onChange={set("contact_email")} /><Input label="Contact phone" value={f.contact_phone || ""} onChange={set("contact_phone")} /></div>
            <div className="grid sm:grid-cols-2 gap-3"><Input label="Head teacher's name" value={f.head_teacher_name || ""} onChange={set("head_teacher_name")} />
              <Input label="Next term begins" type="date" value={f.next_term_begins || ""} onChange={set("next_term_begins")} /></div>
            <div className="grid sm:grid-cols-3 gap-3"><Input label="Current term" value={f.current_term || ""} onChange={set("current_term")} placeholder="Term 3 2026" />
              <Input label="Term starts" type="date" value={f.term_start || ""} onChange={set("term_start")} /><Input label="Term ends" type="date" value={f.term_end || ""} onChange={set("term_end")} /></div>
            <Textarea label="Report card footer" value={f.report_card_footer || ""} onChange={set("report_card_footer")} hint="For example: Happy holidays." />
            <Btn type="submit" icon={Save}>Save settings</Btn>
          </form></Card>
        </div>
        <Card title="Your plan" className="self-start">
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-slate-500">Plan</dt><dd className="font-semibold">{f.plan_name || "Standard"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Learner limit</dt><dd className="font-semibold">{f.max_students ?? "Unlimited"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Staff limit</dt><dd className="font-semibold">{f.max_staff ?? "Unlimited"}</dd></div>
            {f.next_payment_due && <div className="flex justify-between"><dt className="text-slate-500">Next payment</dt><dd className="font-semibold">{fmtDate(f.next_payment_due)}</dd></div>}
          </dl>
          <p className="text-xs text-slate-500 mt-4">To change your plan, contact SMARTMARK SOLUTIONS.</p>
        </Card>
      </div>
    </Page>
  );
}
