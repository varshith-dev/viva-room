"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { post } from "@/lib/client";

export function GuestButton({ className = "btn btn-ink", label = "Try it with sample notes" }: { className?: string; label?: string }) {
  const r = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span className="inline-flex flex-col">
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await post("/api/auth/guest");
            r.push("/app");
            r.refresh();
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Couldn't start");
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {label}
        {!busy ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
      {err ? <span className="mt-2 text-sm text-pen">{err}</span> : null}
    </span>
  );
}
