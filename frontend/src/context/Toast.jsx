import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((kind, text) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);
  const api = { success: (t) => push("success", t), error: (t) => push("error", t) };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 pointer-events-none no-print" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`sms-sheet pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-soft max-w-md w-full sm:w-auto ${i.kind === "error" ? "bg-rose-600 text-white" : "bg-slate-900 text-white"}`}>
            {i.kind === "error" ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-300" />}
            <span>{i.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
