import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import ReportCardView from "../components/ReportCardView";
import { Btn, Spinner, Empty } from "../components/ui";
import { Brand } from "../components/Shell";

export default function PublicReportCard() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get(`/reports/shared/${token}`).then(setData).catch((e) => setError(e.message)); }, [token]);
  return (
    <div className="min-h-screen bg-slate-100 py-8 px-3">
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between no-print">
        <Brand light={false} small />
        {data && <Btn icon={Printer} onClick={() => window.print()}>Print or save as PDF</Btn>}
      </div>
      {!data && !error && <Spinner />}
      {error && <div className="max-w-md mx-auto bg-surface rounded-2xl"><Empty title="This link cannot be opened" hint={error} /></div>}
      <ReportCardView data={data} />
    </div>
  );
}
