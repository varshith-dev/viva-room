"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload, ClipboardPaste } from "lucide-react";
import { post } from "@/lib/client";

type Src = { id: string; title: string; kind: string; pages: number; chunks: number };

export function NotesPanel({ subjectId, sources }: { subjectId: string; sources: Src[] }) {
  const r = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [paste, setPaste] = useState(false);

  async function upload(file: File) {
    setBusy(`Reading ${file.name} and sorting it into topics…`);
    setErr("");
    try {
      const f = new FormData();
      f.append("file", file);
      await post(`/api/subjects/${subjectId}/sources`, f);
      r.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="label">Your notes</p>
          <h2 className="mt-1 font-serif text-2xl font-medium">What you&apos;ll be examined on</h2>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {sources.map((s) => (
          <li key={s.id} className="group flex items-center justify-between gap-3 rounded-lg border border-rule bg-[#fffdf8] px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5">
              <FileText className="h-4 w-4 shrink-0 text-pen" />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium">{s.title}</span>
                <span className="text-xs text-muted">
                  {s.kind === "pdf" ? `${s.pages} page${s.pages === 1 ? "" : "s"} · ` : ""}
                  {s.chunks} passages
                </span>
              </span>
            </span>
            <button
              className="rounded-md p-1.5 text-muted opacity-0 transition hover:bg-pen-soft hover:text-pen group-hover:opacity-100"
              aria-label={`Remove ${s.title}`}
              onClick={async () => {
                if (!confirm(`Remove ${s.title}? Its marks go too.`)) return;
                await fetch(`/api/sources/${s.id}`, { method: "DELETE" });
                r.refresh();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {busy ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border-[1.5px] border-dashed border-ink-2 bg-fold/50 px-4 py-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> {busy}
        </div>
      ) : paste ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy("Sorting your notes into topics…");
            setErr("");
            try {
              await post(`/api/subjects/${subjectId}/sources`, { title: f.get("title"), text: f.get("text") });
              setPaste(false);
              r.refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Failed");
            } finally {
              setBusy("");
            }
          }}
        >
          <input name="title" className="field" placeholder="Title, e.g. Lecture 7 notes" />
          <textarea name="text" required rows={7} className="field font-mono text-[13px]" placeholder="Paste your notes here…" />
          <div className="flex gap-2">
            <button className="btn btn-ink">Add notes</button>
            <button type="button" className="btn btn-ghost" onClick={() => setPaste(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) upload(f);
            }}
            className={`mt-4 flex w-full flex-col items-center rounded-xl border-[1.5px] border-dashed px-4 py-7 text-center transition ${drag ? "border-pen bg-pen-soft/40" : "border-ink-2/50 hover:border-ink hover:bg-fold/40"}`}
          >
            <Upload className="h-5 w-5 text-ink-2" />
            <span className="mt-2 font-medium">Drop a PDF or text file</span>
            <span className="text-sm text-muted">or click to choose · up to 4 MB</span>
          </button>
          <input
            ref={input}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <button className="btn btn-ghost mt-2 w-full text-sm" onClick={() => setPaste(true)}>
            <ClipboardPaste className="h-4 w-4" /> Paste text instead
          </button>
        </>
      )}
      {err ? <p className="mt-3 rounded-lg bg-pen-soft px-3 py-2 text-sm text-pen">{err}</p> : null}
    </section>
  );
}
