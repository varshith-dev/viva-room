"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { post } from "@/lib/client";

const MODES = [
  { id: "lab", label: "Lab viva", hint: "What happens if, why this step, how would you test it." },
  { id: "theory", label: "Theory viva", hint: "Explain, compare and justify, in your own words." },
  { id: "rapid", label: "Rapid fire", hint: "One sentence recall. Good the night before." },
] as const;
const STRICT = [
  { id: "kind", label: "Kind" },
  { id: "fair", label: "Fair" },
  { id: "strict", label: "Strict" },
] as const;

export function StartViva({ subjectId, ready, due, aiName }: { subjectId: string; ready: boolean; due: number; aiName: string }) {
  const r = useRouter();
  const [mode, setMode] = useState<string>("theory");
  const [strictness, setStrict] = useState<string>("fair");
  const [length, setLength] = useState(5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <section className="card relative overflow-hidden p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Start a viva</p>
          <h2 className="mt-1 font-serif text-2xl font-medium">Sit across the table</h2>
        </div>
        {due > 0 ? <span className="stamp text-pen">{due} due to revise</span> : null}
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-xl border-[1.5px] p-3.5 text-left transition ${mode === m.id ? "border-ink bg-[#fffdf8] shadow-[3px_3px_0_var(--color-ink)]" : "border-rule hover:border-ink-2"}`}
          >
            <span className="font-semibold">{m.label}</span>
            <span className="mt-1 block text-[13px] leading-snug text-ink-2">{m.hint}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div>
          <p className="label mb-1.5">Examiner</p>
          <div className="inline-flex rounded-lg border border-rule bg-[#fffdf8] p-0.5">
            {STRICT.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStrict(s.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${strictness === s.id ? "bg-ink text-sheet" : "text-ink-2 hover:bg-fold"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label mb-1.5">Questions</p>
          <div className="inline-flex rounded-lg border border-rule bg-[#fffdf8] p-0.5">
            {[3, 5, 8].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLength(n)}
                className={`rounded-md px-3 py-1.5 font-mono text-sm ${length === n ? "bg-ink text-sheet" : "text-ink-2 hover:bg-fold"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        className="btn btn-ink mt-7 w-full py-3.5 text-[15px]"
        disabled={!ready || busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            const { id } = await post<{ id: string }>("/api/sessions", { subjectId, mode, strictness, length });
            r.push(`/app/viva/${id}`);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Couldn't start");
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
        {busy ? "The examiner is reading your notes…" : ready ? "Begin viva" : "Add notes first"}
      </button>
      {err ? <p className="mt-3 rounded-lg bg-pen-soft px-3 py-2 text-sm text-pen">{err}</p> : null}
      <p className="mt-3 text-xs text-muted">Questions come from your weakest and due passages first. AI: {aiName}.</p>
    </section>
  );
}
