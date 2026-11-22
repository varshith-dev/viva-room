"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { post } from "@/lib/client";

export function NewSubject() {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!open)
    return (
      <button className="btn btn-ink" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New subject
      </button>
    );
  return (
    <form
      className="card flex w-full flex-wrap items-end gap-3 p-4 sm:w-auto"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setErr("");
        try {
          const { id } = await post<{ id: string }>("/api/subjects", { title: f.get("title"), examDate: f.get("examDate") || null });
          r.push(`/app/s/${id}`);
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Failed");
          setBusy(false);
        }
      }}
    >
      <label className="min-w-56 flex-1">
        <span className="label">Subject or unit</span>
        <input name="title" required autoFocus className="field mt-1" placeholder="DBMS, Unit 2: Normalisation" />
      </label>
      <label>
        <span className="label">Viva date</span>
        <input name="examDate" type="date" className="field mt-1" />
      </label>
      <button className="btn btn-ink" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create
      </button>
      <button type="button" className="btn btn-ghost px-2" onClick={() => setOpen(false)} aria-label="Cancel">
        <X className="h-4 w-4" />
      </button>
      {err ? <p className="w-full text-sm text-pen">{err}</p> : null}
    </form>
  );
}
